from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

@api_view(['GET'])
@permission_classes([AllowAny])
def setup_db(request):
    """Crée les tables manquantes en DB"""
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

    except Exception as e:
        errors.append(str(e))

    return Response({
        'status': 'ok' if not errors else 'partial',
        'created': created,
        'errors': errors
    })


urlpatterns = [
    path('api/induction/', include('induction.api.urls')),
    path('admin/', admin.site.urls),
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/setup-db/', setup_db, name='setup_db'),
    path('api/', include('residences.urls')),
    path('api/', include('maintenance.urls')),
    path('api/', include('restauration.urls')),
    path('api/', include('accounts.urls')),
    path('api/', include('voyages.urls')),
    path('api/', include('evenements.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
