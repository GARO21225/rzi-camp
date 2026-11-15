# T17 : checklist de validation avant publication (FR et EN)

## Fidélité fonctionnelle
- [x] Scans réels par l'API (`/api/qr/scan/`) : validé, déjà pris, non reconnu ; QR décodé par l'application elle-même (caméra simulée).
- [x] Restaurant créé et flasheur affecté par l'API (comme le Camp Boss) ; scans antérieurs du jour par l'API de scan.
- [x] Compteurs exacts (correction de l'adresse de l'API) ; version anglaise traduite par l'application (corrections du dictionnaire).

## Données et confidentialité
- [x] Résidents (Aya, Mariam, Konan DEMO), flasheur (Koffi DEMO), « Restaurant DÉMO » : fictifs.
- [x] QR signés avec la clé de l'instance locale (`SECRET_KEY` de démonstration) : inutilisables en production.

## Image, son, sous-titres
- [x] Voix FLORA FR (14) et EN (14), voix Charon · SRT FR et EN recalés sur la voix · exports `T17_flasheurs_scan_v1.mp4` et `T17_flasheurs_scan_EN_v1.mp4`.
- [ ] Logo HD officiel · relecture de la version anglaise par un anglophone du site.
