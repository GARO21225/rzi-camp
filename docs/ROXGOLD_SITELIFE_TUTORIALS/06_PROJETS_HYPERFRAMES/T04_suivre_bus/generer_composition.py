#!/usr/bin/env python3
"""T04 : Suivre son bus en direct. Configuration de la composition HyperFrames.
Usage : python3 generer_composition.py <gsap.min.js 3.14.2> <dossier @fontsource/ibm-plex-sans/files>
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_commun"))
from generateur_tutoriel import generer

CFG = {
    "dossier": os.path.dirname(os.path.abspath(__file__)),
    "code": "T04", "titre": "Suivre son bus en direct",
    "titre_intro_html": "Suivre son bus<br>en direct",
    "etiquette": "Tutoriel · Espace résident",
    "plans": [("p01",4),("p02",9),("p03",7),("p04",8),("p05",8),("p06",8),("p07",8),("p08",7),("p09",7),("p10",8),("p11",4)],
    "plan_solution": "p03",
    "etapes_total": 4,
    "constat": {"plan": "p02", "titre": "Sur la route…", "decor": "notes", "notes": ["Où est le bus ?", "Il arrive quand ?", "Je descends où ?"],
                "maux": [("On attend sans information", 3.2), ("On appelle le chauffeur", 4.8), ("Heure d'arrivée inconnue", 6.4)]},
    # zone = (x, y, w, h, t_relatif, zoom|None) en pixels de la capture (1170 × 1992)
    "telephone": {
        "p03": ("02_suivi_carte.png", None, "Roxgold SiteLife", "Votre bus, en direct", "Position, kilomètres restants, heure d'arrivée estimée.", []),
        "p04": ("01_accueil_trajet_en_cours.png", 1, "Point d'entrée", "« Suivre mon bus en direct »", "Sur votre accueil, dès le jour du départ.", [(40,650,1090,850,0.5,None),(60,1300,1050,160,3.6,None)]),
        "p05": ("02_suivi_carte.png", 2, "La carte", "Le bus et votre trajet", "Déjà parcouru en vert · votre descente en or.", [(20,180,1130,890,0.5,None)]),
        "p06": ("02_suivi_carte.png", 2, "L'arrivée", "Heure d'arrivée estimée", "Temps et kilomètres restants.", [(30,1105,1110,330,0.5,None)]),
        "p07": ("03_suivi_parcours.png", 3, "Le parcours", "Arrêts passés et à venir", "Votre montée · votre descente.", [(30,1460,1110,520,0.5,None)]),
        "p08": ("04_suivi_bus_entre.png", 3, "Le parcours", "Où est le bus ?", "Actualisé toutes les 15 secondes.", [(90,1480,1000,110,0.5,None)]),
        "p09": ("05_voyages.png", 4, "Autre accès", "Page Voyages", "« Suivre en direct » sur le trajet en cours.", [(80,1160,385,460,0.5,None)]),
    },
    "taps": {"p04": (585, 1378, 6.4)},
    "resultat": {"plan": "p10", "titre": "Fini l'attente<br>à l'aveugle.",
                 "cartes": [("Le bus en direct", "Sa position sur la carte, en temps réel"),
                            ("Arrivée estimée", "Temps et km restants jusqu'à votre descente"),
                            ("Toujours à jour", "Actualisé toutes les 15 s, alerte si le GPS ne répond plus")]},
    "conclusion": {"plan": "p11", "phrase": "Votre bus, en direct.", "chemin": "Accueil › Suivre mon bus en direct"},
    "sous_titres": [
        (0.3,3.6,"Roxgold SiteLife.<br>Suivre son bus en direct."),
        (4.3,8.2,"Sur la route, on attend souvent sans information :<br>où est le bus ?"),
        (8.4,12.6,"Quand arrive-t-il ?<br>On finit par appeler le chauffeur."),
        (13.3,19.6,"Avec Roxgold SiteLife, vous suivez votre bus en direct,<br>depuis votre téléphone."),
        (20.3,24.0,"Dès le jour du départ,<br>votre accueil affiche votre trajet."),
        (24.2,27.6,"Appuyez sur<br>Suivre mon bus en direct."),
        (28.3,35.6,"La carte montre le bus, le trajet déjà parcouru en vert,<br>et votre descente, en or."),
        (36.3,43.6,"Juste dessous : l'heure d'arrivée estimée,<br>le temps et les kilomètres restants."),
        (44.3,51.6,"Le parcours liste les arrêts :<br>ceux déjà passés, votre montée, puis votre descente."),
        (52.3,58.6,"Vous voyez entre quelles villes se trouve le bus.<br>La position s'actualise toutes les quinze secondes."),
        (59.3,65.6,"Le suivi est aussi accessible depuis la page Voyages :<br>Suivre en direct."),
        (66.3,73.6,"Fini l'attente à l'aveugle : vous savez où est le bus<br>et quand il arrive."),
        (74.3,77.6,"Roxgold SiteLife.<br>Votre bus, en direct."),
    ],
}

if __name__ == "__main__":
    generer(CFG)
