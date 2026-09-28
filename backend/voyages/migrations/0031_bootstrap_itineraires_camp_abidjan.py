# Seed des 2 itineraires types demandes (Centre de Mobilite) : "Camp ->
# Abidjan" avec les villes/distances/heures/pauses telles que fournies
# (document JMP de reference), et son symetrique "Abidjan -> Camp" (meme
# route, ordre inverse - les heures dependent de l'heure de depart choisie
# a Abidjan donc laissees vides pour ce sens, a completer cote admin).
#
# Donnees de depart uniquement - modifiables ensuite sans repasser par une
# migration (ecran Centre de Mobilite / Parametrage), comme le logo JMP
# (voir accounts/migrations/0011_bootstrap_jmp_logo.py).

from django.db import migrations

# Chaque etape = la ville ATTEINTE a ce tronçon (meme convention que
# "villesIntermediaires" cote frontend - MissionControl.jsx) avec la
# distance PARCOURUE depuis la ville precedente.
ETAPES_CAMP_ABIDJAN = [
    # ville,          distance_km, heure_depart, heure_arrivee, pause_fatigue
    ("SEGUELA",      36.0,  "06:30", "07:20", ""),
    ("MANKONO",      54.0,  "07:20", "08:20", ""),
    ("TIENINGBOUE",  57.0,  "08:20", "09:20", "10 MIN DE PAUSE"),
    ("BOUAKE",       110.0, "09:30", "10:40", "15 MIN DE PAUSE"),
    ("YAMOUSSOUKRO", 86.0,  "10:55", "11:55", "15 MIN DE PAUSE"),
    ("ABIDJAN",      236.0, "12:10", "15:10", ""),
]


def creer_itineraires(apps, schema_editor):
    ItineraireModele = apps.get_model('voyages', 'ItineraireModele')
    EtapeItineraireModele = apps.get_model('voyages', 'EtapeItineraireModele')

    aller, _ = ItineraireModele.objects.get_or_create(
        nom="Camp → Abidjan", defaults={"origine": "CAMP", "destination": "ABIDJAN"},
    )
    for i, (ville, dist, h_dep, h_arr, pause) in enumerate(ETAPES_CAMP_ABIDJAN, start=1):
        EtapeItineraireModele.objects.get_or_create(
            itineraire=aller, ordre=i,
            defaults={"ville": ville, "distance_km": dist, "heure_depart": h_dep,
                      "heure_arrivee": h_arr, "pause_fatigue": pause},
        )

    # Route complete avec point de depart, pour construire le sens inverse :
    # CAMP -> SEGUELA -> ... -> ABIDJAN
    route_aller = ["CAMP"] + [e[0] for e in ETAPES_CAMP_ABIDJAN]
    distances_aller = [e[1] for e in ETAPES_CAMP_ABIDJAN]
    pauses_aller = [e[4] for e in ETAPES_CAMP_ABIDJAN]

    # Sens inverse : ABIDJAN -> YAMOUSSOUKRO -> ... -> CAMP. La ville
    # atteinte a l'etape i (retour) est route_aller[-2-i], la distance et
    # la pause de ce tronçon sont celles du meme tronçon physique a l'aller,
    # juste parcouru en sens inverse.
    retour, _ = ItineraireModele.objects.get_or_create(
        nom="Abidjan → Camp", defaults={"origine": "ABIDJAN", "destination": "CAMP"},
    )
    n = len(ETAPES_CAMP_ABIDJAN)
    for i in range(n):
        ville = route_aller[n - 1 - i]  # avant-derniere ville, puis avant-avant-derniere, ... jusqu'a CAMP
        distance = distances_aller[n - 1 - i]
        pause = pauses_aller[n - 1 - i]
        EtapeItineraireModele.objects.get_or_create(
            itineraire=retour, ordre=i + 1,
            defaults={"ville": ville, "distance_km": distance, "pause_fatigue": pause},
        )


def inverse(apps, schema_editor):
    ItineraireModele = apps.get_model('voyages', 'ItineraireModele')
    ItineraireModele.objects.filter(nom__in=["Camp → Abidjan", "Abidjan → Camp"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('voyages', '0030_itinerairemodele_etapeitinerairemodele'),
    ]

    operations = [
        migrations.RunPython(creer_itineraires, inverse),
    ]
