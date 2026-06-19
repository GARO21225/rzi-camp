# Journal d'erreurs — RZI Camp ERP

Historique des bugs réels rencontrés pendant le développement, avec cause racine et fix. Objectif : ne pas refaire la même erreur, et reconnaître plus vite le symptôme la prochaine fois qu'il apparaît sous une forme légèrement différente.

---

## Catégorie : Page blanche (React)

C'est le symptôme le plus fréquent rencontré sur ce projet. Quatre causes racines différentes ont produit exactement le même symptôme visuel — la leçon principale est qu'**une "page blanche" n'est jamais une cause, c'est un symptôme**, et qu'il faut systématiquement lire le code source exact avant de proposer un fix.

### 1. Composant `lazy()` rendu sans `<Suspense>` parent
**Où** : `Dashboard` chargé en lazy dans `App.jsx`, mais retourné directement par une fonction intermédiaire `RoleHome()` sans wrapper `<Suspense>` autour.
**Symptôme** : page blanche immédiate au chargement du Dashboard, aucune erreur réseau visible.
**Cause** : React interdit formellement de rendre un composant `lazy()` hors d'un arbre `<Suspense>`. L'erreur est levée mais n'apparaît pas forcément clairement selon la configuration du error boundary.
**Fix** : envelopper le retour de `RoleHome()` dans `<Suspense fallback={...}><Dashboard /></Suspense>`.
**Leçon** : avoir un composant en lazy dans une route ne suffit pas — il faut vérifier *tous* les chemins de rendu qui mènent à ce composant, pas seulement la déclaration de route.

### 2. État utilisé dans le JSX mais jamais déclaré avec `useState`
**Où** : `Maintenance.jsx` — `showPeriodeModal` et `periodeRapport` référencés dans le JSX (pour la modal de génération de rapport par période) sans ligne `useState` correspondante, ajoutés lors d'une modification précédente qui n'avait pas inclus la déclaration d'état.
**Symptôme** : page blanche.
**Cause** : référencer une variable non déclarée dans du JSX ne lève pas toujours une erreur de compilation claire — le bundler peut compiler avec un warning, et l'erreur n'apparaît qu'à l'exécution.
**Fix** : ajouter les deux `useState` manquants.
**Leçon** : après tout ajout de JSX qui référence un nouvel état, relire immédiatement la liste des `useState` du composant et vérifier la correspondance un par un, plutôt que de faire confiance à la compilation seule.

### 3. Bloc de code inséré accidentellement avant les imports (ligne 0)
**Où** : `Maintenance.jsx` — un bloc de KPIs avait été inséré par erreur à la ligne 0 du fichier, avant `import React from 'react'`.
**Symptôme** : page blanche sur toute l'application (pas seulement Maintenance, parce que ce fichier est dans le même bundle que d'autres pages statiques).
**Cause** : une modification automatisée du fichier a inséré du JSX brut sans vérifier le point d'insertion réel — `maint.replace(...)` a matché un pattern qui se trouvait à l'index 0 au lieu du milieu de fichier attendu.
**Fix** : repérer où commence le "vrai" fichier (`import React...`) et tronquer tout ce qui précède.
**Leçon** : après toute insertion de bloc par script, toujours afficher les 10 premières lignes du fichier modifié pour confirmer que la structure de base (imports, déclaration de fonction) est toujours en première position.

### 4. Attribut JSX dupliqué sur le même élément
**Où** : `Maintenance.jsx` — un `<div>` avait deux attributs `style={{...}}` (un avec juste `position:'relative'`, un autre avec le vrai style visuel), séparés par un `onClick` entre les deux.
**Symptôme** : warning esbuild non bloquant à la compilation ("Duplicate attribute"), mais crash runtime React qui se propageait à toute l'app (même bundle).
**Cause** : modification incrémentale qui a ajouté un second `style={{}}` au lieu de fusionner avec le premier existant.
**Fix** : fusionner les deux objets `style` en un seul.
**Leçon** : un warning de build qui semble inoffensif ("juste un duplicate, ça compile") peut quand même casser le runtime. Ne jamais ignorer un warning esbuild même s'il n'empêche pas `npm run build` de réussir.

---

## Catégorie : CORS / 500 sur le backend

### 5. CORS "Missing Allow Origin" sur une réponse 500
**Symptôme observé côté navigateur** : `Blocage d'une requête multiorigines... l'en-tête CORS Access-Control-Allow-Origin est manquant. Code d'état : 500.`
**Cause racine réelle, trouvée après plusieurs itérations** : deux problèmes empilés.
  - (a) `django-cors-headers` ne s'applique pas en mode ASGI/Daphne — seulement en WSGI. Donc même avec `CORS_ALLOW_ALL_ORIGINS = True` dans `settings.py`, aucune réponse (succès ou erreur) ne recevait les headers CORS.
  - (b) La vue `custom_login` retournait elle-même une 500 à cause d'un décorateur mal positionné (voir bug #6 ci-dessous), donc même en réglant (a), il restait une vraie erreur serveur à corriger.
**Fix** : middleware CORS maison écrit directement dans `asgi.py`, qui intercepte chaque réponse ASGI et injecte les headers CORS manuellement, y compris sur les réponses d'erreur.
**Leçon** : un message d'erreur CORS dans la console du navigateur peut masquer une vraie erreur 500 applicative derrière. Toujours vérifier le code de statut HTTP exact en plus du message CORS — "CORS missing" + "500" ensemble veut presque toujours dire "il y a un bug serveur, le CORS n'est qu'un symptôme dérivé".

### 6. Décorateur `@api_view` séparé de sa fonction par une ligne vide
**Où** : `backend/rzi_camp/urls.py` — deux blocs de décorateurs empilés par erreur :
```python
@api_view(['GET'])
@permission_classes([AllowAny])

@api_view(['POST', 'OPTIONS'])
@permission_classes([AllowAny])
def custom_login(request):
```
**Symptôme** : 500 sur chaque appel à `/api/auth/login/`, sans message d'erreur clair côté frontend (juste "Internal Server Error").
**Cause** : le premier `@api_view(['GET'])` ne s'appliquait à aucune fonction (ligne vide après), et Python l'acceptait silencieusement comme syntaxe valide (un décorateur appliqué à... rien de visible immédiatement, mais en réalité au bloc suivant qui contenait déjà ses propres décorateurs, créant une situation où `custom_login` n'avait en fait jamais reçu le traitement DRF attendu sur l'objet `request`). `request.data` n'existait donc pas → `AttributeError` → 500.
**Fix** : coller les deux décorateurs directement à `def custom_login`, sans ligne vide ni bloc parasite avant.
**Leçon** : ce bug a pris plusieurs tours de conversation à être identifié parce que le code "semblait" correct à une lecture rapide — les décorateurs étaient bien présents dans le fichier, juste mal positionnés. La leçon concrète : quand une vue DRF lève une 500 sans message clair, **toujours vérifier que le décorateur est physiquement collé à la ligne `def`**, pas seulement présent quelque part au-dessus.

---

## Catégorie : Stock / données qui ne se mettent pas à jour

### 7. Stock boutique qui ne décrémente jamais après une vente
**Symptôme** : un achat est enregistré (la consommation apparaît dans l'historique, le paiement est traité), mais le `stock` affiché de l'article reste identique.
**Cause racine** : `ConsommationBoutiqueViewSet.create()` faisait l'`INSERT` de la consommation et le débit du bon de caisse, mais **aucune ligne de code ne touchait au champ `stock` de l'article**. Le serializer retournait bien le champ `stock`, l'API fonctionnait, mais personne ne le décrémentait jamais nulle part.
**Fix** : ajout d'un `UPDATE restauration_articleboutique SET stock = GREATEST(0, stock - %s) WHERE id = %s` en SQL direct dans la même transaction.
**Complément** : même après le fix backend, le stock affiché côté frontend restait visuellement figé pendant quelques secondes — ajout d'un rechargement différé (600ms puis 2000ms après la vente) pour laisser le temps à la transaction PostgreSQL de committer avant que le frontend ne relise les données.
**Leçon** : quand une donnée "ne se met pas à jour", vérifier dans cet ordre : (1) le backend modifie-t-il vraiment la donnée en base — pas juste l'enregistrement de l'événement qui devrait la déclencher ; (2) le frontend recharge-t-il après l'action ; (3) y a-t-il un délai de propagation (cache, latence de commit) qui justifie un re-fetch différé plutôt qu'immédiat.

---

## Catégorie : Performance

### 8. Application devenue lente — bundle principal surchargé
**Symptôme** : ressenti général de lenteur au chargement, sans erreur précise.
**Cause** : 12 pages sur 26 étaient importées de façon **statique** dans `App.jsx` (`import Maintenance from './pages/Maintenance'` au lieu de `lazy()`), dont certaines très volumineuses (`Boutique.jsx` 114KB, `Maintenance.jsx` 78KB, `Personnel.jsx` 47KB). Résultat : le bundle JS principal chargé au premier accès au site pesait plus de 300KB de code, même pour un utilisateur qui ne visite que le Dashboard.
**Fix** : conversion de tous les imports statiques (sauf `Login`, qui doit charger vite car c'est le premier écran vu) en `lazy()` avec `<Suspense>`. Bundle principal réduit de 374KB à 67KB (−82%).
**Découverte annexe pendant le nettoyage** : trois fichiers de pages mortes (`RotationCommandCenter.jsx`, `RotationsPage.jsx`, `RapportPage.jsx`) étaient encore importés ou présents sur disque après avoir été remplacés par des versions fusionnées (`MissionControl.jsx`, `RapportsPage.jsx`) — supprimés.
**Leçon** : la performance perçue d'une SPA React dégrade progressivement et silencieusement à chaque nouvelle page ajoutée si la discipline du lazy-loading n'est pas systématique. Un audit périodique de la taille du bundle principal (`npm run build` et lire la taille du premier `index-*.js` listé) devrait faire partie de toute revue de code, pas seulement être fait quand la lenteur devient un problème signalé par l'utilisateur final.

---

## Pattern récurrent observé sur l'ensemble de ces bugs

La majorité de ces erreurs partagent un point commun : **une modification incrémentale du code (ajout d'un état, d'un bloc, d'un décorateur) faite sans relire intégralement le contexte immédiat autour du point d'insertion.** Le fix systématique qui a fonctionné à chaque fois a été le même : revenir lire le fichier exact depuis la source, ligne par ligne autour de la zone concernée, plutôt que de faire confiance à un résumé ou à une supposition sur l'état du code.
