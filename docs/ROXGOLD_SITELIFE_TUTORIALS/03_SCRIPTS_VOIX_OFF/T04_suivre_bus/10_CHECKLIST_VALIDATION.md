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
- [x] Voix FLORA (11 fichiers, voix Charon) · SRT recalé sur la voix · export `T04_suivre_bus_v1.mp4`.
- [ ] Logo HD officiel · illustration P02 (optionnelle).

## Défauts de l'application relevés et corrigés (11/11/2026, avec accord)
- [x] Page Voyages : colonnes Départ et Retour prévu au format brut `2026-11-21` → `21/11/2026`.
- [x] Page Voyages : colonne « Personnel » vide de nom (affichait la destination) pour tous les profils, recherche par nom et filtre société inopérants : la page lisait `personnel_detail`, que l'API voyages ne renvoie pas (elle renvoie `personnel_nom` / `personnel_societe`).
