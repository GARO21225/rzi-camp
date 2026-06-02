# 🏔 RZI CAMP — ERP GIS Industriel
## Roxgold Côte d'Ivoire · Charte graphique officielle

Système de gestion intégré pour la résidence **Roxgold Sango** (Côte d'Ivoire).
Architecture full-stack : Django REST API + React/Vite.

---

## 🎨 Charte graphique Roxgold CI

Couleurs extraites du logo officiel (`roxgold-logo.png`) :

| Token | Valeur | Usage |
|---|---|---|
| `--roxgold-blue` | `#303080` | Bleu marine signature |
| `--roxgold-blue-dark` | `#1e1e5e` | Sidebar, header gradient |
| `--roxgold-gold` | `#f0b010` | Or du logo (badges, bordures) |
| `--roxgold-orange` | `#e87722` | Pastille "RZ", item actif |

Toutes les variables CSS de l'app pointent vers ces tokens.

---

## 📁 Structure

```
rzi-camp/
├── backend/           ← Django REST API (Python)
│   ├── accounts/      ← Profils utilisateurs + RBAC
│   ├── evenements/    ← Événements + notifications temps réel
│   ├── induction/     ← Workflow d'onboarding employés
│   ├── maintenance/   ← Incidents terrain
│   ├── restauration/  ← QR anti-fraude + audit repas
│   ├── residences/    ← Bâtiments (204 polygones)
│   ├── manage.py
│   └── requirements.txt
│
├── frontend/          ← React 18 + Vite + Leaflet
│   ├── src/
│   │   ├── pages/     ← Login, Dashboard, Map, Résidences, etc.
│   │   ├── components/← Layout, Sidebar, EventNotifBanner…
│   │   ├── api/       ← Client Axios + intercepteurs JWT
│   │   ├── index.css  ← 🎨 Charte Roxgold (variables CSS)
│   │   ├── theme.css  ← 🌙 Mode sombre aligné Roxgold
│   │   └── store.js   ← Zustand state management
│   ├── public/        ← Assets (logo, manifest, favicon)
│   └── package.json
│
├── roxgold-logo.png   ← Logo officiel
├── render.yaml        ← Config Render (Blueprint)
├── docker-compose.yml ← Orchestration locale
└── README.md
```

---

## 🚀 Démarrage local

### Backend
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_db
python manage.py runserver
```
→ http://localhost:8000

### Frontend
```bash
cd frontend
npm install
# Créer .env :  VITE_API_URL=http://localhost:8000
npm run dev
```
→ http://localhost:5173

---

## 🔐 Comptes démo

| Login | Mot de passe | Rôle |
|-------|-------------|------|
| admin | admin123 | Admin |
| manager | manager123 | Manager Camp |
| agent | agent123 | Agent Terrain |
| resto | resto123 | Restauration |

---

## ☁️ Déploiement Render

Le `render.yaml` est configuré en **Blueprint** (2 services + 1 base PostgreSQL) :

| Service | Type | rootDir | Runtime |
|---|---|---|---|
| `rzi-camp-backend` | web | `backend` | Python |
| `rzi-camp-frontend` | web (static) | `frontend` | Node |
| `rzi-camp-db` | database | — | PostgreSQL |

### Procédure
1. Pousser le code sur GitHub (voir ci-dessous)
2. Sur https://dashboard.render.com → **New → Blueprint**
3. Sélectionner le repo GitHub
4. Render lit `render.yaml` et crée les 3 ressources

---

## 📤 Pousser sur GitHub

```bash
git init
git add .
git commit -m "feat: initial commit — RZI CAMP avec charte Roxgold CI"
git branch -M main
git remote add origin https://github.com/GARO21225/Roxgold.git
git push -f origin main
```

---

## 🌐 API Endpoints

```
POST /api/auth/login/             ← JWT login
GET  /api/auth/me/                ← Profil utilisateur
GET  /api/batiments/              ← Liste bâtiments (filtrables)
GET  /api/batiments/geojson/      ← GeoJSON pour Leaflet
GET  /api/batiments/stats/        ← KPIs statistiques
PATCH /api/batiments/{id}/        ← Modifier statut/occupant
GET  /api/incidents/              ← Liste incidents
POST /api/incidents/              ← Créer incident
POST /api/incidents/{id}/resoudre/← Résoudre incident
POST /api/qr/generer/             ← Générer QR token
POST /api/qr/scanner/             ← Valider QR (anti-fraude)
GET  /api/repas/                  ← Journal repas
GET  /api/audit/                  ← Audit trail complet
```

---

## 🗺️ Shapefile

- Source : `Rox_RZEI.shp` (Camp RZI)
- 204 polygones bâtiments
- CRS : EPSG:32629 → converti en WGS84 (EPSG:4326)
- Stocké en JSON dans PostgreSQL (champ `geojson_geometry`)
- Servi via `/api/batiments/geojson/` → Leaflet GeoJSON

---

## 🎨 Charte graphique — détail

Les couleurs Roxgold sont définies dans `frontend/src/index.css` au début du `:root` :

```css
:root {
  --roxgold-blue:       #303080;
  --roxgold-blue-dark:  #1e1e5e;
  --roxgold-blue-light: #e8eaf5;
  --roxgold-navy:       #0a1628;

  --roxgold-gold:       #f0b010;
  --roxgold-gold-soft:  #fcd34d;
  --roxgold-gold-light: #fef3c7;
  --roxgold-orange:     #e87722;
  --roxgold-orange-dark:#c25a18;
}
```

Toutes les autres variables (`--blue`, `--gold`, `--orange`, etc.) pointent vers ces tokens Roxgold. Pour modifier la charte, il suffit de changer ces valeurs.
