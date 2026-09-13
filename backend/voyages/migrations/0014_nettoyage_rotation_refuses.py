from django.db import migrations

def nettoyer(apps, schema_editor):
    """
    Correction retroactive : les voyages refuses ou annules AVANT le fix
    de refuser()/annuler() (qui detache desormais rotation_id) sont restes
    rattaches a leur convoi d'origine, faisant croire qu'ils en font
    toujours partie alors qu'ils ne comptent deja plus dans le manifeste
    actif. On detache ces cas existants pour etre coherent avec les
    nouveaux refus/annulations.
    """
    Voyage = apps.get_model('voyages', 'Voyage')
    Voyage.objects.filter(
        statut='annule'
    ).exclude(rotation_id__isnull=True).exclude(rotation_id='').update(rotation_id=None)

def unnettoyer(apps, schema_editor):
    pass  # pas de retour arriere - on ne peut pas retrouver l'ancien rotation_id

class Migration(migrations.Migration):
    dependencies = [('voyages', '0013_alter_vehiculeflotte_categorie')]
    operations = [migrations.RunPython(nettoyer, unnettoyer)]
