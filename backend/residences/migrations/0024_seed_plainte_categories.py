from django.db import migrations

# Seed les categories/sous-categories historiques (ex-Plainte.CATEGORIES en
# dur dans models.py) dans la nouvelle table PlainteCategorie, pour que les
# plaintes existantes et le formulaire de plainte continuent de fonctionner
# a l'identique juste apres le deploiement - avant que l'admin ne vienne
# les modifier depuis Parametrage > Gestion des plaintes.
CATEGORIES_SEED = [
    ("Proprete", ["poubelle","sol","plafond","murs","fenetres","porte","mobilier","douche","wc","lavabo","miroir","autre"]),
    ("Fournitures", ["couverture","drap","serviette","savon","gel_lave_mains","serpillere","insecticide","desodorisant","autre"]),
    ("Electricite", ["lumiere","interrupteur","prise","autre"]),
    ("Equipements", ["ordinateur","climatiseur","refrigerateur","television","autre"]),
    ("Plomberie", ["douche","wc","lavabo","fuite","canalisation","autre"]),
    ("Securite", ["serrure","poignee","porte","fenetre","cle","autre"]),
    ("Etat_chambre", ["peinture","humidite","degradation","autre"]),
    ("Autre", ["autre"]),
]


def seed(apps, schema_editor):
    PlainteCategorie = apps.get_model("residences", "PlainteCategorie")
    for i, (nom, sous) in enumerate(CATEGORIES_SEED):
        PlainteCategorie.objects.get_or_create(
            nom=nom, defaults={"sous_categories": sous, "actif": True, "ordre": i})


def unseed(apps, schema_editor):
    PlainteCategorie = apps.get_model("residences", "PlainteCategorie")
    PlainteCategorie.objects.filter(nom__in=[c[0] for c in CATEGORIES_SEED]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('residences', '0023_plaintecategorie_alter_historicalplainte_categorie_and_more'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
