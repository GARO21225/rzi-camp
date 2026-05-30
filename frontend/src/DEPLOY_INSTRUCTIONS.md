# Instructions de déploiement Render

## Le problème
Render déploie l'ancien commit. Tu dois remplacer le contenu du repo GitHub.

## Procédure (copier-coller dans ton terminal)

```bash
# 1. Clone ton repo (si pas déjà fait)
git clone https://github.com/GARO21225/rzi-camp
cd rzi-camp

# 2. Supprimer tout le contenu actuel
git rm -rf .

# 3. Extraire le nouveau zip à la racine
# (Extrais rzi-camp-v20-DEPLOY.zip dans ce dossier)
# La structure doit être:
#   backend/
#   frontend/
#   render.yaml
#   README.md

# 4. Ajouter tout et pousser
git add .
git commit -m "fix: correct structure + JSX apostrophe + DB pooling"
git push origin main
```

## Vérification structure
Après extraction, ton repo doit avoir:
```
rzi-camp/          ← racine du repo Git
├── backend/       ← code Django
├── frontend/      ← code React/Vite
├── render.yaml    ← config Render
└── README.md
```

## Variables Render à configurer
Frontend (Static Site) → Environment:
```
VITE_API_URL = https://rzi-camp-backend.onrender.com
```

Backend (Web Service) → Environment:
```
DATABASE_URL = (auto depuis la DB Render)
SECRET_KEY = (auto-généré)
DEBUG = False
ALLOWED_HOSTS = *
```
