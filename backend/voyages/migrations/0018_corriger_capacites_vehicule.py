from django.db import migrations

def corriger_capacites(apps, schema_editor):
    """
    Des rotations deja creees (ex: 'Land Cruiser A') portent encore
    nb_places_total=15 (valeur par defaut d'avant le verrouillage du champ
    Capacite) au lieu de la vraie capacite du vehicule du catalogue (7).
    Recale retroactivement chaque voyage actif dont le nom de vehicule
    correspond exactement a une entree du catalogue.
    """
    Voyage = apps.get_model('voyages', 'Voyage')
    VehiculeFlotte = apps.get_model('voyages', 'VehiculeFlotte')
    catalogue = {v.nom: v.capacite for v in VehiculeFlotte.objects.all()}
    for v in Voyage.objects.exclude(statut='annule').exclude(vehicule=''):
        vraie_capacite = catalogue.get(v.vehicule)
        if vraie_capacite and v.nb_places_total != vraie_capacite:
            v.nb_places_total = vraie_capacite
            v.save(update_fields=['nb_places_total'])

def annuler(apps, schema_editor):
    pass

class Migration(migrations.Migration):
    dependencies = [('voyages', '0017_assigner_rotation_id_retroactif')]
    operations = [migrations.RunPython(corriger_capacites, annuler)]
