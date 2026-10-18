from django.db import migrations

NOMS = ["Restaurant du CAMP", "Restaurant du Process", "Restaurant de l'atelier"]


def retirer_inutilises(apps, schema_editor):
    """Les restaurants ne doivent venir que des Paramètres : on retire les 3 restaurants
    semés par 0014 s'ils n'ont servi à rien (aucun repas scanné, aucun superviseur)."""
    R = apps.get_model("restauration", "Restaurant")
    for r in R.objects.filter(nom__in=NOMS):
        if not r.repas.exists() and not r.superviseurs.exists():
            r.delete()


class Migration(migrations.Migration):
    dependencies = [("restauration", "0014_restaurants_superviseurs")]
    operations = [migrations.RunPython(retirer_inutilises, migrations.RunPython.noop)]
