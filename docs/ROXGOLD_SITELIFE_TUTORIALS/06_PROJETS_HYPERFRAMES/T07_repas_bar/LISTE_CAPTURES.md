# T07 : captures d'écran

Captures **réelles** prises le 11/11/2026 sur l'instance locale de démonstration (jamais la production), iPhone 13 émulé, navigateur en français, profil résident (Aya DEMO, « agent »).

| Fichier | Plan | Contenu |
|---|---|---|
| `01_accueil.png` | P04 | Accueil, onglet « Repas » de la barre du bas |
| `02_mon_qr.png` | P03, P05 | Repas : « Mon QR Restaurant », à présenter au restaurant |
| `03_menu_du_jour.png` | P06 | Menu du jour : petit-déjeuner, déjeuner, dîner |
| `04_horaires.png` | P07 | Horaires des repas |
| `05_plus_bar.png` | P08 | Menu « Plus », tuile « Bar » |
| `06_bar_bon.png` | P09 | Mon bar : bon de caisse de l'année, total du mois |
| `07_bar_carte.png` | P10 | La carte : recherche, catégories, prix, disponibilité |
| `08_bar_boissons.png` | P11 | Filtre « Boissons », article « Épuisé » |
| `09_consommations.png` | P12 | Mes consommations : date, heure, mode de paiement, montant |

## Reproduire

Prérequis : bases de démo T05 et T03, Daphne et Vite lancés (voir `T05_signaler_incident/LISTE_CAPTURES.md`).

```bash
cd backend && DEBUG=True python manage.py shell < ../docs/ROXGOLD_SITELIFE_TUTORIALS/06_PROJETS_HYPERFRAMES/T07_repas_bar/seed_demo_t07.py
```

```bash
cd frontend && cp ../docs/ROXGOLD_SITELIFE_TUTORIALS/06_PROJETS_HYPERFRAMES/T07_repas_bar/capture_t07.js _cap.cjs && node _cap.cjs; rm _cap.cjs
```

(Le script est en CommonJS alors que `frontend/package.json` déclare `"type": "module"` : d'où la copie en `.cjs`. Remplacer `__dirname` par le chemin du dossier T07 dans la copie.)
