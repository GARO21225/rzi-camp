# T17 : captures d'écran (FR et EN)

Captures **réelles** prises le 15/11/2026 sur l'instance locale de démonstration (jamais la production), iPhone 13 émulé, compte flasheur (Koffi DEMO, rôle « restauration »), application en français (`captures/fr/`) puis en anglais (`captures/en/`, sélecteur de langue de l'application).

Le scan est réel : Chromium reçoit une **caméra simulée** (`--use-file-for-fake-video-capture`), une vidéo de 9 s de fond gris puis 4 s du QR de démonstration, en boucle. L'application décode le QR et l'envoie à l'API de scan.

| Fichier | Plan | Contenu |
|---|---|---|
| `01_accueil.png` | P04 | Accueil du flasheur, onglet Repas / Meals |
| `02_repas_haut.png` | P05 | Restaurant, repas en cours, compteurs du jour |
| `03_scanner_actif.png` | P03, P06 | Scanner actif / Scanner on |
| `04_scan_valide.png` | P07 | Écran vert : DEMO AYA validée |
| `05_avis_rapide.png` | P08 | « Comment était le repas ? » / « How was the meal? » |
| `06_deja_pris.png` | P09 | Écran orange : Déjà pris / Already taken |
| `09_non_reconnu.png` | P10 | Écran rouge : Non reconnu / Not recognised |
| `07_historique.png` | P11 | Historique du jour |
| `08_compteurs_apres.png` | P12 | Compteurs mis à jour (5 repas) |

## Reproduire

Daphne et le jeu de démo doivent partager la **même** `SECRET_KEY` (sinon la signature des QR diffère et tout scan est refusé) :

```bash
cd backend && SECRET_KEY=demo-locale-tutoriels-non-secrete DEBUG=True daphne -b 127.0.0.1 -p 8000 rzi_camp.asgi:application
```

```bash
cd backend && SECRET_KEY=demo-locale-tutoriels-non-secrete QR_DIR=/chemin/cam DEBUG=True python manage.py shell < ../docs/ROXGOLD_SITELIFE_TUTORIALS/06_PROJETS_HYPERFRAMES/T17_flasheurs_scan/seed_demo_t17.py
```

Vidéos de la caméra simulée (dans le même dossier `/chemin/cam`) :

```bash
cd /chemin/cam && for n in aya inconnu; do ffmpeg -y -f lavfi -i "color=c=0xE5E7EB:s=640x480:r=15:d=9" -loop 1 -t 4 -r 15 -i qr_$n.png -filter_complex "[1:v]scale=380:380,pad=640:480:130:50:color=0xE5E7EB,setsar=1[q];[0:v]setsar=1[b];[b][q]concat=n=2:v=1,format=yuv420p" cam_$n.y4m; done
```

Puis, pour chaque langue (relancer le jeu de démo avant chacune) :

```bash
cd frontend && cp ../docs/ROXGOLD_SITELIFE_TUTORIALS/06_PROJETS_HYPERFRAMES/T17_flasheurs_scan/capture_t17.js _cap.cjs && LANGUE=fr CAM_DIR=/chemin/cam node _cap.cjs; rm _cap.cjs
```

(Remplacer `__dirname` par le chemin du dossier T17 dans la copie ; `LANGUE=en` pour la version anglaise.)
