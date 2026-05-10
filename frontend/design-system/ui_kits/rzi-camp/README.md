# RZI Camp UI Kit

High-fidelity recreation of the RZI Camp web app (single product).

## Files

- `index.html` — interactive click-thru of the app: login → dashboard → residences list → residence detail. Sidebar navigation switches between Dashboard, Résidences, Maintenance, Voyages.
- `Sidebar.jsx` — navy sidebar with emoji nav, active highlight, role section dividers.
- `KpiCard.jsx` — top-border accent KPI tile with mono number.
- `HeroBanner.jsx` — gradient header banner with logo plate + headline number.
- `AlertBanner.jsx` — tinted single-line alert with optional CTA arrow.
- `StatusPill.jsx` — pill chips for Libre/Occupé/Réservé/Maintenance.
- `ResidenceList.jsx` / `ResidenceDetail.jsx` — example data screens.
- `LoginScreen.jsx` — gradient bg auth screen.

## Recreating, not redesigning

Pixel matches taken from `frontend/src/pages/{Login,Dashboard,Layout}.jsx` and `frontend/src/index.css` in the rzi-camp repo. Where the source uses inline px values, this kit also does. Where the source uses emoji as iconography, this kit does too — no SVG icon set is introduced.
