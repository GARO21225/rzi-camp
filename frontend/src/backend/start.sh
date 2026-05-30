#!/bin/bash
echo "=== RZI Camp Backend Startup ==="
echo "Running migrations..."
python manage.py migrate --run-syncdb
echo "Seeding data..."
python manage.py seed_db
echo "Starting server..."
daphne -b 0.0.0.0 -p ${PORT:-8000} rzi_camp.asgi:application
