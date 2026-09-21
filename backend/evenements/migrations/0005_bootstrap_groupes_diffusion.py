# Groupes de diffusion par defaut, pour couvrir les cas exprimes
# explicitement ("residents sur le camp", "employes uniquement de
# Roxgold") sans que l'admin ait a tout configurer depuis zero. Modifiable
# ou supprimable ensuite depuis Parametrage -> Groupes de diffusion.

from django.db import migrations


def creer_groupes_defaut(apps, schema_editor):
    GroupeDiffusion = apps.get_model('evenements', 'GroupeDiffusion')
    defauts = [
        dict(nom="Résidents actifs du camp", description="Personnel actuellement logé dans une chambre occupée (comportement historique)",
             uniquement_residents_actifs=True, est_defaut=True),
        dict(nom="Employés Roxgold uniquement", description="Toute personne dont la société est ROXGOLD, résidente ou non",
             filtre_societe="ROXGOLD"),
        dict(nom="Tout le personnel", description="Aucun filtre - absolument tout le personnel actif"),
    ]
    for d in defauts:
        GroupeDiffusion.objects.get_or_create(nom=d["nom"], defaults=d)


def inverse(apps, schema_editor):
    GroupeDiffusion = apps.get_model('evenements', 'GroupeDiffusion')
    GroupeDiffusion.objects.filter(nom__in=[
        "Résidents actifs du camp", "Employés Roxgold uniquement", "Tout le personnel",
    ]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('evenements', '0004_groupediffusion_evenement_groupe_diffusion_and_more'),
    ]

    operations = [
        migrations.RunPython(creer_groupes_defaut, inverse),
    ]
