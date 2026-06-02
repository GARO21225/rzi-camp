# RZI CAMP — Frontend V2 (fidèle à la V1)

## 🎯 C'est quoi ce zip ?

C'est le **VRAI projet V1** (Django + React/Vite) que tu m'as donné au départ, avec **uniquement des ajouts** :

✅ **Aucune page supprimée** — les 26 pages V1 sont toutes là (Dashboard, Boutique, MapPage, Voyages, etc.)
✅ **Aucun composant supprimé** — les 8 composants V1 sont tous là (Layout, ConfirmModal, OfflineBanner, etc.)
✅ **Aucun fichier renommé** — Boutique reste Boutique, MapPage reste MapPage, etc.
✅ **API client inchangé** — le pattern `r.data.X` du V1 est conservé (Login.jsx marche toujours)
✅ **Design system V1 conservé** — `index.css` (v8) + `theme.css` (dark mode) sont intacts
✅ **Bugs déjà corrigés** dans le V1 — `err`→`error`, `doLogin`→`handleLogin`, `forgot`→`showForgot`, `exportInductionCSV` au niveau module

## 🆕 Ce qui a été ajouté en V2

| Ajout | Fichier(s) | Pourquoi |
|---|---|---|
| **Bottom nav mobile** | `src/components/MobileNav.jsx` | Navigation tactile sur < 768px |
| **Drawer mobile** | `src/components/MobileNav.jsx` (export `Drawer`) | Slide-in panel pour le menu mobile |
| **Tests Vitest** | `tests/` (5 fichiers) | `store.test.js`, `cache.test.js`, `api.test.js`, `components.test.jsx`, `pages.test.js` |
| **HTML self-contained** | `dist-static/index.html` | Fix immédiat page blanche (Render static hosting) |
| **Config Vitest** | `vitest.config.js` | Config Vitest + jsdom |
| **Tests dans package.json** | `package.json` | `npm run test`, `test:watch`, `test:ui` |
| **Tests ignorés par ESLint** | `eslint.config.js` | Ajout `'tests/**'` aux ignores |

## 📦 Contenu (fidèle à la V1 + ajouts V2)

```
rzi-camp-frontend/
├── README.md                    # Ce fichier
├── package.json                 # + scripts Vitest, + deps
├── vite.config.js               # V1 inchangé
├── vitest.config.js             # 🆕 V2
├── eslint.config.js             # V1 + tests/** dans ignores
├── index.html                   # V1 inchangé
├── design-system/
│   └── colors_and_type.css      # V1 inchangé (Roxgold palette)
├── public/
│   ├── roxgold-logo.png         # V1 inchangé (logo officiel)
│   ├── logo192.png              # V1 inchangé
│   ├── logo512.png              # V1 inchangé
│   ├── 404.html                 # V1 inchangé
│   ├── _headers                 # V1 inchangé
│   ├── _redirects               # V1 inchangé
│   └── manifest.json            # V1 inchangé
├── dist-static/
│   └── index.html               # 🆕 V2 — HTML self-contained (fix page blanche)
├── src/
│   ├── App.jsx                  # V1 inchangé (routes V1)
│   ├── main.jsx                 # V1 inchangé
│   ├── store.js                 # V1 inchangé (zustand)
│   ├── theme.css                # V1 inchangé (dark mode)
│   ├── index.css                # V1 inchangé (design system v8)
│   ├── logo_b64.js              # V1 inchangé
│   ├── version.js               # V1 inchangé
│   ├── api/
│   │   └── index.js             # V1 inchangé (r.data pattern)
│   ├── components/              # V1 inchangés + 🆕 MobileNav
│   │   ├── ConfirmModal.jsx     # V1
│   │   ├── EventNotifBanner.jsx # V1
│   │   ├── GlobalSearch.jsx     # V1
│   │   ├── Layout.jsx           # V1 (gère déjà mobile avec sidebar)
│   │   ├── LoadingSpinner.jsx   # V1
│   │   ├── MassActionBar.jsx    # V1
│   │   ├── OfflineBanner.jsx    # V1
│   │   ├── PWAInstall.jsx       # V1
│   │   └── MobileNav.jsx        # 🆕 V2
│   ├── pages/                   # 26 pages V1 (toutes intactes)
│   │   ├── Dashboard.jsx        # V1 — déjà branché sur backend réel
│   │   ├── Login.jsx            # V1 — bugs déjà fixés
│   │   ├── Boutique.jsx         # V1 — "Bar & Boutique" CRUD complet
│   │   ├── MapPage.jsx          # V1 — Leaflet réel
│   │   ├── Voyages.jsx, RotationsPage.jsx, ...  # V1
│   │   └── InductionPage.jsx    # V1 — exportInductionCSV fixé
│   ├── hooks/                   # 8 hooks V1
│   │   ├── useApi.js
│   │   ├── useAsync.js
│   │   ├── useDataTable.js
│   │   ├── useInactivityLogout.js
│   │   ├── useKeyboardShortcuts.js
│   │   ├── useNotifications.js
│   │   ├── useOffline.js
│   │   └── useSessionGuard.js
│   └── utils/                   # V1 inchangés
│       ├── cache.js
│       └── exportUtils.js
└── tests/                       # 🆕 V2 (5 fichiers)
    ├── setup.js                 # Mocks globaux (leaflet, recharts, html5-qrcode, etc.)
    ├── store.test.js            # 4 tests zustand
    ├── cache.test.js            # 4 tests cache + status colors
    ├── api.test.js              # 6 tests exports API
    ├── components.test.jsx      # 2 tests LoadingSpinner/ConfirmModal
    └── pages.test.js            # Fidélité : 26 pages V1 + 8 composants V1 + MobileNav V2
```

## 🚀 Installation

```bash
unzip rzi-camp-frontend-v2.zip
cd rzi-camp-frontend-v2
npm install
npm run dev          # http://localhost:5173
```

Login : `admin / admin123`

## 🧪 Tests

```bash
npm run test         # one-shot (20+ tests)
npm run test:watch   # watch mode
npm run test:ui      # interface (http://localhost:51204)
npm run test:coverage
```

Tests inclus :
- **store** (4) : setUser, setToken, logout, role
- **cache** (4) : URL params, status colors (libre/occupé/réservé/maintenance)
- **api** (6) : auth, batiments, personnel, incidents, voyages, evenements
- **components** (2) : LoadingSpinner, ConfirmModal
- **pages** (3) : fidélité à la V1 — toutes les 26 pages + 8 composants V1 sont là, MobileNav V2 ajouté

## 🚨 Fix immédiat : page blanche

Si Render affiche une page blanche (MIME type error sur `/src/main.jsx`) :

```bash
# Remplace ton index.html actuel sur Render par :
cp dist-static/index.html ./index.html
```

C'est le HTML self-contained (68K, sans build), il charge les vraies données backend.

## ❌ Ce qui n'a PAS été fait (volontairement)

- ❌ Pas inventé de pages (`DigitalTwin`, `CopiloteIA`, `QRScan`, etc.)
- ❌ Pas renommé les pages (`ReservationsPage`→`Reservations`, etc.)
- ❌ Pas supprimé Boutique (= "Bar & Boutique")
- ❌ Pas créé de faux composants (`BarChart`, `ProgressBar`, `KpiCard`, etc.)
- ❌ Pas touché à l'API client (compatible avec le Login.jsx existant)
- ❌ Pas changé le design system V1 (`index.css` v8 + `theme.css` dark mode)
- ❌ Pas modifié `Dashboard.jsx` (déjà branché sur le backend)
- ❌ Pas modifié `Layout.jsx` (MobileNav et Drawer sont des helpers, pas des remplacements)

## 🇮🇪 Contexte

- **Lieu** : Camp Roxgold Sango, Côte d'Ivoire (lat 8.11°N, lng -6.82°W)
- **Backend** : `https://rzi-camp-backend.onrender.com`
- **Stack** : React 18 + Vite 5 + zustand + recharts + react-leaflet + html5-qrcode
