#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt

# ============================================================
# ÉTAPE 1 : Réparer l'historique des migrations incohérentes
# ============================================================
python manage.py shell -c "
from django.db import connection
from django.utils import timezone

ALL_MIGRATIONS = {
    'accounts': [
        '0001_initial',
        '0002_alter_profile_role',
        '0003_remove_profile_device_id_profile_telephone_and_more',
    ],
    'evenements': [
        '0001_initial',
        '0002_simplenotification',
    ],
    'induction': [
        '0001_initial',
        '0002_accessbadge_accesslog_documenttype_emergencycontact_and_more',
    ],
    'maintenance': [
        '0001_initial',
        '0002_historicalincident_photo_resolution_and_more',
        '0003_remove_historicalincident_photo_and_more',
        '0004_workflow_v2',
        '0005_convert_statuts',
        '0006_add_missing_columns',
        '0007_ensure_columns',
    ],
    'residences': [
        '0001_initial',
        '0002_personnel_historicalpersonnel_batiment_personnel_and_more',
        '0003_alter_batiment_options_and_more',
        '0004_alter_batiment_options_and_more',
        '0005_demande_historicaldemande',
        '0007_historicalpersonnel_profil_personnel_profil',
    ],
    'restauration': [
        '0001_initial',
        '0002_historicalrepaslog_personnel_qrtoken_personnel_and_more',
        '0003_add_boutique_models',
        '0004_boutique_free_category_image',
        '0005_boutique_image_textfield',
        '0006_add_bon_caisse',
    ],
    'voyages': [
        '0001_initial',
        '0002_historicalvoyage_heure_depart_voyage_heure_depart',
    ],
}

# NOTE: on exclut volontairement residences.0006 et restauration.0007
# pour que migrate les applique vraiment

try:
    with connection.cursor() as c:
        c.execute('SELECT app, name FROM django_migrations')
        applied = {(row[0], row[1]) for row in c.fetchall()}
        print(f'Migrations in DB: {len(applied)}')

        # Supprimer les fake-apply erronés des 2 migrations cibles si présents
        for app, name in [
            ('residences', '0006_add_induction_record'),
            ('restauration', '0007_add_menu_jour'),
        ]:
            if (app, name) in applied:
                c.execute(
                    'DELETE FROM django_migrations WHERE app=%s AND name=%s',
                    [app, name]
                )
                print(f'Removed fake entry: {app}.{name}')

        # Fake-apply toutes les autres migrations manquantes
        fixed = []
        now = timezone.now()
        for app, migrations_list in ALL_MIGRATIONS.items():
            for name in migrations_list:
                key = (app, name)
                if key not in applied:
                    c.execute(
                        'INSERT INTO django_migrations (app, name, applied) VALUES (%s, %s, %s)',
                        [app, name, now]
                    )
                    fixed.append(f'{app}.{name}')
        if fixed:
            print(f'Fake-applied: {fixed}')

        # Vérifier état final
        c.execute(\"SELECT COUNT(*) FROM django_migrations WHERE app IN ('residences','restauration') AND name IN ('0006_add_induction_record','0007_add_menu_jour')\")
        count = c.fetchone()[0]
        print(f'Target migrations in DB after cleanup: {count} (expected 0 so migrate runs them)')

except Exception as e:
    import traceback
    traceback.print_exc()
"

# ============================================================
# ÉTAPE 2 : Créer les 2 tables manquantes directement en SQL
# (au cas où migrate échoue encore)
# ============================================================
python manage.py shell -c "
from django.db import connection

with connection.cursor() as c:
    # Table residences_inductionrecord
    c.execute(\"\"\"
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema='public' AND table_name='residences_inductionrecord'
        )
    \"\"\")
    if not c.fetchone()[0]:
        print('Creating residences_inductionrecord...')
        c.execute(\"\"\"
            CREATE TABLE residences_inductionrecord (
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
            )
        \"\"\")
        print('  -> residences_inductionrecord created OK')
    else:
        print('residences_inductionrecord already exists')

    # Table restauration_menujour
    c.execute(\"\"\"
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema='public' AND table_name='restauration_menujour'
        )
    \"\"\")
    if not c.fetchone()[0]:
        print('Creating restauration_menujour...')
        c.execute(\"\"\"
            CREATE TABLE restauration_menujour (
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
            )
        \"\"\")
        print('  -> restauration_menujour created OK')
    else:
        print('restauration_menujour already exists')
"

# ============================================================
# ÉTAPE 3 : migrate + fake les 2 migrations pour cohérence
# ============================================================
python manage.py migrate --noinput --fake-initial || python manage.py migrate --noinput --fake

python manage.py collectstatic --noinput
