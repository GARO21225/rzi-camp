"""
Corrige la cause reelle du "203 vs 204" : le fixture de seed_db.py
contenait DEUX batiments avec le meme code "residence" = "B186" (Bloc_14) -
un a l'index 192 (deja seede depuis le debut) et un second, issu du
tracé shapefile fourni par l'utilisateur (204e.shp/.dbf/.prj, projection
WGS_1984_UTM_Zone_29N reprojetee en WGS84), qui avait la MEME etiquette
"B186" par erreur de saisie sur la carte SIG.

Comme `Batiment.residence` est unique, `get_or_create(residence="B186", ...)`
ne creait jamais le second batiment (deja existant => no-op silencieux,
aucune erreur) : d'ou 204 entrees dans le fixture mais seulement 203
lignes reelles en base, sur la carte ET dans la liste Residences.

Diagnostic (verifie, pas invente) : dans Bloc_14, la sequence des codes
est B181, B182, B183, B184, B185, B186, [manquant], B188, B189, B190,
B191, B192 - "B187" est le seul numero absent d'une sequence par ailleurs
continue. Le batiment trace dans le shapefile fourni correspond
exactement (memes coordonnees, a 6 decimales pres) a l'entree dupliquee
"B186" du fixture - c'est donc bien lui qui doit porter le code "B187".

Cette migration cree ce 204e batiment s'il n'existe pas deja (idempotent,
comme le reste du seeding), avec la geometrie exacte extraite du
shapefile (reprojetee UTM 29N -> WGS84).
"""
from django.db import migrations


GEOM_B187 = {
    "type": "Polygon",
    "coordinates": [[
        [-6.821214551334276, 8.111155596568848],
        [-6.821181970406529, 8.111121608905442],
        [-6.821208700704688, 8.111095928237395],
        [-6.821241436890765, 8.111129766738259],
        [-6.821214551334276, 8.111155596568848],
    ]],
}


def creer_batiment_b187(apps, schema_editor):
    Batiment = apps.get_model("residences", "Batiment")
    if Batiment.objects.filter(residence="B187").exists():
        return
    Batiment.objects.get_or_create(
        residence="B187",
        defaults={
            "bloc": "Bloc_14",
            "statut": "Libre",
            "latitude": round(8.1111317, 8),
            "longitude": round(-6.82121224, 8),
            "geojson_geometry": GEOM_B187,
        },
    )


def supprimer_batiment_b187(apps, schema_editor):
    Batiment = apps.get_model("residences", "Batiment")
    Batiment.objects.filter(residence="B187", personnel__isnull=True, occupant__isnull=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("residences", "0020_plainte_historicalplainte_historicalcontrolechambre_and_more"),
    ]

    operations = [
        migrations.RunPython(creer_batiment_b187, supprimer_batiment_b187),
    ]
