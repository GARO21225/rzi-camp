from django.db import migrations


def efface(apps, schema_editor):
    """La provenance d'import ("Importé de SIG_V2.kml — couche …") n'a pas à s'afficher dans la carte."""
    PointInteret = apps.get_model("residences", "PointInteret")
    PointInteret.objects.filter(description__startswith="Importé de SIG_V2.kml").update(description="")


class Migration(migrations.Migration):
    dependencies = [("residences", "0035_plainte_sla")]
    operations = [migrations.RunPython(efface, migrations.RunPython.noop)]
