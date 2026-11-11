# T01 : checklist de validation avant publication

## Fidélité fonctionnelle
- [x] Connexion, accueil, menu Plus, Mon compte et changement de mot de passe rejoués sur l'instance de démo.
- [x] Durées vérifiées dans le code : déconnexion après 15 min sans activité, avertissement à 14 min, déconnexion 3 s après un changement de mot de passe.
- [x] SMS et « mot de passe oublié » non promis, parce qu'ils dépendent des fournisseurs configurés.
- [ ] Vérifier sur l'environnement de démo officiel que le menu `agent` correspond aux onglets cités (Accueil, Voyages, Demandes, Repas, Signaler).

## Données
- [x] Compte fictif `demo.resident` (Aya DEMO, DEMO SARL), trajet et demande marqués « DÉMO ».
- [x] Heure du navigateur fixée à 10h15 (Abidjan) pour la capture, afin d'afficher « Bonjour ». L'écran est le vrai rendu de l'application à cette heure-là.
- [x] Mot de passe de démo remis après la capture (`seed_demo_t01.py`).

## Image, son, sous-titres
- [ ] Logo officiel en haute définition.
- [ ] Voix FLORA (17 fichiers), puis SRT recalé.
- [ ] Illustration FLORA du plan P02, avec la mention « Illustration ».
- [ ] Export final `T01_connexion_accueil_v1.mp4`.
