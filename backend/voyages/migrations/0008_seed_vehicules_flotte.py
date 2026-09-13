from django.db import migrations

def seed_vehicules(apps, schema_editor):
    VehiculeFlotte = apps.get_model('voyages', 'VehiculeFlotte')
    if VehiculeFlotte.objects.exists():
        return  # deja peuple (ex: redeploiement) - ne pas dupliquer
    vehicules = [
        ("Land Cruiser A", "4x4", "CI-1234-AB", 7),
        ("Land Cruiser B", "4x4", "CI-5678-CD", 7),
        ("Hilux A", "pickup", "CI-9012-EF", 4),
        ("Hilux B", "pickup", "CI-3456-GH", 4),
        ("Toyota Hiace", "minibus", "CI-7890-IJ", 15),
    ]
    for nom, cat, matricule, capacite in vehicules:
        VehiculeFlotte.objects.create(nom=nom, categorie=cat, matricule=matricule, capacite=capacite)

def unseed(apps, schema_editor):
    pass  # pas de retrait automatique - eviter de supprimer des donnees modifiees depuis

class Migration(migrations.Migration):
    dependencies = [('voyages', '0007_vehiculeflotte')]
    operations = [migrations.RunPython(seed_vehicules, unseed)]
