from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

@api_view(['POST', 'GET'])
@permission_classes([AllowAny])
def test_boutique(request):
    from django.db import connection
    result = {'tables': {}, 'test_insert': None, 'error': None}
    try:
        with connection.cursor() as c:
            # Vérifier tables existantes
            for t in ['restauration_articleboutique','restauration_consommationboutique','restauration_boncaisse']:
                c.execute(f"SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name='{t}')")
                result['tables'][t] = c.fetchone()[0]
            
            # Vérifier colonnes de consommationboutique
            c.execute("SELECT column_name FROM information_schema.columns WHERE table_name='restauration_consommationboutique' ORDER BY column_name")
            result['columns'] = [r[0] for r in c.fetchall()]
            
            # Vérifier articles disponibles
            c.execute("SELECT id, nom, prix FROM restauration_articleboutique LIMIT 3")
            result['articles'] = [{'id':r[0],'nom':r[1],'prix':str(r[2])} for r in c.fetchall()]
            
            # Vérifier bons de caisse
            c.execute("SELECT COUNT(*) FROM restauration_boncaisse")
            result['bons_count'] = c.fetchone()[0]
            
        if request.method == 'POST':
            from django.utils import timezone as tz
            data = request.data
            article_id = data.get('article', result['articles'][0]['id'] if result['articles'] else 1)
            with connection.cursor() as c:
                c.execute('SELECT prix FROM restauration_articleboutique WHERE id=%s', [article_id])
                row = c.fetchone()
                if not row:
                    result['test_insert'] = f'Article {article_id} not found'
                else:
                    montant = int(float(row[0]))
                    has_mode = 'mode_paiement' in result.get('columns', [])
                    if has_mode:
                        c.execute("INSERT INTO restauration_consommationboutique (article_id,personnel_id,quantite,montant,mode_paiement,notes,valide_par_id,date_conso) VALUES (%s,NULL,1,%s,'especes','',NULL,NOW()) RETURNING id",
                                  [article_id, montant])
                    else:
                        c.execute("INSERT INTO restauration_consommationboutique (article_id,personnel_id,quantite,montant,notes,valide_par_id,date_conso) VALUES (%s,NULL,1,%s,'',NULL,NOW()) RETURNING id",
                                  [article_id, montant])
                    result['test_insert'] = f'OK - id={c.fetchone()[0]}, montant={montant}'
    except Exception as e:
        result['error'] = str(e)
    return Response(result)



@api_view(['POST', 'OPTIONS'])
@permission_classes([AllowAny])
def custom_login(request):
    """Login robuste — catch toutes les erreurs, CORS géré par ASGI"""
    from django.contrib.auth import authenticate
    from rest_framework_simplejwt.tokens import RefreshToken
    from rest_framework.response import Response

    if request.method == 'OPTIONS':
        return Response(status=200)

    try:
        username = (request.data.get('username') or '').strip()
        password = (request.data.get('password') or '')
    except Exception:
        return Response({'detail': 'Corps de requête invalide'}, status=400)

    if not username or not password:
        return Response({'detail': 'Identifiants requis'}, status=400)

    if not username or not password:
        return Response({'detail': 'Identifiants requis'}, status=400)

    user = authenticate(request, username=username, password=password)
    if not user:
        return Response({'detail': 'Identifiants incorrects'}, status=401)

    if not user.is_active:
        return Response({'detail': 'Compte désactivé'}, status=401)

    try:
        refresh = RefreshToken.for_user(user)
        access  = str(refresh.access_token)
    except Exception as e:
        return Response({'detail': f'Erreur token: {e}'}, status=500)

    # Profil utilisateur
    profile = {}
    try:
        from accounts.models import Profile
        p = Profile.objects.filter(user=user).first()
        if p:
            profile = {
                'id':    p.id,
                'role':  p.role,
                'nom':   p.nom or user.get_full_name() or user.username,
            }
            # Lier au personnel si possible
            try:
                from residences.models import Personnel
                pers = Personnel.objects.filter(user=user).first()
                if not pers:
                    pers = Personnel.objects.filter(
                        nom__icontains=user.last_name,
                        prenom__icontains=user.first_name
                    ).first() if user.last_name else None
                if pers:
                    profile['personnel_id'] = pers.id
                    profile['personnel_nom'] = f'{pers.nom} {pers.prenom}'
            except Exception:
                pass
    except Exception:
        profile = {'role': 'admin' if user.is_superuser else 'agent',
                   'nom': user.get_full_name() or user.username}

    try:
        return Response({
            'access':  access,
            'refresh': str(refresh),
            'user': {
                'id':           user.id,
                'username':     user.username,
                'email':        user.email or '',
                'is_superuser': bool(user.is_superuser),
                'is_staff':     bool(user.is_staff),
                'profile':      profile,
            }
        })
    except Exception as e:
        return Response({'detail': f'Erreur réponse: {str(e)}'}, status=500)


@api_view(['GET'])
@permission_classes([AllowAny])
def auth_me(request):
    """Endpoint /api/auth/me/ — profil utilisateur connecté"""
    from rest_framework.response import Response
    if not request.user or not request.user.is_authenticated:
        return Response({'detail': 'Non authentifié'}, status=401)
    user = request.user
    profile = {}
    try:
        from accounts.models import Profile
        p = Profile.objects.filter(user=user).first()
        if p:
            profile = {'id': p.id, 'role': p.role, 'nom': p.nom or user.get_full_name()}
            try:
                from residences.models import Personnel
                pers = Personnel.objects.filter(user=user).first()
                if pers:
                    profile['personnel_id'] = pers.id
                    profile['personnel_nom'] = f'{pers.nom} {pers.prenom}'
            except: pass
    except:
        profile = {'role': 'admin' if user.is_superuser else 'agent',
                   'nom': user.get_full_name() or user.username}
    return Response({
        'id': user.id, 'username': user.username,
        'email': user.email, 'is_superuser': user.is_superuser,
        'is_staff': user.is_staff, 'profile': profile,
    })


def favicon(request):
    from django.http import HttpResponse
    svg = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><rect width="32" height="32" fill="#1e3a8a" rx="4"/><text x="4" y="26" font-size="22" fill="#FFD400">RZ</text></svg>'
    return HttpResponse(svg, content_type='image/svg+xml')


def setup_db(request):
    """Crée les tables manquantes en DB — protégé par secret d'environnement"""
    import os
    from django.http import JsonResponse
    # SÉCURITÉ : cet endpoint exécute des ALTER TABLE / CREATE TABLE arbitraires.
    # Avant ce correctif il n'avait AUCUNE protection — accessible publiquement
    # sans authentification, ce qui permettait à n'importe qui de modifier le
    # schéma de la base de production. Protégé désormais par secret d'env,
    # transmis en query param ?secret=... ou header X-Setup-Secret.
    required_secret = os.environ.get('SETUP_DB_SECRET', '')
    if not required_secret:
        return JsonResponse({'error': 'Endpoint désactivé (SETUP_DB_SECRET non configuré sur Render)'}, status=403)
    provided = request.GET.get('secret', '') or request.headers.get('X-Setup-Secret', '')
    if provided != required_secret:
        return JsonResponse({'error': 'Secret invalide'}, status=403)

    from django.db import connection
    created = []
    errors = []
    try:
        with connection.cursor() as c:
            # maintenance_incident
            c.execute("SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name='maintenance_incident')")
            if not c.fetchone()[0]:
                c.execute("""CREATE TABLE maintenance_incident (
                    id BIGSERIAL PRIMARY KEY,
                    titre VARCHAR(200) NOT NULL DEFAULT '',
                    description TEXT NOT NULL DEFAULT '',
                    categorie VARCHAR(50) NOT NULL DEFAULT 'Autre',
                    priorite VARCHAR(20) NOT NULL DEFAULT 'moyenne',
                    statut VARCHAR(20) NOT NULL DEFAULT 'declare',
                    residence VARCHAR(20) NOT NULL DEFAULT '',
                    bloc VARCHAR(30) NOT NULL DEFAULT '',
                    auteur_id INTEGER REFERENCES auth_user(id) ON DELETE SET NULL,
                    assigne_a_id INTEGER REFERENCES auth_user(id) ON DELETE SET NULL,
                    photo_base64 TEXT NOT NULL DEFAULT '',
                    photo_mime VARCHAR(50) NOT NULL DEFAULT 'image/jpeg',
                    photo_resolution_base64 TEXT NOT NULL DEFAULT '',
                    date_creation TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    date_assignation TIMESTAMP WITH TIME ZONE,
                    date_debut TIMESTAMP WITH TIME ZONE,
                    date_resolution TIMESTAMP WITH TIME ZONE,
                    date_cloture TIMESTAMP WITH TIME ZONE,
                    sla_echeance TIMESTAMP WITH TIME ZONE,
                    sla_depasse BOOLEAN NOT NULL DEFAULT FALSE,
                    sla_notification_envoyee BOOLEAN NOT NULL DEFAULT FALSE,
                    commentaire_resolution TEXT NOT NULL DEFAULT '',
                    commentaire_cloture TEXT NOT NULL DEFAULT ''
                )""")
                created.append('maintenance_incident')

            # maintenance_commentaireincident
            c.execute("SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name='maintenance_commentaireincident')")
            if not c.fetchone()[0]:
                c.execute("""CREATE TABLE maintenance_commentaireincident (
                    id BIGSERIAL PRIMARY KEY,
                    incident_id INTEGER NOT NULL REFERENCES maintenance_incident(id) ON DELETE CASCADE,
                    auteur_id INTEGER REFERENCES auth_user(id) ON DELETE SET NULL,
                    type_comment VARCHAR(20) NOT NULL DEFAULT 'info',
                    contenu TEXT NOT NULL DEFAULT '',
                    date_creation TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    photo_base64 TEXT NOT NULL DEFAULT ''
                )""")
                created.append('maintenance_commentaireincident')
            else:
                # Ajouter colonne photo_base64 si absente
                c.execute("SELECT EXISTS(SELECT FROM information_schema.columns WHERE table_name='maintenance_commentaireincident' AND column_name='photo_base64')")
                if not c.fetchone()[0]:
                    c.execute("ALTER TABLE maintenance_commentaireincident ADD COLUMN photo_base64 TEXT NOT NULL DEFAULT ''")
                    created.append('maintenance_commentaireincident.photo_base64 column')

            # maintenance_historicalincident (simple_history)
            c.execute("SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name='maintenance_historicalincident')")
            if not c.fetchone()[0]:
                c.execute("""CREATE TABLE maintenance_historicalincident (
                    history_id BIGSERIAL PRIMARY KEY,
                    id INTEGER,
                    titre VARCHAR(200),
                    history_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    history_type VARCHAR(1) NOT NULL DEFAULT '+',
                    history_user_id INTEGER REFERENCES auth_user(id) ON DELETE SET NULL
                )""")
                created.append('maintenance_historicalincident')

            # restauration_consommationboutique.mode_paiement
            c.execute("SELECT EXISTS(SELECT FROM information_schema.columns WHERE table_name='restauration_consommationboutique' AND column_name='mode_paiement')")
            if not c.fetchone()[0]:
                c.execute("ALTER TABLE restauration_consommationboutique ADD COLUMN mode_paiement VARCHAR(20) NOT NULL DEFAULT 'especes'")
                created.append('restauration_consommationboutique.mode_paiement')


            # ── Champs rotation dans voyages_voyage ──
            for col_sql in [
                "ALTER TABLE voyages_voyage ADD COLUMN IF NOT EXISTS rotation_id VARCHAR(50) DEFAULT NULL",
                "ALTER TABLE voyages_voyage ADD COLUMN IF NOT EXISTS vehicule VARCHAR(50) DEFAULT ''",
                "ALTER TABLE voyages_voyage ADD COLUMN IF NOT EXISTS nb_places_total INTEGER DEFAULT 15",
                "ALTER TABLE voyages_voyage ADD COLUMN IF NOT EXISTS heure_depart TIME DEFAULT NULL",
                "ALTER TABLE voyages_voyage ADD COLUMN IF NOT EXISTS point_rdv VARCHAR(200) DEFAULT ''",
                "ALTER TABLE voyages_voyage ADD COLUMN IF NOT EXISTS type_voyage VARCHAR(20) DEFAULT 'individuel'",
                "ALTER TABLE voyages_voyage ADD COLUMN IF NOT EXISTS notes_admin TEXT DEFAULT ''",
                "CREATE INDEX IF NOT EXISTS idx_voyage_rotation_id ON voyages_voyage(rotation_id)",
            ]:
                try: c.execute(col_sql)
                except Exception: pass
            created.append("voyage_rotation_fields")

            # ── Contenu éditable Induction Camp ──
            c.execute("SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name='residences_inductioncampconfig')")
            if not c.fetchone()[0]:
                c.execute("""CREATE TABLE residences_inductioncampconfig (
                    id BIGSERIAL PRIMARY KEY,
                    nom VARCHAR(200) NOT NULL DEFAULT 'Camp Résidentiel',
                    site VARCHAR(200) NOT NULL DEFAULT '',
                    capacite INTEGER NOT NULL DEFAULT 0,
                    superficie VARCHAR(50) NOT NULL DEFAULT '',
                    altitude VARCHAR(50) NOT NULL DEFAULT '',
                    duree_parcours_min INTEGER NOT NULL DEFAULT 15,
                    date_maj TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                )""")
                created.append('residences_inductioncampconfig')

            c.execute("SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name='residences_inductioninfra')")
            if not c.fetchone()[0]:
                c.execute("""CREATE TABLE residences_inductioninfra (
                    id BIGSERIAL PRIMARY KEY,
                    titre VARCHAR(100) NOT NULL DEFAULT '',
                    emoji VARCHAR(10) NOT NULL DEFAULT '🏠',
                    couleur VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
                    description TEXT NOT NULL DEFAULT '',
                    details JSONB NOT NULL DEFAULT '[]',
                    photo_base64 TEXT NOT NULL DEFAULT '',
                    photo_mime VARCHAR(50) NOT NULL DEFAULT 'image/jpeg',
                    ordre INTEGER NOT NULL DEFAULT 0,
                    actif BOOLEAN NOT NULL DEFAULT TRUE,
                    date_maj TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                )""")
                created.append('residences_inductioninfra')

            c.execute("SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name='residences_inductionregle')")
            if not c.fetchone()[0]:
                c.execute("""CREATE TABLE residences_inductionregle (
                    id BIGSERIAL PRIMARY KEY,
                    titre VARCHAR(150) NOT NULL DEFAULT '',
                    emoji VARCHAR(10) NOT NULL DEFAULT '📋',
                    niveau VARCHAR(20) NOT NULL DEFAULT 'standard',
                    texte TEXT NOT NULL DEFAULT '',
                    ordre INTEGER NOT NULL DEFAULT 0,
                    actif BOOLEAN NOT NULL DEFAULT TRUE,
                    date_maj TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                )""")
                created.append('residences_inductionregle')

            c.execute("SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name='residences_inductionquizquestion')")
            if not c.fetchone()[0]:
                c.execute("""CREATE TABLE residences_inductionquizquestion (
                    id BIGSERIAL PRIMARY KEY,
                    question TEXT NOT NULL DEFAULT '',
                    options JSONB NOT NULL DEFAULT '[]',
                    bonne_reponse SMALLINT NOT NULL DEFAULT 0,
                    explication TEXT NOT NULL DEFAULT '',
                    ordre INTEGER NOT NULL DEFAULT 0,
                    actif BOOLEAN NOT NULL DEFAULT TRUE,
                    date_maj TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                )""")
                created.append('residences_inductionquizquestion')

    except Exception as e:
        errors.append(str(e))

    return Response({
        'status': 'ok' if not errors else 'partial',
        'created': created,
        'errors': errors
    })



@api_view(['GET'])
@permission_classes([AllowAny])
def backup_complet(request):
    """Export complet de la base au format JSON (équivalent dumpdata --all),
    téléchargeable directement — aucune dépendance à pg_dump (absent de cet
    environnement, psycopg2-binary n'inclut pas les outils CLI PostgreSQL).
    Restaurable sur n'importe quel backend Django via `loaddata`, donc portable
    Render → autre cloud → serveur local sans changer de moteur de base.

    SÉCURITÉ : réutilise SETUP_DB_SECRET (déjà utilisé par /api/setup-db/) —
    un export complet de la base est au moins aussi sensible qu'une modification
    de schéma, donc mérite la même protection fail-closed, sans introduire un
    secret supplémentaire à gérer.
    """
    import os, io
    from django.http import HttpResponse
    from django.core.management import call_command
    from django.core import serializers as dj_serializers

    required_secret = os.environ.get('SETUP_DB_SECRET', '')
    if not required_secret:
        return Response({'error': 'Endpoint désactivé (SETUP_DB_SECRET non configuré côté serveur)'}, status=403)
    provided = request.GET.get('secret', '') or request.META.get('HTTP_X_SETUP_SECRET', '')
    if provided != required_secret:
        return Response({'error': 'Secret invalide'}, status=403)

    buf = io.StringIO()
    try:
        call_command(
            'dumpdata',
            exclude=['contenttypes', 'auth.permission', 'sessions.session', 'admin.logentry'],
            natural_foreign=True, natural_primary=True,
            indent=2, stdout=buf,
        )
    except Exception as e:
        return Response({'error': f'Échec export: {e}'}, status=500)

    from django.utils import timezone
    filename = f"rzi_camp_backup_{timezone.now().strftime('%Y%m%d_%H%M%S')}.json"
    response = HttpResponse(buf.getvalue(), content_type='application/json')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


@api_view(['GET'])
@permission_classes([AllowAny])
def backup_status(request):
    """Renseigne si la sauvegarde est configurée et donne un résumé léger
    (nombre de lignes par table principale) sans exiger le secret — utile
    pour vérifier rapidement que le mécanisme est opérationnel avant de
    déclencher un vrai export, et pour un monitoring externe basique."""
    import os
    from django.db import connection
    configured = bool(os.environ.get('SETUP_DB_SECRET', ''))
    counts = {}
    try:
        with connection.cursor() as c:
            for table in ['residences_personnel', 'residences_batiment', 'maintenance_incident',
                          'restauration_consommationboutique', 'voyages_voyage']:
                try:
                    c.execute(f"SELECT COUNT(*) FROM {table}")
                    counts[table] = c.fetchone()[0]
                except Exception:
                    counts[table] = None
    except Exception:
        pass
    return Response({'backup_endpoint_configured': configured, 'row_counts': counts})


def diagnostic(request):
    """Endpoint public de statut système — utilisé par StatusPage.jsx sans authentification
    (page de monitoring consultée avant même qu'un login soit possible si la DB est down).
    Volontairement minimal : ne renvoie ni comptes de lignes ni versions de dépendances,
    qui sont des informations utiles à un attaquant en reconnaissance et inutiles
    pour la simple question "le système répond-il"."""
    from django.db import connection
    from rest_framework.response import Response
    result = {'status': 'ok', 'database': 'disconnected'}
    try:
        with connection.cursor() as c:
            c.execute("SELECT 1")
        result['database'] = 'connected'
    except Exception:
        result['database'] = 'disconnected'
    # Détail (comptes, versions) réservé aux utilisateurs authentifiés
    if request.user and request.user.is_authenticated:
        import sys
        result['python'] = sys.version
        result['django'] = __import__('django').get_version()
        try:
            with connection.cursor() as c:
                result['tables'] = {}
                c.execute("SELECT COUNT(*) FROM residences_personnel")
                result['tables']['personnel'] = c.fetchone()[0]
                c.execute("SELECT COUNT(*) FROM maintenance_incident")
                result['tables']['incidents'] = c.fetchone()[0]
                c.execute("SELECT COUNT(*) FROM restauration_consommationboutique")
                result['tables']['consommations'] = c.fetchone()[0]
        except Exception as e:
            result['database_error'] = str(e)
    return Response(result)

@api_view(['GET'])
@permission_classes([AllowAny])
def version(request):
    from rest_framework.response import Response
    return Response({'version': 'v6.1', 'app': 'RZI Camp ERP', 'env': 'production'})

urlpatterns = [
    path('api/induction/', include('induction.api.urls')),
    path('admin/', admin.site.urls),
    path('api/auth/login/', custom_login, name='token_obtain'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/me/', auth_me, name='auth_me'),
    path('favicon.ico', favicon),
    path('api/setup-db/', setup_db, name='setup_db'),
    path('api/diagnostic/', diagnostic, name='diagnostic'),
    path('api/version/', version, name='version'),
    path('api/test-boutique/', test_boutique, name='test_boutique'),
    path('api/', include('residences.urls')),
    path('api/', include('maintenance.urls')),
    path('api/', include('restauration.urls')),
    path('api/', include('accounts.urls')),
    path('api/', include('voyages.urls')),
    path('api/', include('evenements.urls')),
    path('api/notifications/envoyer/', __import__('evenements.views', fromlist=['envoyer_notification']).envoyer_notification, name='envoyer_notification'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
