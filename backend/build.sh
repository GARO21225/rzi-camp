#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt

# Fix: la DB Render a des migrations restauration appliquées de façon incohérente
# (certaines migrations manquent dans django_migrations alors que leurs dépendances y sont)
# On fake-apply toute la chaîne restauration dans l'ordre pour rétablir la cohérence
python manage.py shell -c "
from django.db import connection
from django.utils import timezone

ALL_RESTAURATION = [
    '0001_initial',
    '0002_historicalrepaslog_personnel_qrtoken_personnel_and_more',
    '0003_add_boutique_models',
    '0004_boutique_free_category_image',
    '0005_boutique_image_textfield',
    '0006_add_bon_caisse',
    '0007_add_menu_jour',
]

try:
    with connection.cursor() as c:
        # Récupérer toutes les migrations restauration déjà enregistrées
        c.execute(\"SELECT name FROM django_migrations WHERE app='restauration'\")
        applied = {row[0] for row in c.fetchall()}
        print(f'Applied restauration migrations: {sorted(applied)}')

        # Fake-apply toutes celles qui manquent
        fixed = []
        for name in ALL_RESTAURATION:
            if name not in applied:
                c.execute(
                    \"INSERT INTO django_migrations (app, name, applied) VALUES ('restauration', %s, %s)\",
                    [name, timezone.now()]
                )
                fixed.append(name)

        if fixed:
            print(f'Fake-applied: {fixed}')
        else:
            print('All restauration migrations already consistent')
except Exception as e:
    import traceback
    print(f'Fix error: {e}')
    traceback.print_exc()
"

python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py seed_db
