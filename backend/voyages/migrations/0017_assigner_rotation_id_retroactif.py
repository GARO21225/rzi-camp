from django.db import migrations
import uuid

def assigner_rotation_id(apps, schema_editor):
    """
    Avant l'unification 'voyage individuel' = rotation a 1 passager, les
    voyages individuels crees via l'ancien chemin (POST direct /api/voyages/)
    n'avaient JAMAIS de rotation_id. Sans lui, ils n'apparaissent jamais
    dans l'onglet Rotations, quel que soit le correctif applique depuis -
    la requete de regroupement exclut explicitement les rotation_id vides.

    On leur attribue retroactivement un rotation_id unique (comme s'ils
    avaient ete crees via creer_rotation avec un seul passager), pour
    qu'ils deviennent enfin visibles.
    """
    Voyage = apps.get_model('voyages', 'Voyage')
    orphelins = Voyage.objects.filter(
        rotation_id__isnull=True
    ).exclude(statut='annule')
    # SQLite/Postgres : rotation_id peut aussi etre une chaine vide plutot que NULL
    orphelins_vides = Voyage.objects.filter(rotation_id='').exclude(statut='annule')
    for v in list(orphelins) + list(orphelins_vides):
        v.rotation_id = str(uuid.uuid4())[:8].upper()
        if not v.nb_places_total:
            v.nb_places_total = 1
        v.save(update_fields=['rotation_id', 'nb_places_total'])

def unassigner(apps, schema_editor):
    pass

class Migration(migrations.Migration):
    dependencies = [('voyages', '0016_auto_valide_retroactif_admin')]
    operations = [migrations.RunPython(assigner_rotation_id, unassigner)]
