# T04 : checklist de validation avant publication

## Fidélité fonctionnelle
- [x] Chaîne réelle rejouée par l'API : validation, `modifier_rotation` (bus et chauffeur), « Partir », envoi de positions ; panneau de suivi filmé à l'heure réelle, positions fraîches.
- [x] Affirmations vérifiées dans le code : actualisation toutes les 15 s, avertissement si la position est ancienne, conditions d'affichage du bouton.
- [ ] Coordonnées de **Tiéningboué** à fournir (arrêt absent de `coordsDestinations.js`), puis refaire `04_suivi_bus_entre.png`.

## Données et confidentialité
- [x] Passager (Aya DEMO), chauffeur (Chauffeur DEMO), bus DEMO-001 : tous fictifs.
- [x] Tracé GPS fictif, interpolé entre les villes connues de l'application.
- [ ] Le fond de carte montre l'itinéraire réel Camp → Abidjan et la position approximative du camp : à faire valider par la sécurité du site.

## Image, son, sous-titres
- [ ] Logo HD · voix FLORA (11 fichiers) · SRT recalé · illustration P02 · export `T04_suivre_bus_v1.mp4`.
