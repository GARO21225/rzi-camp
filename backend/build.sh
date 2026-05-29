#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt

# Fix: si 0006 est appliqué sans 0005, fake-apply 0005 pour résoudre l'incohérence
python manage.py shell -c "
from django.db import connection
try:
    with connection.cursor() as c:
        # Vérifier si 0006 applied mais pas 0005
        c.execute(\"SELECT COUNT(*) FROM django_migrations WHERE app='restauration' AND name='0006_add_bon_caisse'\")
        has_06 = c.fetchone()[0]
        c.execute(\"SELECT COUNT(*) FROM django_migrations WHERE app='restauration' AND name='0005_boutique_image_textfield'\")
        has_05 = c.fetchone()[0]
        if has_06 and not has_05:
            from django.utils import timezone
            c.execute(\"INSERT INTO django_migrations (app, name, applied) VALUES ('restauration', '0005_boutique_image_textfield', %s)\", [timezone.now()])
            print('Fixed: fake-applied restauration.0005')
        else:
            print(f'OK: 0005={has_05} 0006={has_06}')
except Exception as e:
    print(f'Skip fix: {e}')
"

python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py seed_db
