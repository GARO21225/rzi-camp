# RZI CAMP — Design System v2.0

> Concept de refonte UX/UI — *non-breaking* : coexiste avec le design system v1 (`colors_and_type.css`).
> **Palette extraite du logo Roxgold** : bleu marine + jaune + blanc.

---

## 📁 Fichiers

| Fichier | Rôle |
|---|---|
| `tokens.css` | Toutes les CSS variables + composants réutilisables (`.card`, `.btn`, `.badge`, `.input`, `.kpi`, …) |
| `README.md` | Ce fichier |

---

## 🎨 Changements vs v1

| Token | v1 | v2 |
|---|---|---|
| **Font principale** | Inter | **Outfit** (+ DM Serif Display + JetBrains Mono) |
| **Couleur primaire** | `--rzi-blue: #1e3a8a` (bleu corporate) | **Bleu marine Roxgold `#003b7a`** (extraite du logo) |
| **Couleur accent** | `--rzi-gold: #f0a500` | **Jaune Roxgold `#ffcd00`** (filet du logo) |
| **Accent tertiaire** | — | **Orange `#e87722`** (filet bas du logo) |
| **Succès** | green (pas formellement défini) | `--emerald-600: #16a34a` (vert sémantique) |
| **Fond** | `#f1f5f9` (slate froid) | `#f5f8fc` (bleuté très clair) |
| **Texte** | `#1e293b` | `#001e42` (bleu marine foncé) |
| **Radius** | 10–16px | 10–28px (plus généreux) |
| **Ombres** | Plates | Diffuses bleutées, multi-couches |
| **Dark mode** | ❌ absent | ✅ `[data-theme="dark"]` (deep navy) |
| **Multi-langue** | ❌ | ✅ préparé (extraction i18next à faire) |
| **Filet jaune sidebar** | ❌ | ✅ identique au logo Roxgold |

---

## 🚀 Utilisation

### Option 1 — Remplacer intégralement v1

Dans `frontend/index.html`, remplacer :

```html
<link rel="stylesheet" href="/design-system/colors_and_type.css" />
```

par :

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Serif+Display&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/design-system/v2/tokens.css" />
```

Puis, dans `frontend/src/index.css`, retirer les variables `:root` redéfinies (elles sont déjà dans `tokens.css`).

### Option 2 — Coexistence (recommandé pour migration progressive)

Garder v1 actif, mais importer aussi v2 en surcharge :

```html
<link rel="stylesheet" href="/design-system/colors_and_type.css" />
<link rel="stylesheet" href="/design-system/v2/tokens.css" />
```

Les composants qui utilisent les nouvelles classes (`.card`, `.kpi`, etc.) adopteront le look v2 sans casser l'existant.

### Option 3 — Dark mode

```html
<body data-theme="light">  <!-- ou "dark" -->
```

```js
// Toggle depuis la topbar
document.body.setAttribute('data-theme',
  document.body.getAttribute('data-theme') === 'light' ? 'dark' : 'light'
);
```

---

## 🧩 Composants prêts à l'emploi

```jsx
// KPI card
<div className="card kpi">
  <div className="kpi-label">Occupation</div>
  <div className="kpi-value">847 / 920</div>
  <span className="kpi-delta up">↑ 2.4%</span>
  <svg className="kpi-spark spark" viewBox="0 0 100 36" preserveAspectRatio="none">
    <polyline fill="none" stroke="var(--emerald-500)" strokeWidth="2"
      points="0,28 10,22 20,24 30,18 40,20 50,14 60,16 70,10 80,12 90,8 100,6"/>
  </svg>
</div>

// Boutons
<button className="btn btn-primary">Action principale</button>
<button className="btn btn-ghost">Secondaire</button>
<button className="btn btn-ok">Validation</button>

// Badges
<span className="badge badge-ok">Occupé</span>
<span className="badge badge-warn">Maintenance</span>
<span className="badge badge-alert">Critique</span>
<span className="badge badge-copper">Prédictif</span>

// Status dot
<span className="dot dot-pulse dot-ok" />
```

---

## 📐 Spacing scale

| Token | Valeur | Usage |
|---|---|---|
| `8px` | tight | Icones / inline |
| `12px` | small | Badge padding |
| `16px` | base | Card padding-small |
| `20px` | medium | Card padding-default |
| `28px` | large | Card padding-large |
| `40px` | xl | Section gap |
| `64px` | xxl | Hero gap |

---

## 🔄 Roadmap de migration v1 → v2

| Étape | Fichier | Effort |
|---|---|---|
| 1. Importer les fonts + tokens v2 | `frontend/index.html` + `src/index.css` | 30 min |
| 2. Migrer le Login | `src/pages/Login.jsx` | 1h |
| 3. Migrer la Layout + Sidebar | `src/components/Layout.jsx` | 2h |
| 4. Migrer Dashboard | `src/pages/Dashboard.jsx` | 3h |
| 5. Migrer Map → Digital Twin v2 | `src/pages/MapPage.jsx` | 1j |
| 6. Migrer Maintenance Kanban | `src/pages/Maintenance.jsx` | 4h |
| 7. Activer dark mode | `+ data-theme` toggle | 1h |
| 8. i18n FR/EN/RU | `+ i18next` | 1j |

Total estimé : **6-8 jours** pour une migration complète.
