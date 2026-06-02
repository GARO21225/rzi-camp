"""
Migration de sécurité — Ajouter colonnes manquantes (PostgreSQL uniquement)
Pour SQLite: skip automatiquement
"""
from django.db import migrations


def add_columns_if_needed(apps, schema_editor):
    """Ajouter les colonnes manquantes de manière idempotente."""
    if schema_editor.connection.vendor != 'postgresql':
        return  # SQLite ignore cette migration
    
    columns = [
        ('date_assignation', 'TIMESTAMP WITH TIME ZONE'),
        ('date_debut',       'TIMESTAMP WITH TIME ZONE'),
        ('date_cloture',     'TIMESTAMP WITH TIME ZONE'),
        ('date_resolution',  'TIMESTAMP WITH TIME ZONE'),
        ('photo_base64',     "TEXT DEFAULT ''"),
        ('photo_mime',       "VARCHAR(50) DEFAULT 'image/jpeg'"),
        ('photo_resolution_base64', "TEXT DEFAULT ''"),
        ('latitude',         'DECIMAL(10,7)'),
        ('longitude',        'DECIMAL(10,7)'),
        ('sla_depasse',      'BOOLEAN DEFAULT FALSE'),
        ('sla_echeance',     'TIMESTAMP WITH TIME ZONE'),
        ('sla_notification_envoyee', 'BOOLEAN DEFAULT FALSE'),
        ('commentaire_resolution', "TEXT DEFAULT ''"),
        ('commentaire_cloture',    "TEXT DEFAULT ''"),
    ]
    
    with schema_editor.connection.cursor() as cursor:
        for col, dtype in columns:
            cursor.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name=%s AND column_name=%s",
                ['maintenance_incident', col]
            )
            if not cursor.fetchone():
                try:
                    cursor.execute(
                        f"ALTER TABLE maintenance_incident ADD COLUMN {col} {dtype}"
                    )
                except Exception as e:
                    pass  # Colonne déjà existante


class Migration(migrations.Migration):
    dependencies = [
        ('maintenance', '0005_convert_statuts'),
    ]

    operations = [
        migrations.RunPython(add_columns_if_needed, migrations.RunPython.noop),
    ]
