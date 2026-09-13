from django.db import migrations

def nettoyer(apps, schema_editor):
    """
    Nettoyage plus complet que la migration precedente (0014). Celle-ci ne
    ciblait que statut='annule', mais les tout premiers refus (avant meme
    l'ajout de statut='annule' dans refuser()) n'ont JAMAIS eu leur statut
    mis a jour - ils restent avec un statut='planifie' ou autre, tout en
    ayant statut_validation='refuse'. Ces cas passaient donc au travers de
    toutes les corrections precedentes.

    On cible desormais TOUT voyage avec statut_validation='refuse', qu'il
    ait ou non deja statut='annule' : on force statut='annule' (coherence)
    ET on detache rotation_id (plus rattache a aucun convoi actif).
    """
    Voyage = apps.get_model('voyages', 'Voyage')
    refuses = Voyage.objects.filter(statut_validation='refuse')
    refuses.exclude(statut='annule').update(statut='annule')
    refuses.exclude(rotation_id__isnull=True).exclude(rotation_id='').update(rotation_id=None)

def unnettoyer(apps, schema_editor):
    pass

class Migration(migrations.Migration):
    dependencies = [('voyages', '0014_nettoyage_rotation_refuses')]
    operations = [migrations.RunPython(nettoyer, unnettoyer)]
