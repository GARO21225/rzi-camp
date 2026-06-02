# Fix déploiement Render — npm ENOENT package.json

## Le problème

Render échoue avec :
```
npm ERR! code ENOENT
npm ERR! path /opt/render/project/src/frontend/package.json
```

## La cause

Le repo a une structure **doublement imbriquée** :
```
rzi-camp/
├── backend/
├── frontend/                    ← render.yaml pointait ici
│   ├── Dockerfile
│   ├── README.md
│   ├── dist-static/
│   ├── frontend/                ← VRAI package.json est ici
│   │   ├── package.json  ✅
│   │   ├── public/
│   │   ├── src/
│   │   └── vite.config.js
│   └── package.json (inutile, pas utilisé)
```

`render.yaml` disait `rootDir: frontend` → Render cherche `frontend/package.json` → **introuvable** car il est dans `frontend/frontend/`.

## Le fix (déjà appliqué dans `render.yaml`)

```diff
  - type: web
    name: rzi-camp-frontend
    runtime: static
-   rootDir: frontend
+   rootDir: frontend/frontend
    buildCommand: npm install && npm run build
    staticPublishPath: dist
```

## Pour appliquer

1. Commit + push le `render.yaml` corrigé
2. Sur Render, **supprimer le service frontend** puis **re-créer** depuis le `render.yaml`
   (Render ne re-lit pas render.yaml sur un service existant, il faut le recréer)
3. Le service devrait maintenant builder `frontend/frontend/` et publier `dist/`

## Alternative si tu veux une structure plus propre

Réorganiser le repo pour avoir une seule imbrication :
```
rzi-camp/
├── backend/
├── frontend/        ← package.json direct ici
│   ├── package.json
│   ├── public/
│   ├── src/
│   └── vite.config.js
└── render.yaml
```

Dans ce cas `rootDir: frontend` marche tel quel.
