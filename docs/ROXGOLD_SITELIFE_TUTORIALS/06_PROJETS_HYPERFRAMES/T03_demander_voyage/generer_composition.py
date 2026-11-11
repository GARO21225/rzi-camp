#!/usr/bin/env python3
"""T03 : Demander un voyage et suivre sa demande. Configuration de la composition HyperFrames.
Usage : python3 generer_composition.py <gsap.min.js 3.14.2> <dossier @fontsource/ibm-plex-sans/files>
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_commun"))
from generateur_tutoriel import generer

CFG = {
    "dossier": os.path.dirname(os.path.abspath(__file__)),
    "code": "T03", "titre": "Demander un voyage et suivre sa demande",
    "titre_intro_html": "Demander un voyage<br>et suivre sa demande",
    "etiquette": "Tutoriel · Espace résident",
    "plans": [("p01",4),("p02",10),("p03",8),("p04",7),("p05",7),("p06",8),("p07",9),("p08",8),("p09",8),
              ("p10",7),("p11",8),("p12",7),("p13",9),("p14",10),("p15",4)],
    "plan_solution": "p03",
    "etapes_total": 6,
    "constat": {"plan": "p02", "titre": "Partir en repos…", "decor": "notes", "notes": ["Validée ?", "Quel bus ?", "Quelle date ?"],
                "maux": [("Demandes orales ou sur papier", 3.4), ("Aucune réponse tracée", 5.0), ("Statut inconnu", 7.0)]},
    # zone = (x, y, w, h, t_relatif, zoom|None) en pixels de la capture (1170 × 1992)
    "telephone": {
        "p03": ("07_demande_en_attente.png", None, "Roxgold SiteLife", "Demander · Suivre · Partir", "Une demande en ligne, suivie jusqu'à la validation.", []),
        "p04": ("01_accueil_sans_trajet.png", 1, "Point d'entrée", "« Demander un voyage »", "Sur votre accueil, sous « Prochain trajet ».", [(50,955,1070,160,0.5,None)]),
        "p05": ("02_demandes.png", 1, "Point d'entrée", "Bouton « Voyage »", "Le bouton doré au bus, en bas à droite.", [(950,1510,180,195,0.5,None)]),
        "p06": ("03_formulaire.png", 2, "Itinéraire", "Choisir l'itinéraire", "La demande part à l'administration pour validation.", [(96,255,980,205,0.5,None),(96,550,980,160,3.6,None)]),
        "p07": ("04_itineraire.png", 2, "Itinéraire", "Je monte à · Je descends à", "Les jours de circulation s'affichent.", [(96,720,980,280,0.5,None)]),
        "p08": ("05_transport_dates.png", 3, "Transport et dates", "Car du camp ou véhicule personnel", "Départ au moins 48 h à l'avance · date de retour au camp.", [(96,1040,980,240,0.5,None),(96,1325,980,270,3.0,None),(96,1650,980,280,5.4,None)]),
        "p09": ("06_motif_soumettre.png", 4, "Motif", "Motif · Précisions", "Puis « Soumettre la demande ».", [(40,1180,1090,190,0.5,None),(40,1400,1090,320,2.6,None),(420,1825,650,135,5.2,None)]),
        "p10": ("07_demande_en_attente.png", 5, "Suivi", "En attente", "Vous pouvez encore l'annuler.", [(60,780,1050,620,0.5,None),(90,1220,990,140,3.4,None)]),
        "p11": ("08_demande_validee.png", 5, "Suivi", "Validée", "Avec le commentaire de l'administration.", [(60,780,1050,560,0.5,None),(90,1195,990,130,3.2,None)]),
        "p12": ("10_notification.png", 5, "Suivi", "Notification", "La décision arrive dans la cloche.", [(40,400,1090,230,0.5,None)]),
        "p13": ("09_accueil_trajet.png", 6, "Accueil", "Votre prochain trajet", "Date, compte à rebours, villes du trajet.", [(40,650,1090,650,0.5,None)]),
    },
    "taps": {"p04": (585, 1035, 5.6), "p09": (745, 1890, 7.2)},
    "resultat": {"plan": "p14", "titre": "Une demande claire,<br>une décision tracée.",
                 "cartes": [("En quelques gestes", "Itinéraire, dates, motif, depuis le téléphone"),
                            ("Décision tracée", "Validée, ou refusée avec un motif obligatoire"),
                            ("Voyage prêt", "Le trajet apparaît sur l'accueil, retour compris")]},
    "conclusion": {"plan": "p15", "phrase": "Demandez, suivez, partez.", "chemin": "Accueil › Demander un voyage"},
    "sous_titres": [
        (0.3,3.6,"Roxgold SiteLife.<br>Demander un voyage et suivre sa demande."),
        (4.3,8.2,"Pour partir en repos, la demande se fait souvent<br>à l'oral ou sur papier."),
        (8.4,13.6,"Sans réponse tracée,<br>difficile de savoir si elle est validée."),
        (14.3,21.6,"Avec Roxgold SiteLife, vous faites votre demande en ligne<br>et vous la suivez jusqu'à la validation."),
        (22.3,28.6,"Depuis votre accueil,<br>appuyez sur Demander un voyage."),
        (29.3,35.6,"La page Demandes s'ouvre.<br>Appuyez sur le bouton doré au bus."),
        (36.3,39.8,"Votre demande sera envoyée<br>à l'administration pour validation."),
        (40.0,43.6,"Choisissez d'abord l'itinéraire."),
        (44.3,48.6,"Indiquez où vous montez<br>et où vous descendez."),
        (48.8,52.6,"Les jours de circulation s'affichent :<br>ici, lundi, mercredi et vendredi."),
        (53.3,56.0,"Choisissez le car du camp<br>ou votre véhicule personnel."),
        (56.2,60.6,"Puis la date de départ, au moins 48 heures à l'avance,<br>et la date de retour au camp."),
        (61.3,65.6,"Choisissez le motif,<br>ajoutez des précisions si besoin,"),
        (65.8,68.6,"puis appuyez sur Soumettre la demande."),
        (69.3,75.6,"La demande apparaît : En attente.<br>Tant qu'elle n'est pas traitée, vous pouvez l'annuler."),
        (76.3,83.6,"L'administration la valide :<br>le statut passe à Validée, avec son commentaire."),
        (84.3,90.6,"Vous en êtes informé<br>par une notification."),
        (91.3,99.6,"Sur votre accueil, le voyage devient votre prochain trajet :<br>date, compte à rebours et villes du trajet."),
        (100.3,105.0,"Une demande en quelques gestes,<br>et une décision tracée."),
        (105.2,109.6,"En cas de refus,<br>le motif vous est toujours indiqué."),
        (110.3,113.6,"Roxgold SiteLife.<br>Demandez, suivez, partez."),
    ],
}

if __name__ == "__main__":
    generer(CFG)
