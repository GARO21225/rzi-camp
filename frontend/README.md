# 🏔 RZI CAMP — ERP GIS Industriel
## Architecture Full-Stack : Django REST API + React/Vite

---

## 📁 STRUCTURE
```
rzi-camp/
├── backend/          ← Django REST API
│   ├── rzi_camp/     ← Settings, URLs, WSGI
│   ├── residences/   ← Modèle Batiment (204 shapefiles)
│   ├── maintenance/  ← Incidents terrain
│   ├── restauration/ ← QR anti-fraude + Audit
│   ├── accounts/     ← Profils + RBAC
│   ├── manage.py
│   └── requirements.txt
└── frontend/         ← React 18 + Vite + Leaflet
    ├── src/
    │   ├── pages/    ← Login, Dashboard, Map, Résidences, etc.
    │   ├── components/Layout.jsx
    │   ├── api/      ← Client Axios + intercepteurs JWT
    │   └── store.js  ← Zustand state management
    └── package.json
```

---

## 🚀 DÉMARRAGE LOCAL

### Backend
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_db        # charge 204 bâtiments + 4 comptes
python manage.py runserver      # http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
# Créer .env :  VITE_API_URL=http://localhost:8000
npm run dev                     # http://localhost:5173
```

---

## 🔐 COMPTES DEMO
| Login | Mot de passe | Rôle |
|-------|-------------|------|
| admin | admin123 | Admin |
| manager | manager123 | Manager Camp |
| agent | agent123 | Agent Terrain |
| resto | resto123 | Restauration |

---

## ☁️ HÉBERGEMENT

### Backend → Railway (recommandé)
1. Pousser `backend/` sur GitHub
2. New Project sur railway.app → Deploy from GitHub
3. Add PostgreSQL service
4. Variables d'environnement :
   ```
   SECRET_KEY=votre-cle-secrete
   DATABASE_URL=(auto depuis Railway PostgreSQL)
   DEBUG=False
   ```
5. Le `Procfile` gère automatiquement : migrate + seed_db + gunicorn

### Frontend → Netlify / Vercel
1. Créer `.env` dans `frontend/` :
   ```
   VITE_API_URL=https://votre-backend.railway.app
   ```
2. Build : `npm run build`
3. Deploy le dossier `dist/` sur Netlify ou Vercel

---

## 🌐 API ENDPOINTS
```
POST /api/auth/login/           ← JWT login
GET  /api/auth/me/              ← Profil utilisateur
GET  /api/batiments/            ← Liste bâtiments (filtrables)
GET  /api/batiments/geojson/    ← GeoJSON pour Leaflet
GET  /api/batiments/stats/      ← KPIs statistiques
PATCH /api/batiments/{id}/      ← Modifier statut/occupant
GET  /api/incidents/            ← Liste incidents
POST /api/incidents/            ← Créer incident
POST /api/incidents/{id}/resoudre/ ← Résoudre incident
POST /api/qr/generer/           ← Générer QR token
POST /api/qr/scanner/           ← Valider QR (anti-fraude)
GET  /api/repas/                ← Journal repas
GET  /api/audit/                ← Audit trail complet
```

---

## 🗺️ SHAPEFILE
- Source : `Rox_RZEI.shp` (Camp RZI)
- 204 polygones bâtiments
- CRS : EPSG:32629 → converti en WGS84 (EPSG:4326)
- Stocké en JSON dans PostgreSQL (champ `geojson_geometry`)
- Servi via `/api/batiments/geojson/` → Leaflet GeoJSON
