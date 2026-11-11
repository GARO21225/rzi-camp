# T03 : Demander un voyage et suivre sa demande (fiche pédagogique)

| Élément | Contenu |
|---|---|
| Série | 1 : Espace résident |
| Modules | Accueil, Demandes (`/demandes`), notifications |
| Public | Résident ayant le droit de mobilité (`droit_mobilite`). La validation est faite par l'administration. |
| Support filmé | Mobile (iPhone 13), navigateur réglé en français |
| Durée | 1 min 54 (catalogue : 2 min 30) |
| Difficulté | Facile |
| Statut fonctionnel | ✅ Opérationnel. Rejoué de bout en bout sur l'instance de démo le 11/11/2026 : demande, validation par un administrateur fictif (`demo.admin`, via l'API), notification, puis accueil. |

## Objectif pédagogique
1. Ouvrir le formulaire depuis l'accueil (« Demander un voyage ») ou depuis Demandes (bouton bus).
2. Renseigner l'itinéraire, la montée et la descente, le transport (car du camp ou véhicule personnel), les dates et le motif.
3. Suivre la demande : En attente (annulable), puis Validée avec commentaire, notification, et prochain trajet sur l'accueil.

## Problématique (avant)
- Demandes **à l'oral ou sur papier**, **sans réponse tracée** : on ne sait pas si c'est validé.

## Solution (vérifiée dans le code)
| Besoin | Réponse |
|---|---|
| Demander vite | Formulaire Voyage : itinéraires modèles, jours de circulation affichés, départ au moins 48 h à l'avance (contrôlé aussi côté serveur), motif obligatoire. |
| Savoir où on en est | Statuts En attente / Validée / Rejetée / Annulée. Annulation possible tant que la demande n'est pas traitée. |
| Être informé | Notification au demandeur à la validation (« ✅ Votre demande a été validée ») et au refus, avec le motif, qui est **obligatoire** côté administration. |
| Voyage prêt | La validation crée le voyage, rattaché au convoi de l'itinéraire, et le trajet retour. Il apparaît en « Prochain trajet » sur l'accueil. |

## Défaut corrigé pendant le tournage (avec l'accord d'Edgar)
- **Validation d'un départ futur depuis le camp** : la personne était marquée « en voyage » et sa chambre libérée **dès la validation**, plusieurs jours avant le départ. L'accueil affichait « Trajet en cours · En route ». **Corrigé** : le voyage reste « Planifié » et la chambre occupée jusqu'au jour J, puis la tâche automatique fait partir la personne (`residences/views.py`, tests `TrajetsAllerSimpleTests.test_validation_d_un_depart_*`).

## Petits défauts relevés (non corrigés, à décider)
- La carte d'une demande affiche ses dates au format brut « 2026-11-16 → 2026-11-28 », au lieu de `toLocaleDateString('fr-FR')` (convention de `CLAUDE.md`).
- Le champ « Date départ » est prérempli avec la date du jour, alors qu'un résident doit demander au moins 48 h à l'avance : il faut toujours le changer.

## Ce que la vidéo ne dit pas
- La **contre-proposition** de l'administration ne concerne en pratique que les résidences. Pour un voyage, l'acceptation d'une proposition ne crée aucun voyage : ce n'est donc pas montré.
- Le refus n'est pas filmé. Il est seulement cité dans le résultat (« refusée avec un motif obligatoire »), ce que le code vérifie.
