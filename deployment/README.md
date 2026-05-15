# RZI Camp Management System

## Installation

### Backend (Django)
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend (React + Vite)
```bash
cd frontend
pnpm install
pnpm dev
```

## Déploiement

### Render
1. Créer un projet sur render.com
2. Connecter GitHub repo
3. Utiliser `deployment/render.yaml`

### Docker
```bash
cd deployment
docker-compose up --build
```

## Configuration

### Backend (.env)
```
SECRET_KEY=votre_cle_secrete
DATABASE_URL=postgres://...
DEBUG=false
ALLOWED_HOSTS=.onrender.com
CORS_ALLOWED_ORIGINS=https://votre-frontend.onrender.com
```

### Frontend (.env)
```
VITE_API_URL=https://votre-backend.onrender.com
```