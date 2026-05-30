#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt

# ============================================================
# Fix migrations + créer tables manquantes
# On ignore les erreurs de connexion (DB surchargée au build)
# ============================================================
python manage.py shell -c "
from django.db import connection
from django.utils import timezone

now = timezone.now()

try:
    with connection.cursor() as c:

        # residences_inductionrecord
        c.execute(\"SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='residences_inductionrecord')\")
        if not c.fetchone()[0]:
            c.execute('''CREATE TABLE residences_inductionrecord (
                id BIGSERIAL PRIMARY KEY,
                statut VARCHAR(20) NOT NULL DEFAULT 'en_cours',
                etapes_data JSONB NOT NULL DEFAULT '{}',
                form_data JSONB NOT NULL DEFAULT '{}',
                docs_data JSONB NOT NULL DEFAULT '{}',
                medical_data JSONB NOT NULL DEFAULT '{}',
                quiz_score INTEGER,
                quiz_tentatives INTEGER NOT NULL DEFAULT 0,
                date_debut TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                date_fin TIMESTAMP WITH TIME ZONE,
                badge_emis BOOLEAN NOT NULL DEFAULT FALSE,
                badge_date TIMESTAMP WITH TIME ZONE,
                badge_expire DATE,
                personnel_id INTEGER NOT NULL UNIQUE REFERENCES residences_personnel(id) ON DELETE CASCADE
            )''')
            print('Created residences_inductionrecord')
        else:
            print('residences_inductionrecord OK')

        # restauration_menujour
        c.execute(\"SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='restauration_menujour')\")
        if not c.fetchone()[0]:
            c.execute('''CREATE TABLE restauration_menujour (
                id BIGSERIAL PRIMARY KEY,
                nom VARCHAR(200) NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                type_plat VARCHAR(20) NOT NULL DEFAULT 'plat',
                date_service DATE NOT NULL,
                repas VARCHAR(20) NOT NULL DEFAULT 'midi',
                disponible BOOLEAN NOT NULL DEFAULT TRUE,
                image_url VARCHAR(200) NOT NULL DEFAULT '',
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )''')
            print('Created restauration_menujour')
        else:
            print('restauration_menujour OK')

        # Fake-apply migrations manquantes
        FULL_LIST = [
            ('accounts','0001_initial'),('accounts','0002_alter_profile_role'),
            ('accounts','0003_remove_profile_device_id_profile_telephone_and_more'),
            ('evenements','0001_initial'),('evenements','0002_simplenotification'),
            ('induction','0001_initial'),
            ('induction','0002_accessbadge_accesslog_documenttype_emergencycontact_and_more'),
            ('maintenance','0001_initial'),
            ('maintenance','0002_historicalincident_photo_resolution_and_more'),
            ('maintenance','0003_remove_historicalincident_photo_and_more'),
            ('maintenance','0004_workflow_v2'),('maintenance','0005_convert_statuts'),
            ('maintenance','0006_add_missing_columns'),('maintenance','0007_ensure_columns'),
            ('residences','0001_initial'),
            ('residences','0002_personnel_historicalpersonnel_batiment_personnel_and_more'),
            ('residences','0003_alter_batiment_options_and_more'),
            ('residences','0004_alter_batiment_options_and_more'),
            ('residences','0005_demande_historicaldemande'),
            ('residences','0006_add_induction_record'),
            ('residences','0007_historicalpersonnel_profil_personnel_profil'),
            ('restauration','0001_initial'),
            ('restauration','0002_historicalrepaslog_personnel_qrtoken_personnel_and_more'),
            ('restauration','0003_add_boutique_models'),
            ('restauration','0004_boutique_free_category_image'),
            ('restauration','0005_boutique_image_textfield'),
            ('restauration','0006_add_bon_caisse'),('restauration','0007_add_menu_jour'),
            ('voyages','0001_initial'),
            ('voyages','0002_historicalvoyage_heure_depart_voyage_heure_depart'),
        ]
        c.execute('SELECT app, name FROM django_migrations')
        applied = {(r[0], r[1]) for r in c.fetchall()}
        fixed = []
        for app, name in FULL_LIST:
            if (app, name) not in applied:
                c.execute('INSERT INTO django_migrations (app, name, applied) VALUES (%s,%s,%s)', [app, name, now])
                fixed.append(f'{app}.{name}')
        if fixed:
            print(f'Fake-applied: {fixed}')
        else:
            print('Migrations OK')

except Exception as e:
    print(f'DB setup warning (non-fatal): {e}')
" || echo "Shell step skipped (DB unavailable) — continuing"

python manage.py migrate --noinput || echo "Migrate skipped (DB unavailable)"
python manage.py collectstatic --noinput
