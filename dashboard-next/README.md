# RZI Camp — Dashboard Next.js

## Stack
- **Next.js 14** (App Router)
- **Tailwind CSS** (design tokens Shadcn/UI)
- **Lucide React** (icônes)
- **Recharts** (graphiques)

## Installation

```bash
cd dashboard-next
npm install
npm run dev
# → http://localhost:3000
```

## Variables d'environnement

```env
# .env.local
NEXT_PUBLIC_API_URL=https://rzi-camp-backend.onrender.com
```

## Déploiement Vercel (recommandé)

```bash
npx vercel
# Set NEXT_PUBLIC_API_URL dans Vercel dashboard
```

## Structure

```
src/
  app/
    layout.tsx          ← Root layout
    dashboard/
      layout.tsx        ← Layout avec sidebar
      page.tsx          ← Dashboard principal ← VOUS ÊTES ICI
  components/
    Sidebar.tsx         ← Navigation
    Topbar.tsx          ← Barre du haut
    ui/
      card.tsx          ← Shadcn Card
      badge.tsx         ← Shadcn Badge
      button.tsx        ← Shadcn Button
      progress.tsx      ← Barre de progression
      separator.tsx     ← Séparateur
  lib/
    api.ts              ← Client API (JWT auto)
    utils.ts            ← Helpers (cn, formatDate...)
```

## API connectée (backend Render)
- `GET /api/batiments/stats/` → occupation
- `GET /api/personnel/?page_size=200` → induction
- `GET /api/incidents/stats-sql/` → incidents
- `GET /api/voyages/stats/` → rotations
- `GET /api/notifications/compteur/` → alertes
