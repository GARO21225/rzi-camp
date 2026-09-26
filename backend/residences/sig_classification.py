"""
Logique CENTRALISEE de classification des elements SIG importes depuis
SIG_V2.kml (5 couches : Delimitation, Relief>TALUS, Sport, Circulation>
FOOT-PATH/Escalier, Infra). Utilisee par la commande `import_sig` et par
l'API (le frontend affiche ce que le backend a deja classe - aucune
regle de classification cote React, conformement au prompt : "logique
centralisee, ne mets pas les regles dans plusieurs composants React").

Regle du prompt appliquee : la classification se fait D'ABORD sur le nom
du Placemark (normalise : accents/casse/espaces ignores, variantes
orthographiques reconnues), types specifiques avant generiques. Quand le
nom est un identifiant generique auto-genere par le logiciel SIG (motif
"kml_<n>", sans aucune information), il n'y a - par definition - rien a
lire dans le nom : on se rabat alors sur le nom de la couche/dossier qui
contient l'element (ex : dossier "TALUS" -> type "Talus en pierre"),
ce qui reste un rattachement documente et jamais une invention de
donnee. Un element dont ni le nom ni la couche ne permettent une
classification fiable est marque "Autre SIG / Non classifie" (jamais
supprime, jamais transforme en residence) - voir NOM_GENERIQUE_RE et
CLASSIFICATION_PAR_COUCHE ci-dessous.
"""
import re
import unicodedata

NOM_GENERIQUE_RE = re.compile(r"^kml_\d+$", re.IGNORECASE)


def normaliser(texte: str) -> str:
    """minuscules, accents retires, espaces multiples reduits."""
    if not texte:
        return ""
    t = unicodedata.normalize("NFKD", texte)
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = t.lower().strip()
    t = re.sub(r"\s+", " ", t)
    return t


# Categorie SIG (haut niveau, sert aux couches/toggles carte) et modele
# cible : 'point_interet' (PointInteret, geometrie ponctuelle ou polygone
# de faible emprise = un batiment non-residentiel) ou 'chemin_circulation'
# (CheminCirculation, reseau lineaire : chemin/escalier/talus/cloture).
CATEGORIES_SIG = {
    "infrastructures":            "Infrastructures",
    "circulation_amenagements":   "Circulation / Aménagements",
    "relief_terrain":             "Relief / Terrain",
    "securite_delimitation":      "Sécurité / Délimitation",
    "autre_sig":                  "Autre SIG",
}

# Ordre = priorite : les motifs specifiques doivent etre testes AVANT les
# motifs generiques (ex: "salle de sport" avant "salle", "toilette
# commune" avant "toilette"). Chaque entree :
# (motifs_normalises, categorie_sig, type_label, cible_modele, code_champ, icone)
REGLES_NOM = [
    # --- Infrastructures (PointInteret) ---
    (["salle de sport"],                    "infrastructures", "Salle de sport",       "point_interet", "sport",             "🏋️"),
    (["terrain de sport", "football court", "basketball court", "basket court", "tennis court", "sport court", "court de sport"],
                                             "infrastructures", "Terrain de sport",     "point_interet", "terrain_sport",     "🏟️"),
    (["toilette commune"],                  "infrastructures", "Toilette commune",     "point_interet", "toilette_commune",  "🚻"),
    (["bureau communautaire"],              "infrastructures", "Bureau communautaire", "point_interet", "communautaire",     "🏢"),
    (["bureau d'accueil", "bureau accueil", "reception"], "infrastructures", "Bureau d'accueil", "point_interet", "accueil", "🛎️"),
    (["salle de reunion", "salle reunion", "meeting room"], "infrastructures", "Salle de réunion", "point_interet", "reunion", "🗣️"),
    (["salle serveur", "salle des serveurs", "server room"], "infrastructures", "Salle serveur", "point_interet", "serveur", "🖥️"),
    (["bureau ats"],                         "infrastructures", "Bureau ATS",           "point_interet", "ats",               "🏢"),
    (["infirmerie", "infirmary", "clinique"],"infrastructures", "Infirmerie",           "point_interet", "infirmerie",        "⚕️"),
    (["parking", "sparking"],               "infrastructures", "Parking",              "point_interet", "parking",           "🅿️"),
    (["guerite", "security hut", "poste de garde"], "infrastructures", "Guérite",       "point_interet", "guerite",           "💂"),
    (["restaurant", "cantine", "refectoire"],"infrastructures", "Restaurant",           "point_interet", "restaurant",        "🍽️"),
    (["bar"],                                "infrastructures", "Bar",                  "point_interet", "bar",               "🍺"),
    (["toilette", "restroom", "wc"],        "infrastructures", "Toilette",             "point_interet", "toilette",          "🚽"),
    (["gym", "salle de musculation"],       "infrastructures", "Salle de sport",       "point_interet", "sport",             "🏋️"),

    # --- Circulation / Aménagements (CheminCirculation) ---
    (["dalle de cheminement", "dalle cheminement"], "circulation_amenagements", "Dalle de cheminement", "chemin_circulation", "dallette",   "🧱"),
    (["passerelle"],                        "circulation_amenagements", "Passerelle",           "chemin_circulation", "passerelle", "🌉"),
    (["escalier"],                          "circulation_amenagements", "Escalier",             "chemin_circulation", "escalier",   "🪜"),
    (["voirie"],                            "circulation_amenagements", "Voirie",               "chemin_circulation", "voirie",     "🛣️"),
    (["rampe"],                             "circulation_amenagements", "Rampe",                "chemin_circulation", "rampe",      "🛤️"),
    (["foot-path", "footpath", "chemin", "foot path"], "circulation_amenagements", "Chemin",     "chemin_circulation", "chemin",     "🚶"),

    # --- Relief / Terrain (CheminCirculation) ---
    (["talus en pierre", "talus"],          "relief_terrain", "Talus en pierre",        "chemin_circulation", "talus",      "⛰️"),

    # --- Sécurité / Délimitation (CheminCirculation) ---
    (["cloture", "delimitation"],           "securite_delimitation", "Clôture",         "chemin_circulation", "cloture",    "🚧"),
]

# Repli par NOM DE COUCHE quand le Placemark porte un identifiant
# generique (kml_N) - un dossier "TALUS" documente lui-meme le type de
# ses elements, exactement comme le prompt l'illustre. Chaque entree est
# une regle NOM (memes 6 champs) appliquee au dernier segment du chemin
# de couches.
CLASSIFICATION_PAR_COUCHE = {
    "talus":       ("relief_terrain", "Talus en pierre", "chemin_circulation", "talus", "⛰️"),
    "foot-path":   ("circulation_amenagements", "Chemin", "chemin_circulation", "chemin", "🚶"),
    "escalier":    ("circulation_amenagements", "Escalier", "chemin_circulation", "escalier", "🪜"),
    "delimitation":("securite_delimitation", "Clôture", "chemin_circulation", "cloture", "🚧"),
}


def classifier(nom_original: str, layer_path: list[str]) -> dict:
    """
    Renvoie {nom, categorie_sig, categorie_sig_label, type_label,
    cible_modele, code_champ, icone, reconnu, methode} - 'methode' vaut
    'nom' ou 'couche_repli' ou 'non_classifie', pour tracabilite/rapport.
    """
    nom_norm = normaliser(nom_original)

    if not NOM_GENERIQUE_RE.match(nom_original.strip()):
        for motifs, cat, type_label, cible, code_champ, icone in REGLES_NOM:
            for motif in motifs:
                if motif in nom_norm:
                    return {
                        "nom": nom_original, "categorie_sig": cat,
                        "categorie_sig_label": CATEGORIES_SIG[cat],
                        "type_label": type_label, "cible_modele": cible,
                        "code_champ": code_champ, "icone": icone,
                        "reconnu": True, "methode": "nom",
                    }
        # Nom descriptif mais aucun motif connu : NE PAS deviner.
        return {
            "nom": nom_original, "categorie_sig": "autre_sig",
            "categorie_sig_label": CATEGORIES_SIG["autre_sig"],
            "type_label": "Non classifié", "cible_modele": "point_interet",
            "code_champ": "autre", "icone": "📍",
            "reconnu": False, "methode": "non_classifie",
        }

    # Nom generique (kml_N) -> repli sur le nom de la derniere couche.
    derniere_couche = normaliser(layer_path[-1]) if layer_path else ""
    if derniere_couche in CLASSIFICATION_PAR_COUCHE:
        cat, type_label, cible, code_champ, icone = CLASSIFICATION_PAR_COUCHE[derniere_couche]
        return {
            "nom": nom_original, "categorie_sig": cat,
            "categorie_sig_label": CATEGORIES_SIG[cat],
            "type_label": type_label, "cible_modele": cible,
            "code_champ": code_champ, "icone": icone,
            "reconnu": True, "methode": "couche_repli",
        }

    return {
        "nom": nom_original, "categorie_sig": "autre_sig",
        "categorie_sig_label": CATEGORIES_SIG["autre_sig"],
        "type_label": "Non classifié", "cible_modele": "point_interet",
        "code_champ": "autre", "icone": "📍",
        "reconnu": False, "methode": "non_classifie",
    }
