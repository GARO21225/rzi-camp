# T05 : Signaler un incident de maintenance (fiche pédagogique)

| Élément | Contenu |
|---|---|
| Série | 1 : Espace résident |
| Module | Maintenance (`/maintenance`), onglet mobile « Signaler » |
| Public | Tout résident (rôle `agent`), équipe ménage. Le même formulaire existe pour les autres profils. |
| Support filmé | Mobile (iPhone 13, 390 × 844 pt), application web/PWA |
| Prérequis | Être connecté. L'Induction Camp doit être terminée, sinon l'application renvoie d'abord vers elle. |
| Durée | 1 min 40 (catalogue : 1 min 30 ; +10 s pour ne pas presser la démonstration) |
| Difficulté | Facile |
| Statut fonctionnel | ✅ Opérationnel. Vérifié dans le code et rejoué sur une instance de démonstration le 11/11/2026. |

## Objectif pédagogique

À la fin de la vidéo, l'utilisateur sait :
1. ouvrir la page Maintenance depuis l'onglet **Signaler** ;
2. remplir les champs obligatoires (**Titre**, **Description**, **Résidence**) et les champs utiles (**Catégorie**, **Priorité**, **Type de lieu**, **Bloc / Chambre**, **Photo**) ;
3. envoyer avec **🔧 Déclarer l'incident** ;
4. retrouver l'incident dans sa liste et lire son statut et son parcours.

## Problématique (avant)

- Les pannes sont signalées **de vive voix** ou par message, à la personne disponible sur le moment.
- Les signalements sont **oubliés** ou en double. Rien n'indique **où en est** la réparation.
- Il n'y a ni priorité ni délai : un problème urgent attend comme un problème mineur.

*Seuls ces problèmes sont traités, parce que la fonctionnalité y répond réellement.*

## Solution (Roxgold SiteLife)

| Besoin | Réponse vérifiée dans le code |
|---|---|
| Déclarer vite, depuis le terrain | Formulaire mobile accessible en 2 gestes (onglet Signaler, puis bouton +). |
| Décrire précisément | Titre, description, catégorie (10 choix), priorité (Critique / Haute / Moyenne / Basse), lieu (hébergement ou une des 15 infrastructures), photo jusqu'à 3 Mo. |
| Prioriser | Échéance SLA calculée automatiquement selon la priorité (délais réglables par l'administrateur dans Paramétrage). |
| Prévenir les responsables | Les administrateurs du camp reçoivent une notification dès la déclaration (`maintenance/views.py`, `_notifier`). |
| Suivre | L'incident apparaît dans « Maintenance » avec son statut, son échéance et son parcours en 5 étapes : Déclaré → Assigné → En cours → Résolu → Clôturé. |

## Ce que la vidéo ne dit pas (et pourquoi)

- **« Vous serez notifié à chaque étape »** : faux. Le déclarant est notifié des messages laissés sur son incident, mais pas de chaque changement de statut. Il consulte l'avancement dans l'application.
- **Un délai chiffré (« traité en 8 h »)** : les délais SLA sont réglables par l'administrateur, donc aucun chiffre n'est annoncé.
- **« L'équipe maintenance est prévenue »** : ce sont les administrateurs (et le technicien une fois assigné) qui sont notifiés. La vidéo dit « les responsables du camp ».
