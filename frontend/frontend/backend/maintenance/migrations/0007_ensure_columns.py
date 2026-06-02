"""
Migration de sécurité 0007 — Appliquer colonnes manquantes sur PostgreSQL
Compatible Render, idempotent
"""
from django.db import migrations


def apply_missing_columns(apps, schema_editor):
    """Ajoute toutes les colonnes optionnelles si absentes (PostgreSQL uniquement)."""
    if schema_editor.connection.vendor != 'postgresql':
        return
    
    cols = [
        ("date_assignation",          "TIMESTAMP WITH TIME ZONE"),
        ("date_debut",                "TIMESTAMP WITH TIME ZONE"),
        ("date_cloture",              "TIMESTAMP WITH TIME ZONE"),
        ("date_resolution",           "TIMESTAMP WITH TIME ZONE"),
        ("photo_base64",              "TEXT DEFAULT ''"),
        ("photo_mime",                "VARCHAR(50) DEFAULT 'image/jpeg'"),
        ("photo_resolution_base64",   "TEXT DEFAULT ''"),
        ("latitude",                  "DECIMAL(10,7)"),
        ("longitude",                 "DECIMAL(10,7)"),
        ("sla_depasse",               "BOOLEAN DEFAULT FALSE"),
        ("sla_echeance",              "TIMESTAMP WITH TIME ZONE"),
        ("sla_notification_envoyee",  "BOOLEAN DEFAULT FALSE"),
        ("commentaire_resolution",    "TEXT DEFAULT ''"),
        ("commentaire_cloture",       "TEXT DEFAULT ''"),
    ]
    
    with schema_editor.connection.cursor() as cursor:
        for col, dtype in cols:
            cursor.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='maintenance_incident' AND column_name=%s",
                [col]
            )
            if not cursor.fetchone():
                cursor.execute(
                    f"ALTER TABLE maintenance_incident ADD COLUMN {col} {dtype}"
                )


class Migration(migrations.Migration):
    dependencies = [
        ("maintenance", "0006_add_missing_columns"),
    ]
    operations = [
        migrations.RunPython(apply_missing_columns, migrations.RunPython.noop),
    ]
