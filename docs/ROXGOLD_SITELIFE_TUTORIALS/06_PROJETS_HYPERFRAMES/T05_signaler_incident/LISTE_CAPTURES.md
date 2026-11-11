# T05 : captures d'écran

Toutes les captures sont des **captures réelles** de l'application (branche `main`, novembre 2026), prises le 11/11/2026 sur une **instance locale de démonstration** (base SQLite vierge, jamais la production). Appareil émulé : iPhone 13 (390 × 844 pt, ×3). Données entièrement fictives : compte `demo.resident`, « Aya DEMO », société « DEMO SARL », résidence « DEMO-A02 ». Aucune donnée personnelle ni du site.

| Fichier | Plan | Contenu |
|---|---|---|
| `captures/03_accueil.png` | P04 | Accueil résident, barre d'onglets (Accueil, Voyages, Demandes, Repas, **Signaler**, Plus) |
| `captures/04_maintenance_liste.png` | P03, P05 | Page Maintenance vide, bouton doré **+** |
| `captures/05_formulaire_vide.png` | P06 | Formulaire « Déclarer un incident » vide |
| `captures/06_titre.png` | P07 | Titre saisi : « Climatiseur en panne » |
| `captures/07_description_categorie_priorite.png` | P08 | Description, catégorie Climatisation, priorité Haute |
| `captures/08_lieu_et_envoi.png` | P09, P10 | Type de lieu, résidence DEMO-A02, bloc, photo, bandeau délai, bouton d'envoi |
| `captures/09_incident_declare.png` | P11 | Liste avec l'incident : Haute · Déclaré · SLA |
| `captures/10_detail_incident.png` | P12 | Détail de l'incident, parcours en 5 étapes |

## À reprendre avant la version finale

- `03_accueil.png` affiche « **Bonne nuit, Aya** » parce que la capture a été prise vers minuit. Il faut la refaire en journée pour avoir « Bonjour ».
- Facultatif : une capture avec **photo jointe** (« ✅ Photo ajoutée »), avec une photo de démonstration neutre.

## Reproduire les captures

Le script `capture_t05.js` (dans ce dossier) les refait automatiquement sur l'instance de démo :

```bash
cd backend && DEBUG=True python manage.py migrate && DEBUG=True python manage.py shell < ../docs/ROXGOLD_SITELIFE_TUTORIALS/06_PROJETS_HYPERFRAMES/T05_signaler_incident/seed_demo.py
```

```bash
cd backend && DEBUG=True daphne -b 127.0.0.1 -p 8000 rzi_camp.asgi:application
```

```bash
cd frontend && VITE_API_URL=http://127.0.0.1:8000 npx vite --port 5173 --host 127.0.0.1
```

```bash
cd frontend && node ../docs/ROXGOLD_SITELIFE_TUTORIALS/06_PROJETS_HYPERFRAMES/T05_signaler_incident/capture_t05.js
```

Utiliser Daphne et non `runserver` : c'est Daphne qui applique les en-têtes CORS du projet (voir `CLAUDE.md`, règle 6).
