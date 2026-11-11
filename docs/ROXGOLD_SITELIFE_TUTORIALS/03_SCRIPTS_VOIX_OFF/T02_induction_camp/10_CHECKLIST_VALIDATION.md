# T02 : checklist de validation avant publication

## Fidélité fonctionnelle
- [x] Parcours complet rejoué de bout en bout sur l'instance de démo : 6 étapes, quiz 10/10, certificat.
- [x] Règles d'accès vérifiées dans le code : au moins 4 infrastructures, toutes les règles, quiz à 100 %, signature obligatoire.
- [x] Aucune promesse fausse : pas de « première connexion », pas de « toute l'application ».
- [ ] **Défaut 1** (ligne ⚡ vide sur l'écran Bienvenue) : corriger, puis refaire la capture `02_bienvenue_parcours.png`.
- [ ] **Défaut 2** (« 8 règles » écrit en dur sur le certificat) : corriger, puis refaire la capture `17_certificat.png`.

## Données et confidentialité
- [x] Les **vrais contacts** du contenu d'induction (noms, téléphones, e-mails, numéros de chambre, prestataire médical) ont été **remplacés par des données « DÉMO »** dans la base de démonstration (`seed_demo_t02.py`), puis vérifiés par recherche : 0 occurrence restante.
- [x] Personne fictive : Yao DEMO, DEMO SARL, chambre DEMO-A03.
- [ ] **À faire valider par la sécurité du site** : la vidéo montre de vrais horaires (repas, bar) et de vraies règles de vie du camp de Sango. Contenu peu sensible, mais public à confirmer (diffusion interne seulement ?).

## Image, son, sous-titres
- [ ] Logo officiel en haute définition.
- [ ] Voix FLORA générée (22 fichiers), puis SRT recalé sur l'audio final.
- [ ] Illustration FLORA du plan P02, avec la mention « Illustration ».
- [ ] Relecture par Edgar, puis test de compréhension par un nouvel arrivant.
- [ ] Export final `T02_induction_camp_v1.mp4`.
