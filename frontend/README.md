# RZI CAMP 2.0 — Frontend React (Refonte V2)

> Refonte complète de l'UI RZI CAMP · Design system Roxgold (bleu marine + jaune) · React 18 + Vite · **Mobile-ready** · **Vitest** · **ESLint 9**

---

## ✨ Ce qui a été livré (session 2026-06)

### 1. Refonte UI Roxgold
- **27 pages React** (vs 22 dans l'original)
- **8 composants** : Layout, Sidebar, Topbar, AIFab, KpiCard, **ProgressBar**, **BarChart**, **MobileNav**
- Palette Roxgold (bleu `#003b7a` + jaune `#ffcd00` + orange `#e87722`) extraite du logo

### 2. Innovations UX
- **Progress bars** dans tous les KPIs (le "bar" oublié)
- **Bar charts horizontaux** pour comparaisons
- **Jumeau Numérique** avec vraie carte **Leaflet** + 204 bâtiments
- **Dark mode** persistant
- **Multi-langues** FR/EN/RU
- **Copilote IA** flottant + page dédiée
- **Kanban drag-drop** maintenance
- **POS** avec panier interactif
- **Scanner QR** animé
- **Audit immuable** avec hash chain
- **Status services** temps réel

### 3. **Mobile support** (NOUVEAU 🆕)
- **Bottom navigation** (5 items clés : Accueil, Jumeau, Tickets, Équipe, IA)
- **Drawer latéral** qui slide depuis la gauche
- Bouton hamburger dans la Topbar (visible < 1024px)
- **Safe-area insets** pour iOS notch
- Toutes les grilles deviennent 1-2 colonnes sur mobile

### 4. **Vitest** (NOUVEAU 🆕)
- Setup `jsdom` + `@testing-library/react`
- **4 fichiers de tests** :
  - `tests/buildings.test.js` — utils/buildings
  - `tests/format.test.js` — utils/format (date, status, percent)
  - `tests/components.test.jsx` — ProgressBar, KpiCard, BarChart
  - `tests/store.test.js` — Zustand store (auth, role, admin)
- Scripts : `npm run test`, `npm run test:watch`, `npm run test:coverage`

### 5. **Bug fixes** (attrapés par ESLint)
- `Login.jsx` : `err` → `error`, `doLogin` → `handleLogin`, `forgot` → `showForgot`
- `InductionPage.jsx` : `exportInductionCSV` remonté en module-level

---

## 🚀 Démarrage

```bash
cd rzi-camp-frontend-v2
npm install      # ~2 min
npm run dev      # http://localhost:5173
```

## 🧪 Tests

```bash
npm run test               # one-shot
npm run test:watch         # watch mode
npm run test:ui            # interface UI (http://localhost:51204)
npm run test:coverage      # coverage report
```

## 🛠️ Stack

- **React 18** + Vite 5
- **React Router 6** (lazy loading)
- **Zustand** (state)
- **Axios** (HTTP)
- **Leaflet + react-leaflet** (carte réelle)
- **Recharts + react-chartjs-2** (charts)
- **Lucide React** (icônes)
- **ESLint 9** (flat config)
- **Vitest 1** + jsdom + @testing-library/react

---

## 📁 Structure

```
rzi-camp-frontend-v2/
├── package.json
├── vite.config.js
├── vitest.config.js
├── eslint.config.js
├── index.html
├── README.md
├── src/
│   ├── App.jsx                    # Routes
│   ├── main.jsx
│   ├── index.css                  # Styles globaux
│   ├── design-system/
│   │   └── tokens.css             # CSS vars Roxgold
│   ├── components/
│   │   ├── Layout.jsx             # Shell (Sidebar + Topbar + Drawer + MobileNav)
│   │   ├── Sidebar.jsx            # Navigation (25 items) — supporte mode drawer
│   │   ├── Topbar.jsx             # Search + Lang + Theme + AI + Hamburger
│   │   ├── AIFab.jsx              # Copilote FAB flottant
│   │   ├── KpiCard.jsx            # KPI + sparkline + progress
│   │   ├── ProgressBar.jsx        # Le "bar" qui manquait
│   │   ├── BarChart.jsx           # BarChart horizontal
│   │   └── MobileNav.jsx          # 🆕 Bottom nav + Drawer
│   ├── pages/                     # 27 pages
│   │   ├── Dashboard.jsx          # ✨ Branché sur vraies données backend
│   │   ├── DigitalTwin.jsx        # Carte Leaflet réelle
│   │   ├── Login.jsx
│   │   ├── Maintenance.jsx        # Kanban 4 colonnes
│   │   ├── Boutique.jsx
│   │   ├── BoutiquePOS.jsx
│   │   ├── Voyages.jsx
│   │   └── ... (21 autres)
│   ├── store/useStore.js
│   ├── api/index.js
│   ├── hooks/
│   └── utils/
│       ├── buildings.js
│       └── format.js
└── tests/
    ├── setup.js                   # Mocks globaux (leaflet, localStorage, fetch)
    ├── buildings.test.js
    ├── format.test.js
    ├── components.test.jsx
    └── store.test.js
```

---

## 📱 Mobile breakpoints

| Largeur | Layout |
|---|---|
| `> 1024px` | Sidebar fixe + Topbar classique |
| `768px - 1024px` | Sidebar caché, **drawer** au tap du hamburger, **bottom nav** apparaît |
| `< 768px` | Idem, grilles passent à 1 colonne |

## 🐛 Corrections incluses

| Bug | Fix | Détecté par |
|---|---|---|
| `err is not defined` (Login.jsx) | `err` → `error` | ESLint `no-undef` |
| `handleLogin is not defined` | `doLogin` → `handleLogin` | ESLint `no-undef` |
| `showForgot is not defined` | `forgot` → `showForgot` | ESLint `no-undef` |
| `exportInductionCSV is not defined` | Déplacé en module-level | ESLint `no-undef` |
| Page blanche (MIME type error) | HTML self-contained, pas de `script type="module"` | Manuel |
| Pas de progress bars | `ProgressBar` ajouté partout | UX |
| Pas de carte réelle | `react-leaflet` intégré | UX |

---

## 🎨 Design system Roxgold

| Token | Valeur | Usage |
|---|---|---|
| `--copper-500/600` | `#0c4ea2 / #003b7a` | Bleu marine principal (CTA, sidebar) |
| `--gold-500` | `#ffcd00` | Jaune logo (filet sidebar, AI mark, QR) |
| `--orange-500` | `#e87722` | Orange logo (filet bas) |
| `--emerald-600` | `#16a34a` | Vert sémantique (succès) |
| `--ink-*` | Tons neutres | Backgrounds + texte |
| Font | Outfit + DM Serif Display | Remplace Inter |

**Top accent jaune** sur la sidebar (identique au logo), bouton primary bleu, accents jaunes (AI mark, QR scanner), ombres bleutées.

---

## 🔌 Branchement backend

Toutes les pages sont prêtes à se brancher sur `rzi-camp-backend.onrender.com`. Le `Dashboard` est déjà branché sur les vraies données :
- `batiments.list()` → 203 bâtiment
- `personnel.list()` → 20 personnes
- `incidents.list()` → 9 incidents
- `voyages.list()` → 2 voyages
- `evenements.list()` → événements

Pour brancher les autres pages : remplacer les `useState(MOCK)` par `useEffect` + `batiments.list()`.

---

## 📜 Licence

Propriétaire — Roxgold / RZI CAMP.
