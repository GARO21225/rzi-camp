"""
Import reproductible et idempotent des elements SIG_V2.kml (5 couches :
Delimitation, Relief>TALUS, Sport, Circulation>FOOT-PATH/Escalier, Infra)
vers les modeles existants du projet - PointInteret (infrastructures
ponctuelles/emprises) et CheminCirculation (reseau lineaire : chemins,
escaliers, talus, clotures) - reutilises tels quels, sans creer de
nouveaux modeles, conformement au prompt ("cherche d'abord si le projet
possede deja PointInteret/Infrastructure/Equipement, reutilise-la si
possible").

Source des donnees : backend/residences/data/sig_v2_elements.json,
extrait UNE FOIS de SIG_V2.kml fourni par l'utilisateur (coordonnees
KML brutes, deja en WGS84 lon/lat - le format KML impose ce CRS, verifie
ici en comparant les valeurs de longitude/latitude a celles, deja
connues, des 204 residences du meme camp : memes ordres de grandeur,
donc pas de reprojection necessaire, contrairement au Shapefile du 204e
batiment qui lui etait en UTM 29N). Ce fichier JSON est commis dans le
depot exactement comme le fixture de seed_db.py commet les 203+1
batiments - c'est la meme methode reutilisee, pas une nouvelle
architecture.

Classification : entierement deleguee a residences.sig_classification
(logique centralisee unique, partagee avec l'API si besoin) - jamais de
regle de classification ici ni cote frontend.

Idempotence : chaque element porte une cle stable `source_ref`
("SIG_V2/<couche.../nom>") posee a l'import - un re-run avec le meme
fichier json ne cree jamais de doublon (update_or_create sur
source_ref). Les elements non reconnus ("Autre SIG") sont importes
quand meme (jamais supprimes, jamais integres aux residences) - a
classifier manuellement plus tard si une regle de nom est ajoutee.

Usage :
    python manage.py import_sig                  # import normal
    python manage.py import_sig --dry-run         # rapport seul, rien n'est ecrit
"""
import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from residences.models import PointInteret, CheminCirculation
from residences.sig_classification import classifier

DATA_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "sig_v2_elements.json"


class Command(BaseCommand):
    help = "Importe les elements SIG_V2.kml (infrastructures, circulation, relief, securite) - idempotent, source_ref evite les doublons."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Analyse et affiche le rapport sans rien ecrire en base.")

    def handle(self, *args, **options):
        if not DATA_FILE.exists():
            self.stderr.write(self.style.ERROR(f"Fichier introuvable : {DATA_FILE}"))
            return

        with open(DATA_FILE, encoding="utf-8") as f:
            elements = json.load(f)

        dry_run = options["dry_run"]
        crees, mis_a_jour, non_reconnus = 0, 0, []

        for el in elements:
            source_ref = el["source_ref"]
            cls = classifier(el["nom"], el["layer_path"])
            if not cls["reconnu"]:
                non_reconnus.append((el["layer_path"], el["nom"]))

            coords = el["coords_lonlat"]  # [(lon, lat), ...]

            if cls["cible_modele"] == "point_interet":
                lons = [c[0] for c in coords]
                lats = [c[1] for c in coords]
                centre_lon = sum(lons) / len(lons)
                centre_lat = sum(lats) / len(lats)
                # Empreinte fermee (>=4 pts, premier == dernier) -> Polygon,
                # comme le 204e batiment (polyligne fermee -> Polygon).
                # Sinon on garde la trace telle quelle en LineString - on
                # ne fabrique jamais une fermeture qui n'existe pas dans
                # la source.
                ferme = len(coords) >= 4 and coords[0] == coords[-1]
                if ferme:
                    geom = {"type": "Polygon", "coordinates": [[[c[0], c[1]] for c in coords]]}
                elif len(coords) >= 2:
                    geom = {"type": "LineString", "coordinates": [[c[0], c[1]] for c in coords]}
                else:
                    geom = None

                defaults = {
                    "nom": el["nom"],
                    "categorie": cls["code_champ"],
                    "latitude": round(centre_lat, 8),
                    "longitude": round(centre_lon, 8),
                    "geojson_geometry": geom,
                    "description": f"Importé de SIG_V2.kml — couche {'/'.join(el['layer_path'])}"
                                    + ("" if cls["reconnu"] else " — NON CLASSIFIÉ automatiquement, à vérifier manuellement"),
                }
                if dry_run:
                    existe = PointInteret.objects.filter(source_ref=source_ref).exists()
                else:
                    obj, created = PointInteret.objects.update_or_create(source_ref=source_ref, defaults=defaults)
                    existe = not created

            elif cls["cible_modele"] == "chemin_circulation":
                # CheminCirculation.points attend [lat, lng] (ordre inverse du GeoJSON).
                points = [[c[1], c[0]] for c in coords]
                defaults = {
                    "nom": el["nom"] if not el["nom"].lower().startswith("kml_") else f"{cls['type_label']} ({el['nom']})",
                    "type_chemin": cls["code_champ"],
                    "points": points,
                }
                if dry_run:
                    existe = CheminCirculation.objects.filter(source_ref=source_ref).exists()
                else:
                    obj, created = CheminCirculation.objects.update_or_create(source_ref=source_ref, defaults=defaults)
                    existe = not created
            else:
                continue

            if dry_run:
                mis_a_jour += 1 if existe else 0
                crees += 0 if existe else 1
            else:
                if existe:
                    mis_a_jour += 1
                else:
                    crees += 1

        prefixe = "[DRY-RUN] " if dry_run else ""
        self.stdout.write(self.style.SUCCESS(
            f"{prefixe}{len(elements)} éléments SIG_V2 traités — {crees} créés, {mis_a_jour} déjà présents (mis à jour)."
        ))
        if non_reconnus:
            self.stdout.write(self.style.WARNING(f"{len(non_reconnus)} élément(s) NON CLASSIFIÉ(S) automatiquement (catégorie 'Autre SIG', conservés tels quels) :"))
            for path, nom in non_reconnus:
                self.stdout.write(f"  - {' > '.join(path)} | {nom}")
