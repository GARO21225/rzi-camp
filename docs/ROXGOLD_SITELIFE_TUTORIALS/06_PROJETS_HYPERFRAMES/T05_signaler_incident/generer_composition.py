#!/usr/bin/env python3
"""T05 : Signaler un incident de maintenance. Configuration de la composition HyperFrames.
Usage : python3 generer_composition.py <gsap.min.js 3.14.2> <dossier @fontsource/ibm-plex-sans/files>
Le rendu est fait par le module commun ../_commun/generateur_tutoriel.py.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_commun"))
from generateur_tutoriel import generer

CFG = {
    "dossier": os.path.dirname(os.path.abspath(__file__)),
    "code": "T05", "titre": "Signaler un incident de maintenance",
    "titre_intro_html": "Signaler un incident<br>de maintenance",
    "etiquette": "Tutoriel · Espace résident",
    "plans": [("p01",4),("p02",11),("p03",8),("p04",6),("p05",6),("p06",4),("p07",6),
              ("p08",8),("p09",9),("p10",9),("p11",7),("p12",8),("p13",10),("p14",4)],
    "plan_solution": "p03",
    "etapes_total": 6,
    "constat": {"plan": "p02", "titre": "Une panne dans votre chambre…", "decor": "clim",
                "maux": [("Signalé de vive voix", 4.2), ("Vite oublié", 5.6), ("Aucun suivi", 7.4)]},
    # zone = (x, y, w, h, t_relatif, zoom|None) en pixels de la capture (1170 × 1992)
    "telephone": {
        "p03": ("04_maintenance_liste.png", None, "Roxgold SiteLife", "Déclarer · Prioriser · Suivre", "La maintenance du camp, depuis votre téléphone.", []),
        "p04": ("03_accueil.png", 1, "Point d'entrée", "Onglet « Signaler »", "Barre d'onglets, en bas de l'écran d'accueil.", [(774,1770,170,180,0.4,None)]),
        "p05": ("04_maintenance_liste.png", 2, "Ouvrir le formulaire", "Bouton « + »", "Page Maintenance, bouton doré en bas à droite.", [(943,1519,190,190,0.5,None)]),
        "p06": ("05_formulaire_vide.png", None, "Le formulaire", "Déclarer un incident", "Les champs marqués * sont obligatoires.", []),
        "p07": ("06_titre.png", 3, "Titre", "Un titre court", "Exemple : « Climatiseur en panne ».", [(96,240,980,210,0.5,1.7)]),
        "p08": ("07_description_categorie_priorite.png", 4, "Décrire", "Description · Catégorie · Priorité", "Catégorie : Climatisation · Priorité : Haute.",
                [(96,480,980,320,0.4,1.5),(96,850,980,200,3.0,None),(96,1090,980,200,5.0,None)]),
        "p09": ("08_lieu_et_envoi.png", 5, "Localiser", "Type de lieu · Résidence · Bloc", "Hébergement ou autre infrastructure du camp.",
                [(96,790,980,220,0.4,1.4),(96,1030,980,205,3.6,None),(96,1262,980,205,6.0,None)]),
        "p10": ("08_lieu_et_envoi.png", 6, "Envoyer", "Photo · Délai · Déclarer", "Le délai de traitement suit la priorité.",
                [(96,1488,980,140,0.4,1.4),(96,1652,980,120,2.6,None),(96,1792,980,150,6.4,None)]),
        "p11": ("09_incident_declare.png", None, "Résultat", "Incident déclaré", "Statut « Déclaré » et date d'échéance (SLA).", [(54,862,1068,532,0.6,1.35)]),
        "p12": ("10_detail_incident.png", None, "Suivi", "Le parcours de l'incident", "Déclaré → Assigné → En cours → Résolu → Clôturé", [(36,700,1100,270,0.6,1.6)]),
    },
    "recentrages": {"p10": [(96,1792,980,150,2.4,1.4)]},
    "taps": {"p10": (585, 1867, 8.0)},
    "resultat": {"plan": "p13", "titre": "Chaque incident est tracé,<br>priorisé et suivi.",
                 "cartes": [("Responsables prévenus", "Notification dès la déclaration"),
                            ("Priorité &amp; échéance", "Délai de traitement automatique"),
                            ("Suivi tracé", "Déclaré → Assigné → En cours → Résolu → Clôturé")]},
    "conclusion": {"plan": "p14", "phrase": "Un signalement, un suivi.", "chemin": "Maintenance › Signaler"},
    "sous_titres": [
        (0.3,3.6,"Roxgold SiteLife.<br>Signaler un incident de maintenance."),
        (4.3,7.8,"Un climatiseur qui ne refroidit plus.<br>Une fuite sous le lavabo."),
        (8.0,14.6,"Signalé de vive voix, le problème est vite oublié…<br>et personne ne sait où en est la réparation."),
        (15.3,19.2,"Avec Roxgold SiteLife, vous déclarez l'incident<br>depuis votre téléphone, en quelques gestes."),
        (19.4,22.6,"Il est ensuite suivi jusqu'à sa résolution."),
        (23.3,28.6,"Depuis votre accueil, appuyez sur l'onglet Signaler,<br>en bas de l'écran."),
        (29.3,34.6,"La page Maintenance s'ouvre.<br>Appuyez sur le bouton doré, avec le signe plus."),
        (35.3,38.6,"Le formulaire Déclarer un incident s'affiche."),
        (39.3,44.6,"Commencez par un titre court.<br>Par exemple : Climatiseur en panne."),
        (45.3,48.0,"Décrivez ensuite le problème."),
        (48.1,52.6,"Choisissez la catégorie, ici Climatisation,<br>puis la priorité : Haute."),
        (53.3,57.5,"Indiquez le lieu : Hébergement pour votre chambre,<br>ou Autre infrastructure."),
        (57.7,61.6,"Saisissez la résidence,<br>puis le bloc ou la chambre."),
        (62.3,64.3,"Ajoutez une photo si besoin."),
        (64.5,68.2,"Le délai de traitement est fixé automatiquement<br>selon la priorité."),
        (68.5,70.7,"Appuyez sur Déclarer l'incident."),
        (71.3,77.6,"C'est fait. L'incident apparaît dans votre liste,<br>avec le statut Déclaré et sa date d'échéance."),
        (78.3,85.6,"Touchez-le pour voir son parcours : déclaré,<br>assigné, en cours, résolu, puis clôturé."),
        (86.3,90.0,"Les responsables du camp sont prévenus<br>dès la déclaration."),
        (90.3,95.6,"Chaque incident est tracé, priorisé et suivi,<br>jusqu'à sa résolution."),
        (96.3,99.6,"Roxgold SiteLife.<br>Un signalement, un suivi."),
    ],
}

if __name__ == "__main__":
    generer(CFG)
