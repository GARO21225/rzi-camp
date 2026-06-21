# Guide de migration cloud & reprise après sinistre — RZI Camp

Ce document couvre ce qui est demandé dans le chantier "architecture" : comment
migrer Render → un autre cloud, Render → un serveur local, et comment restaurer
le système en cas de perte de la base de données. Il part de l'état réel du
projet (audité ligne par ligne, pas supposé) — pas d'un schéma générique.

---

## 1. Pourquoi ce document existe maintenant

La base PostgreSQL gratuite de Render **expire après un délai fixe** (30 à 90
jours selon la politique en vigueur au moment du déploiement) et est supprimée
**définitivement, sans période de grâce**. Avant la mise en place décrite ici,
ce projet n'avait aucun mécanisme de sauvegarde ni de procédure de migration
documentée. Ce n'est pas une précaution théorique — c'est un risque réel sur
des données de camp minier en production.

---

## 2. Sauvegarde — déjà en place, voici comment l'utiliser

Deux endpoints existent côté backend :

- `GET /api/backup-complet/?secret=<SETUP_DB_SECRET>` — export JSON complet de
  toute la base (équivalent `dumpdata --all`), téléchargeable directement.
- `GET /api/backup-status/` — vérifie que le mécanisme est configuré, sans
  exposer le secret (utile pour un monitoring externe basique).

**Pourquoi un export JSON et pas `pg_dump`** : l'environnement Render
(`psycopg2-binary`) n'installe pas les outils CLI PostgreSQL. Un export
Django (`dumpdata`/`loaddata`) a l'avantage d'être **portable** — il se
restaure de façon identique sur n'importe quel backend Django, peu importe
si la base cible est PostgreSQL, et peu importe le cloud. C'est cohérent
avec l'objectif "migration possible" de ce chantier.

**Automatisation** : `scripts/backup_rzi_camp.py` + le workflow GitHub Actions
fourni séparément (`.github/workflows/backup.yml` — à ajouter manuellement,
le token utilisé pour les autres modifications de ce projet n'a pas la
permission `workflow` nécessaire pour le pousser directement) exécutent cette
sauvegarde chaque jour à 3h UTC, stockée comme artifact GitHub (rétention 90
jours), pas comme commit dans le repo (évite de versionner des données
personnelles du personnel dans l'historique Git).

**Configuration requise** (une seule fois, sur GitHub → Settings → Secrets and
variables → Actions) :
```
RZI_BACKUP_URL    = https://rzi-camp-backend.onrender.com/api/backup-complet/
RZI_BACKUP_SECRET = <même valeur que SETUP_DB_SECRET configuré sur Render>
```

**Récupérer un backup manuellement, sans attendre le cron** :
```bash
export RZI_BACKUP_SECRET='...'
python3 scripts/backup_rzi_camp.py
# → écrit ./backups/rzi_camp_backup_YYYYMMDD_HHMMSS.json
```

---

## 3. Variables d'environnement — liste exhaustive et exacte

Cette liste a été extraite directement de `backend/rzi_camp/settings.py` et
`backend/rzi_camp/urls.py` (recherche `os.environ.get(...)`), pas reconstituée
de mémoire — c'est la vraie liste de tout ce qu'il faut reconfigurer pour que
le système fonctionne à l'identique sur une nouvelle infrastructure.

| Variable | Rôle | Obligatoire |
|---|---|---|
| `DATABASE_URL` | Connexion PostgreSQL (format `postgresql://user:pass@host:port/db`) | Oui |
| `SECRET_KEY` | Clé secrète Django (signatures, sessions) | Oui |
| `DEBUG` | `"True"`/`"False"` — **toujours `"False"` en production** | Oui |
| `ALLOWED_HOSTS` | Domaines autorisés à servir l'app (`"*"` actuellement — voir section sécurité ci-dessous) | Oui |
| `SETUP_DB_SECRET` | Protège `/api/setup-db/`, `/api/backup-complet/`, `/api/backup-status/` | Oui (sinon ces endpoints restent désactivés par défaut, fail-closed) |
| `APP_URL` | URL publique du frontend, utilisée dans des liens générés (emails, etc.) | Recommandé |
| `EMAIL_HOST` / `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` / `EMAIL_PORT` / `DEFAULT_FROM_EMAIL` | Envoi d'emails (réinitialisation de mot de passe, notifications) | Si la fonctionnalité email est utilisée |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | Envoi de SMS via Twilio | Si la fonctionnalité SMS est utilisée |

Côté frontend (`frontend/src/api/index.js`), une seule variable :

| Variable | Rôle |
|---|---|
| `VITE_API_URL` | URL du backend. Si absente, le frontend déduit l'URL en remplaçant `frontend` par `backend` dans le nom d'hôte courant — fonctionne uniquement si la convention de nommage Render (`<projet>-frontend`/`<projet>-backend`) est conservée sur la nouvelle infrastructure. **À définir explicitement sur tout autre cloud.** |

---

## 4. Migration Render → autre cloud (ex: Railway, Fly.io, AWS, DigitalOcean)

### Étape 1 — Exporter les données
```bash
curl "https://rzi-camp-backend.onrender.com/api/backup-complet/?secret=<SETUP_DB_SECRET>" \
  -o rzi_camp_export.json
```

### Étape 2 — Provisionner la nouvelle infrastructure
- Une base PostgreSQL 15+ (`docker-compose.yml` à la racine du repo donne la
  config minimale de référence : nom de base `rzi_camp`, utilisateur `rzi`).
- Un service capable de exécuter le backend en **ASGI** via Daphne — pas WSGI.
  C'est important : ce projet utilise `channels` pour les notifications
  temps réel par websocket, qui ne fonctionnent qu'en ASGI. Toute plateforme
  qui force WSGI (certains PaaS basiques) cassera cette fonctionnalité.
  Commande de démarrage exacte (déjà utilisée par Render) :
  ```
  daphne -b 0.0.0.0 -p $PORT rzi_camp.asgi:application
  ```
- Un service de fichiers statiques pour le frontend (n'importe quel
  hébergeur de sites statiques convient — le build produit un dossier
  `dist/` autonome, sans dépendance serveur).

### Étape 3 — Configurer les variables d'environnement
Reporter toutes les variables de la section 3 sur la nouvelle plateforme.
**Ne jamais réutiliser `SECRET_KEY` de prod sur un environnement de test** —
en générer une nouvelle (`python -c "import secrets; print(secrets.token_urlsafe(50))"`).

### Étape 4 — Déployer le code, laisser les migrations s'exécuter
Le `build.sh` du backend (`backend/build.sh`) crée automatiquement les tables
manquantes et fake-applique l'historique des migrations Django au premier
démarrage — comportement déjà en place, pas modifié pour cette migration.

> ⚠️ **Point de vigilance non résolu** : ce mécanisme fake-applique des
> migrations (`INSERT INTO django_migrations` sans exécuter réellement
> `migrate`), ce qui peut faire diverger silencieusement le schéma réel de
> l'historique Django si le `build.sh` et les fichiers de migration ne sont
> pas parfaitement synchronisés. Avant une migration cloud réelle, il serait
> plus sûr de repartir d'une base neuve et de laisser tourner les vraies
> migrations Django (`python manage.py migrate`) plutôt que de copier ce
> mécanisme de rattrapage, pensé pour corriger des bases déjà existantes,
> pas pour initialiser une base neuve.

### Étape 5 — Importer les données
```bash
python manage.py loaddata rzi_camp_export.json
```

### Étape 6 — Basculer le DNS / les URLs
Mettre à jour `VITE_API_URL` côté frontend pour pointer vers le nouveau
backend, puis rebuilder et redéployer le frontend.

---

## 5. Migration Render → serveur local (camp minier, connexion limitée)

C'est le scénario le plus pertinent pour un contexte de camp minier isolé :
faire tourner l'application sur un serveur sur site, sans dépendre d'Internet.

### Avec Docker (recommandé, image déjà préparée et corrigée)
```bash
docker compose up -d
```
`docker-compose.yml` et les deux `Dockerfile` (backend/frontend) ont été
corrigés pour être fidèles à la prod Render : ASGI/Daphne (pas WSGI), npm
(pas pnpm sans lockfile), Python 3.14, PostgreSQL simple (PostGIS retiré,
jamais utilisé par le code).

### Sans Docker (installation directe)
```bash
# Backend
cd backend
python3.14 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="postgresql://user:pass@localhost:5432/rzi_camp"
export SECRET_KEY="..." DEBUG=False ALLOWED_HOSTS="*"
python manage.py migrate
daphne -b 0.0.0.0 -p 8000 rzi_camp.asgi:application

# Frontend (dans un autre terminal)
cd frontend
npm install
npm run build
# Servir le dossier dist/ avec nginx, ou `npm run preview` pour un test rapide
```

### Limite réelle à connaître pour ce scénario
Le mode offline actuel (`frontend/src/hooks/useOffline.js`) suppose que le
backend redevient accessible **par Internet** pour synchroniser la file
d'attente — il ne gère pas un scénario "serveur local toujours disponible
sur le réseau du camp, mais coupé d'Internet". Si le besoin réel est "le
camp doit fonctionner même sans connexion Internet du tout, avec un serveur
sur site", la queue offline actuelle n'a pas besoin d'être déclenchée puisque
le serveur local répond directement — mais ça n'a pas été testé dans ce
scénario précis, à valider avant un déploiement réel sur site isolé.

---

## 6. Restauration après perte de la base

```bash
# 1. Provisionner une base PostgreSQL vide (même version, 15+)
# 2. Faire tourner les migrations Django pour créer le schéma
python manage.py migrate

# 3. Restaurer les données depuis le dernier backup
python manage.py loaddata rzi_camp_backup_<date>.json
```

Le dernier backup disponible est récupérable :
- Manuellement via `/api/backup-complet/` (si le backend est encore vivant)
- Via les artifacts du workflow GitHub Actions (GitHub → Actions → choisir
  une exécution → section Artifacts), rétention 90 jours

---

## 7. Ce qui n'est PAS couvert par ce document (à dire clairement)

- **Le nettoyage du mécanisme fake-migrations dans `build.sh`** — identifié
  comme risque (divergence schéma réel / historique Django) mais pas traité,
  car le corriger sans casser la prod actuelle demande un plan détaillé et
  un test sur un environnement de staging, pas un correctif rapide.
- **La gestion de conflit de la queue offline** lors d'une synchronisation
  après une coupure réseau prolongée (mentionnée comme limite dans l'audit
  Offline/PWA précédent, toujours pas implémentée).
- **Un test réel de migration** — ce document décrit la procédure telle que
  déduite de l'audit du code, mais elle n'a pas été exécutée bout en bout sur
  un environnement de test avant rédaction. À valider en conditions réelles
  avant de s'y fier pour une vraie migration de production.
