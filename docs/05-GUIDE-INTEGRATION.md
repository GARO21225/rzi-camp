# Guide d'intégration — RZI Camp ERP

Couvre trois aspects : comment les modules internes communiquent entre eux, comment le système s'intègre avec des services externes, et comment intégrer le projet sur un nouveau poste de développement.

---

## 1. Intégration entre modules (interne)

### Principe général
Pas de bus d'événements centralisé. Les modules communiquent par trois canaux :

1. **Relations Django (FK/OneToOne)** — la vraie colonne vertébrale. `Voyage.personnel` lie Rotations à Personnel, `ArticleBoutique`/`ConsommationBoutique` lient Boutique à Personnel, `Incident.auteur`/`assigne_a` lient Maintenance à `auth.User`.
2. **WebSocket (Django Channels)** — `evenements.consumers.NotificationConsumer` sur `/ws/notifications/`. Utilisé pour pousser des notifications temps réel sans que le frontend ait à faire du polling.
3. **Appels REST directs entre composants frontend** — un composant React appelle l'API d'un autre module quand il a besoin de sa donnée (ex : `MissionControl.jsx` appelle `/api/personnel/` pour peupler la liste de passagers d'une rotation).

### Carte des dépendances réelles entre modules

```
Personnel (résidences)
  ├─→ Batiment (résidences)         — un personnel occupe un bâtiment
  ├─→ Voyage (voyages)              — un personnel part en rotation
  ├─→ Incident.auteur (maintenance) — via auth.User, pas directement
  ├─→ ConsommationBoutique (restauration)
  ├─→ BonCaisse (restauration)
  └─→ InductionRecord (résidences)  — 1-to-1

Batiment (résidences)
  └─→ Voyage.batiment               — la chambre liée au voyage

auth.User (Django natif)
  ├─→ Profile (accounts)            — 1-to-1, rôle générique
  └─→ Personnel.user                — 1-to-1, lien optionnel vers fiche personnel
```

**Point d'attention** : `Personnel` et `auth.User` sont deux entités distinctes liées de façon optionnelle (`Personnel.user` peut être `null`). Un `Personnel` peut exister sans compte de connexion (visiteur temporaire, par exemple), et un `User` admin peut exister sans fiche `Personnel` (compte technique). Ne jamais supposer que l'un implique l'autre.

### Authentification partagée entre modules
Tous les modules utilisent le même JWT émis par `custom_login` (`backend/rzi_camp/urls.py`). Le payload du token contient l'`user_id` Django standard — chaque module va ensuite chercher lui-même le `Profile` ou le `Personnel` lié si besoin. Il n'y a pas de claim JWT personnalisé portant le rôle ou le profil métier directement.

### Comment ajouter une intégration entre deux modules existants
1. Identifier si une FK existe déjà (vérifier `02-DATA-DICTIONARY.md`).
2. Si oui : exposer le champ lié dans le serializer concerné (`SerializerMethodField` pour les champs dénormalisés comme `personnel_nom`).
3. Si non : réfléchir si une vraie FK est justifiée ou si un appel REST croisé côté frontend suffit pour le besoin (cas le plus fréquent dans ce projet, voir Mission Control qui croise Voyages + Personnel sans FK dédiée).

---

## 2. Intégration avec des systèmes externes

### Email (SMTP) — actif
Configuré dans `settings.py` (`EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`), utilisé dans `backend/rzi_camp/notifications.py` et `backend/accounts/views.py`.

| Usage actuel | Déclencheur |
|---|---|
| Email de bienvenue avec identifiants | Création d'une fiche `Personnel` |

**Variables d'environnement requises** (sur Render, dans les Environment Variables du service backend) :
```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=...
EMAIL_HOST_PASSWORD=...
DEFAULT_FROM_EMAIL=noreply@rzi-camp.com
```

### SMS (Twilio) — scaffoldé, à vérifier en usage réel
Variables présentes dans `settings.py` (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`) et logique présente dans `notifications.py`. **Avant de s'appuyer dessus en prod, vérifier que le compte Twilio est actif et que le crédit est suffisant** — ces clés peuvent être restées en valeurs par défaut/test depuis la configuration initiale.

### Cartographie (OpenStreetMap / Leaflet)
Pas de clé API requise — les tuiles sont chargées depuis `tile.openstreetmap.org` (usage public, limites de taux à respecter si le trafic monte). Pas de fournisseur commercial (Mapbox, Google Maps) en place actuellement.

### Render (hébergement)
Deux services distincts :
- **Backend** (`rzi-camp-backend.onrender.com`) — Web Service, PostgreSQL managé attaché.
- **Frontend** (`rzi-camp-frontend.onrender.com`) — Static Site.

L'URL du backend est détectée automatiquement côté frontend par remplacement de chaîne sur le hostname (voir `frontend/src/api/index.js`) — si jamais l'un des deux services est renommé sur Render, cette détection casse. Préférer définir `VITE_API_URL` explicitement dans les Environment Variables du frontend pour éviter la dépendance à la convention de nommage.

### CORS — point d'intégration critique
Le backend tourne en **ASGI (Daphne)**, ce qui signifie que `django-cors-headers` (pensé pour WSGI) ne suffit pas. Un middleware CORS maison est en place dans `backend/rzi_camp/asgi.py`. **Toute nouvelle origine frontend (nouveau sous-domaine, environnement de staging, etc.) doit être ajoutée explicitement dans `CORSMiddleware.ORIGINS`** dans ce fichier — l'ajouter seulement dans `settings.py` ne suffira pas en ASGI.

---

## 3. Intégration / onboarding d'un nouveau poste de développement

### Prérequis
- Python 3.11+ (vérifier la version exacte utilisée par Render dans `runtime.txt` si présent, sinon dernière 3.11.x stable)
- Node.js 18+ pour le frontend Vite
- PostgreSQL local (ou pointer `DATABASE_URL` vers une instance distante de dev)
- Accès au repo GitHub `GARO21225/rzi-camp`

### Étapes
```bash
git clone https://github.com/GARO21225/rzi-camp.git
cd rzi-camp

# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # si présent, sinon créer un .env avec au minimum DATABASE_URL et SECRET_KEY
python manage.py migrate
python manage.py seed_db   # peuple des données de démo, tolère l'échec
python manage.py createsuperuser
daphne -b 0.0.0.0 -p 8000 rzi_camp.asgi:application
# ou pour du dev rapide sans tester l'ASGI réel :
python manage.py runserver

# Frontend (autre terminal)
cd frontend
npm install
npm run dev
# .env.local optionnel: VITE_API_URL=http://localhost:8000
```

### Vérification que tout fonctionne
1. `http://localhost:5173` charge la page de login sans erreur console.
2. Login avec le superuser créé → doit rediriger vers le Dashboard sans erreur CORS dans la console (en local, CORS ne devrait pas poser de problème car même origine logique, mais vérifier quand même).
3. `npm run build` doit terminer sans erreur avant tout push.

### Avant de pousser en production
Toujours suivre la check-list de `03-CLAUDE.md`, section "Avant de dire c'est corrigé". En particulier : `rm -rf dist/ && npm run build` sans erreur, et vérification que toute nouvelle page est lazy-loaded avec son `<Suspense>`.
