# T07 : checklist de validation avant publication

## Fidélité fonctionnelle
- [x] Vue résident filmée (profil « agent »), pas la vue équipe restauration ni gérant du bar.
- [x] Menu, articles et bon créés par la vraie API (administrateur de démo) ; consommations selon la logique de la caisse.
- [x] Affirmations vérifiées dans le code : QR signé à son nom, menu du jour (plats disponibles), horaires du Paramétrage, bon de caisse annuel, « Épuisé » quand le stock est à zéro, filtre par catégorie, historique des consommations.

## Données et confidentialité
- [x] Résidente (Aya DEMO), société (DEMO SARL), plats, articles et prix : fictifs.
- [x] QR de démonstration, signé avec la clé de l'instance locale : inutilisable en production.
- [ ] Horaires des repas et du bar affichés : ceux de la base de démo, à confirmer avant diffusion.

## Image, son, sous-titres
- [x] Voix FLORA (14 fichiers, voix Charon) · SRT recalé sur la voix · export `T07_repas_bar_v1.mp4`.
- [ ] Logo HD officiel · illustration du constat (optionnelle).

## Défaut relevé (non corrigé, à arbitrer)
- [ ] « Mes consommations » : mode de paiement Mobile Money / crédit affiché en code brut (`om`, `wave`, `mtn`, `moov`, `credit`).
