# Refonte rzi-camp — Phases 1 + 2

## Fichiers à pousser
Copie `refonte/frontend/src/*` → `frontend/src/*` (écrase l'existant).

| Fichier | Phase | Changements |
|---|---|---|
| `index.css` | 1 | `@import` du design system + alias legacy preservés |
| `pages/Login.jsx` | 1 | Logo via import PNG (plus de base64), couleurs via vars CSS |
| `components/Layout.jsx` | 2 | Logo via import PNG, toutes couleurs via vars CSS, structure préservée |

## Prérequis
- `frontend/design-system/` existe (déjà poussé)
- Le bundler Vite résout les imports `../../design-system/...` depuis `src/` — c'est le cas par défaut

## Vérification post-push
```bash
cd frontend && npm run dev
```
1. `/login` — visuellement identique, fichier `Login.jsx` ~3× plus petit
2. Header navy + bordure dorée — identique
3. Sidebar — identique
4. Notifications, alertes, logout — identiques

## Gain
- **-80k chars** de base64 inline retirés du bundle
- Cohérence : changer `--rzi-blue` dans `colors_and_type.css` se propage partout
- Lisibilité du code : couleurs nommées (`var(--rzi-blue)`) au lieu de hex magic

## Risques connus
- Si Vite n'aime pas l'import PNG, ajoute `import.meta.url` ou place le PNG dans `public/`
- Le composant `NotifPanel` perd la prop `prochainEvt` qui n'était pas utilisée dans le JSX

## Phase 3 (optionnelle)
- `Dashboard.jsx` (47k chars — même blob base64 à virer)
- Pages secondaires
