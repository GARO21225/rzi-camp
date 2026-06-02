# RZI CAMP — Frontend v1.0 (corrigé)

## 🎯 C'est quoi ce zip ?

Le **vrai** projet V1 (Django + React/Vite) que tu m'as donné au départ, avec :

✅ **TOUTES les pages originales** conservées (26 pages, aucune supprimée)
- Boutique (Bar & Boutique, CRUD complet)
- MapPage (carte Leaflet)
- Voyages, Rotations, Residences, etc.

✅ **Les 4 bugs déjà corrigés** dans le V1 :
- `err` → `error` dans Login.jsx
- `doLogin` → `handleLogin` dans Login.jsx
- `forgot` → `showForgot` dans Login.jsx
- `exportInductionCSV` déclaré au niveau module dans InductionPage.jsx

✅ **ESLint 9 flat config** déjà en place (aurait attrapé les 3 premiers bugs)

✅ **Logo Roxgold original** : `public/roxgold-logo.png` (29K)

✅ **Contexte Côte d'Ivoire** (camp Roxgold Sango, lat 8.11°N, lng -6.82°W)

## 📦 Contenu

```
rzi-camp-frontend/
├── package.json (avec vitest ajouté)
├── vite.config.js
├── vitest.config.js              # NOUVEAU
├── eslint.config.js               # VRAI config V1 (déjà OK)
├── index.html                     # VRAI index.html V1
├── README.md                      # Ce fichier
├── public/
│   └── roxgold-logo.png           # Logo Roxgold original
├── dist-static/
│   └── index.html                 # FIX IMMÉDIAT : HTML self-contained (108K, no build)
├── src/
│   ├── App.jsx                    # Routes V1 originales
│   ├── main.jsx                   # VRAI main.jsx V1
│   ├── store.js                   # zustand store
│   ├── api/index.js               # VRAI api V1
│   ├── components/                # 8 composants V1 originaux
│   │   ├── ConfirmModal.jsx
│   │   ├── EventNotifBanner.jsx
│   │   ├── GlobalSearch.jsx
│   │   ├── Layout.jsx
│   │   ├── LoadingSpinner.jsx
│   │   ├── MassActionBar.jsx
│   │   ├── OfflineBanner.jsx
│   │   └── PWAInstall.jsx
│   ├── pages/                     # 26 pages V1 originales
│   │   ├── Dashboard.jsx
│   │   ├── Login.jsx              # ✅ Bugs fixés
│   │   ├── Boutique.jsx           # "Bar & Boutique" CRUD complet
│   │   ├── MapPage.jsx            # Carte Leaflet réelle
│   │   ├── Voyages.jsx, RotationsPage.jsx, ...
│   │   └── InductionPage.jsx      # ✅ exportInductionCSV au niveau module
│   ├── hooks/                     # 8 hooks V1
│   └── utils/                     # cache, exportUtils
└── tests/                         # NOUVEAU
    ├── setup.js                   # mocks globaux
    ├── store.test.js              # 4 tests (zustand)
    ├── cache.test.js              # 4 tests (cache + status colors)
    ├── api.test.js                # 6 tests (exports API)
    └── components.test.jsx        # 2 tests (LoadingSpinner, ConfirmModal)
```

## 🚀 Installation

```bash
unzip rzi-camp-frontend.zip
cd rzi-camp-frontend
npm install
npm run dev          # http://localhost:5173
```

## 🧪 Tests

```bash
npm run test         # one-shot
npm run test:watch   # watch mode
npm run test:ui      # interface (http://localhost:51204)
```

**16 tests** sur 4 fichiers : store zustand, cache, exports API, composants.

## 🚨 Fix immédiat : page blanche

Si Render affiche une page blanche (MIME type error sur `/src/main.jsx`) :

```bash
# Remplace ton index.html actuel sur Render par :
cp dist-static/index.html ./index.html
```

C'est le HTML self-contained (108K), pas de build nécessaire, charge les vraies données.

## ✅ Ce que j'ai PAS fait (contrairement aux versions précédentes)

❌ Pas inventé de pages (DigitalTwin, CopiloteIA, QRScan, etc.)
❌ Pas renommé les pages (ReservationsPage → Reservations, etc.)
❌ Pas supprimé Boutique (= Bar & Boutique)
❌ Pas modifié le VRAI design system Roxgold du V1
❌ Pas ajouté de composants inventés (BarChart, ProgressBar, KpiCard, MobileNav, etc.)
❌ Pas changé le contexte géographique (Côte d'Ivoire, pas Burkina Faso)
❌ Pas touché à l'API client (reste compatible avec Login.jsx existant)
