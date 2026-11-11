# T04 : Suivre son bus en direct (fiche pédagogique)

| Élément | Contenu |
|---|---|
| Série | 1 : Espace résident |
| Modules | Accueil, suivi du trajet en direct (`components/SuiviTrajetDirect.jsx`), Voyages |
| Public | Passager d'un convoi du camp (voyage rattaché à une rotation, pas en véhicule personnel) |
| Support filmé | Mobile (iPhone 13), navigateur en français, heure réelle |
| Durée | 1 min 18 (catalogue : 1 min 30) |
| Difficulté | Facile |
| Statut fonctionnel | ✅ Opérationnel. Rejoué le 11/11/2026 sur l'instance de démo avec la vraie chaîne d'API : demande validée par l'admin, véhicule et chauffeur affectés (`modifier_rotation`), « Partir » du chauffeur, envoi de positions GPS (`/api/suivi-convois/…/position/`). |

## Objectif pédagogique
1. Ouvrir le suivi depuis l'accueil (« Suivre mon bus en direct ») ou depuis Voyages (« Suivre en direct »).
2. Lire la carte : position du bus, trajet déjà parcouru (vert), sa propre montée (bleu) et sa descente (or).
3. Lire l'arrivée estimée (heure, temps et km restants) et le parcours arrêt par arrêt.

## Problématique (avant)
- On attend **sans information** sur la position du bus et sur son heure d'arrivée : on appelle le chauffeur.

## Solution (vérifiée dans le code)
| Besoin | Réponse |
|---|---|
| Où est le bus ? | Position envoyée par le téléphone du chauffeur (« Ma conduite »), affichée sur la carte avec le tracé parcouru. |
| Quand arrive-t-il ? | Arrivée estimée, temps et km restants jusqu'à **sa** descente (ou jusqu'à sa montée s'il doit encore être ramassé), à partir de la vitesse moyenne réelle (`utils/trajetDirect.js`). |
| Information fiable | Actualisation toutes les 15 s tant que le panneau est ouvert ; avertissement « Position du bus non actualisée depuis X min » si le GPS du chauffeur ne répond plus. |
| Où en est le trajet ? | Parcours : arrêts passés, « Votre montée », « Votre descente », « Le bus est entre X et Y ». |

Condition d'affichage du bouton sur l'accueil (code) : voyage en convoi (`rotation_id`), pas en véhicule personnel, en cours ou dont le départ est aujourd'hui ou passé.

## Points relevés pendant le tournage
- **Tiéningboué n'a pas de coordonnées** dans `frontend/src/data/coordsDestinations.js`. La carte et le calcul de position sautent donc cet arrêt, et le suivi affiche « le bus est entre MANKONO et BOUAKE » alors que Tiéningboué se trouve entre les deux. Non corrigé : il faut les **coordonnées exactes** de l'arrêt, à fournir par l'équipe (je ne les invente pas).
- La voix off dit « entre quelles villes se trouve le bus », sans citer de villes, pour rester juste quel que soit ce défaut.

## Ce que la vidéo ne dit pas
- La position n'est pas « en temps réel à la seconde » : c'est la dernière position envoyée par le téléphone du chauffeur, actualisée toutes les 15 s.
- Le tracé GPS de la démo est **fictif** (interpolé entre les villes connues de l'application) : il ne montre pas un vrai trajet.
