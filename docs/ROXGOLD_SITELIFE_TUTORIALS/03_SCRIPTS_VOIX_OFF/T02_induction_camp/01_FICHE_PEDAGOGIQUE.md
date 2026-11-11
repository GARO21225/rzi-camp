# T02 : Réaliser son Induction Camp (fiche pédagogique)

| Élément | Contenu |
|---|---|
| Série | 1 : Espace résident |
| Module | Induction Camp (`/induction-camp`) |
| Public | Tout nouvel arrivant hébergé au camp (rôle `agent` et autres profils non administrateurs) |
| Support filmé | Mobile (iPhone 13), application web/PWA |
| Prérequis | Être connecté et hébergé dans une chambre. L'application ouvre alors l'induction d'office. |
| Durée | 2 min 49 (catalogue : 3 min) |
| Difficulté | Facile |
| Statut fonctionnel | ✅ Opérationnel. Vérifié dans le code et parcours complet rejoué sur une instance de démonstration le 11/11/2026 (quiz réussi 10/10, certificat obtenu). |

## Objectif pédagogique

À la fin de la vidéo, le nouvel arrivant sait :
1. pourquoi l'application l'amène directement sur l'Induction Camp (et pourquoi les autres pages restent bloquées) ;
2. franchir les 6 étapes : Bienvenue, Infrastructures (au moins 4 zones), Règles de vie (toutes), Quiz (10/10), Appareils de plus de 100 W, Engagement signé ;
3. obtenir son certificat, ce qui débloque le reste de l'application.

## Problématique (avant)

- À l'arrivée, les règles du camp (horaires, sécurité, contacts d'urgence, conduite) sont transmises **à l'oral** et **vite oubliées**.
- **Rien ne prouve** que la personne les a comprises et acceptées.

## Solution (vérifiée dans le code)

| Besoin | Réponse |
|---|---|
| Ne pas oublier l'induction | `Layout.jsx` renvoie d'office vers `/induction-camp` toute personne hébergée tant que l'induction n'est pas signée (`/api/induction-camp/statut/` → `requise`). |
| Transmettre l'information | 8 fiches d'infrastructures (au moins 4 à consulter) et 9 règles de vie classées Critique / Important / Standard (toutes à lire). Contenu administrable dans Paramétrage > Induction du Camp. |
| Vérifier la compréhension | Quiz de 10 questions tirées au hasard côté serveur, avec ordre des réponses mélangé. Il faut 100 %. En cas d'erreur : retour aux règles, puis nouvelle série. La bonne réponse n'est jamais révélée. |
| Recenser les appareils énergivores | Déclaration des appareils de plus de 100 W (type, marque, modèle, puissance, chambre), ou « Je n'ai pas d'appareil >100W ». |
| Engager la personne | Récapitulatif, formulaire d'acceptation, signature au doigt, certificat. |
| Suivre la conformité | Registre de l'administration (terminés, à faire, exemptés, taux de conformité, export Excel) depuis la même page. |

## Défauts de l'application constatés pendant le tournage, **corrigés le 11/11/2026** (avec l'accord d'Edgar)

1. **Étape Bienvenue, liste du parcours** : la ligne ⚡ s'affiche **sans texte**. Dans `InductionCamp.jsx:670`, le libellé `'Déclarer vos appareils {'>'}100W'` est une chaîne JavaScript, pas du JSX : il est évalué comme la comparaison `'…{' > '}100W'`, qui vaut `false`. **Corrigé** : `label:'Déclarer vos appareils >100W'`.
2. **Certificat** : « ✅ **8** règles de vie lues et comprises » et « 8 infrastructures » sont **écrits en dur** (`InductionCamp.jsx:413-414`), alors que le camp a 9 règles et que seules 4 infrastructures sont exigées. **Corrigé** : `REGLES.length` et `infrasVues.size`, avec les traductions anglaises ajoutées dans `src/i18n/en.json`.

Les captures 02 et 17 ont été refaites après correction.

## Ce que la vidéo ne dit pas (et pourquoi)

- **« Dès votre première connexion »** : faux pour une personne pas encore logée. L'ouverture automatique ne concerne que les personnes **hébergées** au camp. La vidéo dit « dès que vous êtes hébergé au camp ».
- **« Toute l'application vous est accessible »** : les pages dépendent du menu de chaque rôle. La vidéo dit « le reste de l'application est débloqué ».
- **La confiscation des appareils** : le texte est affiché par l'application, mais la voix off ne le lit pas, pour garder un ton accueillant.
