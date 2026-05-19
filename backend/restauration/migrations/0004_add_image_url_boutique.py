from django.db import migrations, models

def add_image_url_if_not_exists(apps, schema_editor):
    """Ajouter image_url seulement si elle n'existe pas déjà"""
    from django.db import connection
    with connection.cursor() as cursor:
        try:
            cursor.execute("SELECT image_url FROM restauration_articleboutique LIMIT 1")
            # Colonne existe déjà - mettre à jour les NULL
            cursor.execute("UPDATE restauration_articleboutique SET image_url='' WHERE image_url IS NULL")
        except Exception:
            # Colonne n'existe pas - Django va la créer via AddField
            pass

class Migration(migrations.Migration):
    dependencies = [('restauration', '0003_add_boutique_models')]
    operations = [
        migrations.RunPython(add_image_url_if_not_exists, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='articleboutique',
            name='image_url',
            field=models.URLField(blank=True, default=''),
        ),
    ]
