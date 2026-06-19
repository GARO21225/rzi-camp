# Feature Backlog — RZI Camp ERP

Backlog construit à partir de l'audit du code réel (pas de suppositions). Chaque item indique pourquoi il est là.

## P0 — Dette technique à risque opérationnel

| Item | Pourquoi | Effort estimé |
|---|---|---|
| Confirmer/migrer les colonnes `Voyage` (`rotation_id`, `vehicule`, `nb_places_total`, `heure_depart`, `point_rdv`, `type_voyage`) | Le modèle `Voyage` lu en base de code ne les contient pas alors que `MissionControl.jsx` et les endpoints `rotations/`, `creer_rotation/` en dépendent. Risque : les rotations groupées semblent fonctionner en dev mais échouent silencieusement en prod si `/api/setup-db/` n'a pas tourné après le dernier déploiement. | Court — vérifier le schéma DB réel, écrire une vraie migration Django (`makemigrations`/`migrate`) au lieu d'`ALTER TABLE` manuel planqué dans une vue de diagnostic |
| Unifier le mécanisme de décrément du stock boutique | `ArticleBoutique.stock` est modifié par SQL brut dans une vue, pas via l'ORM. Toute évolution future (ex: gestion de fournisseurs, alertes de réappro automatiques) qui utiliserait `article.save()` créera une race condition ou une incohérence silencieuse avec le SQL existant. | Moyen |
| Unifier `Profile.role` et `Personnel.profil` | Deux champs de rôle avec des valeurs différentes, lus à des endroits différents du frontend. Source d'incohérence dès qu'un nouveau rôle est ajouté à un seul des deux. | Moyen |
| Clarifier la relation Induction QHSE / Induction Camp | Deux parcours d'induction distincts (`InductionPage.jsx` historique vs `InductionCamp.jsx` immersif) qui semblent taper sur la même ressource API (`/api/induction-records/`). Si c'est voulu, documenter explicitement le mapping étapes ↔ champs JSON ; si non voulu, séparer en deux modèles. | Court à clarifier, moyen à corriger |

## P1 — Fonctionnel manquant signalé implicitement par l'usage

| Item | Pourquoi |
|---|---|
| Historisation (`simple_history`) sur `Incident`, `Voyage`, `ArticleBoutique` | Activée seulement sur `Personnel` et `Batiment`. Si un audit "qui a changé le statut de cet incident et quand" est nécessaire un jour (probable sur un site minier avec obligations HSE), elle manque sur la table qui en a le plus besoin. |
| Migration des photos hors base de données | Toutes les photos (incidents, induction, etc.) sont stockées en base64 directement dans les colonnes `TextField`. Fonctionne à petite échelle, dégradera les performances de la DB et les coûts de stockage Render à mesure que le volume d'incidents/photos augmente. Migrer vers un stockage objet (S3-compatible ou équivalent Render) quand le volume le justifie. |
| Notifications WebSocket — couverture | Channels est configuré (`NotificationConsumer` sur `/ws/notifications/`) mais à vérifier si tous les modules critiques (nouvel incident, rotation modifiée, stock en rupture) déclenchent bien une notification temps réel, ou si certains passent encore par un polling REST. |
| Export PDF réel pour les rapports | `RapportsPage.jsx` génère un fichier HTML que l'utilisateur imprime via `window.print()` → "Enregistrer en PDF". Ça fonctionne mais dépend du navigateur. Une génération PDF côté serveur (WeasyPrint, ReportLab) donnerait un résultat plus fiable et permettrait l'envoi automatique par email. |

## P2 — Améliorations UX identifiées mais non urgentes

- **Mode offline réel** : la bannière "Vous êtes hors ligne" existe dans `Layout.jsx`, mais vérifier que les actions critiques (déclarer un incident, valider une vente boutique) sont vraiment mises en file d'attente et synchronisées au retour réseau, plutôt que simplement bloquées.
- **Recherche globale** : `GlobalSearch.jsx` existe — vérifier sa couverture sur les modules ajoutés récemment (Mission Control, Induction Camp, Rapports).
- **Accessibilité clavier** sur les modals et le Mission Control (beaucoup d'interactions `onClick` sans équivalent clavier/`role` ARIA).

## P3 — Idées à valider avec le métier avant de coder

- Génération automatique de rapports périodiques envoyés par email (hebdo/mensuel) plutôt que sur demande uniquement.
- Tableau de bord prédictif pour les rotations (déjà esquissé dans les "AI Recommendations" du Mission Control, mais actuellement basé sur des heuristiques simples calculées côté client — pourrait évoluer vers un vrai calcul backend avec historique réel).
- Multi-camp : le système est actuellement pensé pour un seul camp (Roxgold Sango). Si l'extension à d'autres sites miniers est un objectif réel (mentionné dans le Brand Brief comme ambition), il faut introduire une notion de `Camp`/`Site` comme dimension transverse dans le modèle de données, **avant** que le nombre de tables sans cette dimension ne rende la migration trop coûteuse.
