#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt

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
        '0006_add_induction_record',
        '0007_historicalpersonnel_profil_personnel_profil',
    ],
    'restauration': [
        '0001_initial',
        '0002_historicalrepaslog_personnel_qrtoken_personnel_and_more',
        '0003_add_boutique_models',
        '0004_boutique_free_category_image',
        '0005_boutique_image_textfield',
        '0006_add_bon_caisse',
        '0007_add_menu_jour',
    ],
    'voyages': [
        '0001_initial',
        '0002_historicalvoyage_heure_depart_voyage_heure_depart',
    ],
}

try:
    with connection.cursor() as c:
        # Migrations déjà enregistrées
        c.execute('SELECT app, name FROM django_migrations')
        applied = {(row[0], row[1]) for row in c.fetchall()}
        print(f'Migrations in django_migrations: {len(applied)}')

        # Tables qui existent réellement en DB
        c.execute(\"\"\"
            SELECT table_name FROM information_schema.tables
            WHERE table_schema='public'
            AND table_name IN ('residences_inductionrecord', 'restauration_menujour')
        \"\"\")
        existing_tables = {row[0] for row in c.fetchall()}
        print(f'Target tables in DB: {existing_tables}')

        # Migrations à NE PAS fake-apply (tables absentes => migrate doit les créer)
        must_run = set()
        if 'residences_inductionrecord' not in existing_tables:
            must_run.add(('residences', '0006_add_induction_record'))
            must_run.add(('residences', '0007_historicalpersonnel_profil_personnel_profil'))
            print('Will let migrate create residences_inductionrecord')
        if 'restauration_menujour' not in existing_tables:
            must_run.add(('restauration', '0007_add_menu_jour'))
            print('Will let migrate create restauration_menujour')

        fixed = []
        now = timezone.now()
        for app, migrations_list in ALL_MIGRATIONS.items():
            for name in migrations_list:
                key = (app, name)
                if key in must_run:
                    print(f'  -> Skipping fake: {app}.{name} (migrate will run it)')
                    continue
                if key not in applied:
                    c.execute(
                        'INSERT INTO django_migrations (app, name, applied) VALUES (%s, %s, %s)',
                        [app, name, now]
                    )
                    fixed.append(f'{app}.{name}')

        if fixed:
            print(f'Fake-applied: {fixed}')
        else:
            print('Nothing to fake-apply')
except Exception as e:
    import traceback
    print(f'Fix error: {e}')
    traceback.print_exc()
"

python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py seed_db
