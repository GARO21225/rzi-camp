# T05 : checklist de validation avant publication

## Fidélité fonctionnelle
- [x] Chaque bouton ou champ cité existe dans le code (`Maintenance.jsx`, `LieuIncident.jsx`, `BottomTabBar` → « Signaler »).
- [x] Parcours rejoué de bout en bout sur l'instance de démo : l'incident est créé, statut « Déclaré », échéance SLA présente.
- [x] Aucune promesse non vérifiée : pas de délai chiffré, pas de « notifié à chaque étape », et « responsables du camp » plutôt que « équipe maintenance ».
- [ ] Vérifier sur l'environnement de démo officiel que le menu du rôle `agent` contient toujours « Signaler » (les menus sont paramétrables).

## Données et confidentialité
- [x] Données 100 % fictives (DEMO SARL, Aya DEMO, DEMO-A02).
- [x] Aucune carte du site, aucun nom, numéro ou donnée médicale réels.
- [ ] Image FLORA : aucun logo, aucun visage, aucun lieu réel reconnaissable.

## Image
- [ ] `03_accueil.png` reprise en journée (« Bonjour » au lieu de « Bonne nuit »).
- [ ] Logo ROXGOLD SITELIFE en haute définition fourni (fichier officiel).
- [ ] Toutes les captures nettes (×3), aucune retouche de l'interface.
- [ ] La mention « Illustration » est présente sur le plan P02.

## Son et sous-titres
- [ ] Voix FLORA générée, plan par plan, avec la prononciation « SiteLife » correcte.
- [ ] Chaque phrase commence après l'apparition de l'élément décrit.
- [ ] SRT calé sur l'audio final (les durées actuelles sont des estimations).
- [ ] Musique à −24 dB sous la voix.

## Validation
- [ ] Relecture par Edgar (fond)
- [ ] Relecture par un résident test (compréhension sans aide)
- [ ] Export final MP4 1080p, nommé `T05_signaler_incident_v1.mp4`
