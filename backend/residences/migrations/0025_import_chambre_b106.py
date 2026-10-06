"""Ajoute la chambre B106 (géométrie issue du KML fourni) si elle n'existe pas.

B106 était saisie par erreur sous le nom « B196 » (supprimée depuis). Idempotent :
si B106 existe déjà, seule sa géométrie manquante est complétée. Le bloc est celui
de la chambre la plus proche (Bloc_B3 par défaut)."""
from django.db import migrations

RING = [
    [-6.82206857897532, 8.11142180844452],
    [-6.8220346228496, 8.1114544312971],
    [-6.82200885281971, 8.11142779363678],
    [-6.82204280894412, 8.11139517078627],
    [-6.82206857897532, 8.11142180844452],
]


def ajouter_b106(apps, schema_editor):
    Batiment = apps.get_model("residences", "Batiment")
    cx = sum(p[0] for p in RING[:-1]) / 4
    cy = sum(p[1] for p in RING[:-1]) / 4
    geom = {"type": "Polygon", "coordinates": [RING]}
    b = Batiment.objects.filter(residence="B106").first()
    if b is None:
        bloc = "Bloc_B3"
        best = None
        for o in Batiment.objects.exclude(latitude__isnull=True).exclude(longitude__isnull=True):
            d = (o.longitude - cx) ** 2 + (o.latitude - cy) ** 2
            if best is None or d < best[0]:
                best = (d, o.bloc)
        if best:
            bloc = best[1]
        Batiment.objects.create(residence="B106", bloc=bloc, statut="Libre",
                                latitude=cy, longitude=cx, geojson_geometry=geom)
    elif not b.geojson_geometry:
        b.latitude, b.longitude, b.geojson_geometry = cy, cx, geom
        b.save()


class Migration(migrations.Migration):
    dependencies = [("residences", "0024_seed_plainte_categories")]
    operations = [migrations.RunPython(ajouter_b106, migrations.RunPython.noop)]
