# T03 : checklist de validation avant publication

## Fidélité fonctionnelle
- [x] Parcours rejoué : demande, validation (administrateur fictif, API), notification, accueil.
- [x] Défaut « Trajet en cours dès la validation » corrigé et testé ; les captures 08 à 10 ont été prises **après** le correctif (voyage « Planifié », chambre conservée).
- [x] Règles vérifiées dans le code : 48 h minimum (client et serveur), motif obligatoire, jours de circulation, refus avec motif obligatoire, annulation tant que la demande n'est pas traitée.
- [ ] Décider pour les deux petits défauts d'affichage (dates brutes sur la carte, date de départ préremplie).

## Données
- [x] Compte fictif Aya DEMO, administrateur fictif `demo.admin`, motif et précisions marqués démo.
- [x] Navigateur en français (dates jj/mm/aaaa) ; heure fixée à 10h15 (Abidjan).
- [ ] Les itinéraires « Camp → Abidjan / Abidjan → Camp » et leurs villes viennent du contenu chargé par migration (villes du trajet réel) : à faire valider par la sécurité du site.

## Image, son, sous-titres
- [ ] Logo HD · voix FLORA (15 fichiers) · SRT recalé · illustration P02 · export `T03_demander_voyage_v1.mp4`.
