from pathlib import Path
import os
import dj_database_url
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.environ.get("DEBUG", "False") == "True"

# SECURITE : jamais de valeur en dur ici — ce fichier est sur un dépôt GitHub
# public. En production (DEBUG=False), une SECRET_KEY manquante fait
# maintenant planter le démarrage avec un message clair, plutôt que de
# générer silencieusement une clé aléatoire différente à chaque worker/
# redémarrage — ce repli silencieux a causé des deconnexions aleatoires
# a repetition (2 workers = 2 cles differentes = jetons valides pour l'un,
# rejetes par l'autre), tres difficile a diagnostiquer sans ce garde-fou.
# En local (DEBUG=True), une cle aleatoire reste generee par confort.
SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    if DEBUG:
        import secrets as _secrets
        SECRET_KEY = _secrets.token_urlsafe(50)
    else:
        raise RuntimeError(
            "SECRET_KEY manquante ou vide en production ! "
            "Verifiez .env et docker-compose.yml (env_file), et qu'aucune "
            "variable shell SECRET_KEY vide n'ecrase le fichier .env "
            "(diagnostic: echo \"[$SECRET_KEY]\" doit afficher [] SANS que "
            "la variable soit definie — sinon: unset SECRET_KEY)."
        )
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "simple_history",
    "accounts",
    "voyages",
    "residences",
    "maintenance",
    "restauration",
    "evenements",
    "channels",
    "induction",
    "django_filters",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "simple_history.middleware.HistoryRequestMiddleware",
]

ROOT_URLCONF = "rzi_camp.urls"
TEMPLATES = [{"BACKEND":"django.template.backends.django.DjangoTemplates","DIRS":[],"APP_DIRS":True,"OPTIONS":{"context_processors":["django.template.context_processors.debug","django.template.context_processors.request","django.contrib.auth.context_processors.auth","django.contrib.messages.context_processors.messages"]}}]
WSGI_APPLICATION = "rzi_camp.wsgi.application"

# DATABASE — Render PostgreSQL auto ou SQLite en local
DATABASE_URL = os.environ.get("DATABASE_URL", "")
if DATABASE_URL:
    DATABASES = {"default": dj_database_url.parse(DATABASE_URL, conn_max_age=600)}
else:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Abidjan"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "rzi_camp.pagination.RziPageNumberPagination",
    "PAGE_SIZE": 50,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=24),   # 24h pour éviter expiration fréquente
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

# ── CORS Configuration ──────────────────────────────────────────────
# SECURITE : CORS_ALLOW_ALL_ORIGINS acceptait des requêtes credentialisées
# depuis N'IMPORTE QUEL site web. Restreint à la liste explicite ci-dessous
# (ajouter un domaine ici si l'app change d'adresse).
CORS_ALLOWED_ORIGINS = [
    o for o in os.environ.get(
        'CORS_ALLOWED_ORIGINS',
        'https://204.168.229.74:5173,http://localhost:5173,http://localhost:3000'
    ).split(',') if o
]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = [
    'DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT',
]
CORS_ALLOW_HEADERS = [
    'accept', 'accept-encoding', 'authorization',
    'content-type', 'dnt', 'origin', 'user-agent',
    'x-csrftoken', 'x-requested-with', 'cache-control',
]
CORS_EXPOSE_HEADERS = ['content-type', 'authorization']
CORS_PREFLIGHT_MAX_AGE = 86400

# Fix pour Render - HOST header et proxy
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Désactiver CSRF pour les API (JWT est utilisé)
CSRF_COOKIE_SECURE = False
CSRF_TRUSTED_ORIGINS = [
    'https://204.168.229.74:5173',
    'https://rzi-camp-frontend.onrender.com',
    'https://rzi-camp-backend.onrender.com',
    'http://localhost:5173',
    'http://localhost:3000',
]

# Augmenter la limite pour les photos base64 (3Mo image → ~4Mo JSON)
DATA_UPLOAD_MAX_MEMORY_SIZE = 20 * 1024 * 1024   # 20MB
FILE_UPLOAD_MAX_MEMORY_SIZE  = 20 * 1024 * 1024   # 20MB

# ── CHANNELS (WebSocket) ──
# Redis (pas InMemory) : indispensable dès qu'on tourne avec plusieurs
# processus worker (voir docker-compose.yml) — chaque processus aurait
# sinon sa propre mémoire isolée, et les notifications ne traverseraient
# pas d'un worker à l'autre selon celui qui reçoit la connexion WebSocket.
ASGI_APPLICATION = "rzi_camp.asgi.application"
REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}

# ── Database connection pooling ──
import dj_database_url as _dj_db_url
_db_url = os.environ.get('DATABASE_URL')
if _db_url:
    DATABASES = {
        'default': _dj_db_url.config(
            default=_db_url,
            conn_max_age=60,          # Keep connections alive 60s
            conn_health_checks=True,
        )
    }
    # Connection pooling limits
    DATABASES['default']['OPTIONS'] = {
        'connect_timeout': 10,
        'keepalives': 1,
        'keepalives_idle': 30,
        'keepalives_interval': 10,
        'keepalives_count': 5,
    }


# ── Email (SMTP) ────────────────────────────────────
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@rzi-camp.com')

# SMS : plus configure via variables d'environnement - toutes les
# credentials fournisseurs vivent dans Parametre (base de donnees,
# configurable depuis Parametrage -> Connexion SMS), voir
# accounts/sms.py et accounts/sms_providers/. Les anciennes variables
# TWILIO_* ont ete retirees (integration Twilio retiree, code mort
# supprime - backend/rzi_camp/notifications.py).

# ── Application URL ──────────────────────────────────
APP_URL = os.environ.get('APP_URL', 'https://rzi-camp-frontend.onrender.com')
