#!/usr/bin/env python3
"""T07 : Repas et bar — mon QR, le menu, mon bon. Configuration de la composition HyperFrames.
Usage : python3 generer_composition.py <gsap.min.js 3.14.2> <dossier @fontsource/ibm-plex-sans/files>
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_commun"))
from generateur_tutoriel import generer

PLANS = [("p01",4),("p02",10),("p03",7),("p04",6),("p05",9),("p06",7),("p07",5),("p08",6),
         ("p09",10),("p10",8),("p11",5),("p12",8),("p13",8),("p14",4)]

# Texte de la voix off, plan par plan (une ligne de sous-titre = un élément ; <br> = retour à la ligne)
TEXTES = {
    "p01": ["Roxgold SiteLife.<br>Repas et bar : mon QR, le menu, mon bon."],
    "p02": ["Au restaurant, le pointage se fait souvent<br>sur une liste papier.",
            "Au bar, difficile de savoir ce que l'on a consommé,<br>et ce qu'il reste sur son bon."],
    "p03": ["Avec Roxgold SiteLife, votre QR, le menu du jour<br>et votre bon de caisse sont dans votre téléphone."],
    "p04": ["Depuis votre accueil, appuyez sur l'onglet Repas,<br>en bas de l'écran."],
    "p05": ["Votre QR restaurant s'affiche, à votre nom.",
            "Présentez-le à l'entrée du restaurant :<br>l'équipe le scanne pour valider votre repas."],
    "p06": ["Juste dessous, le menu du jour :<br>petit-déjeuner, déjeuner et dîner."],
    "p07": ["Puis les horaires de chaque repas."],
    "p08": ["Pour le bar, ouvrez Plus, puis Bar."],
    "p09": ["En haut, votre bon de caisse de l'année :<br>ce qu'il reste, sur le montant de départ.",
            "Et le total de vos consommations du mois."],
    "p10": ["La carte du bar affiche chaque article,<br>avec son prix et sa disponibilité.",
            "Filtrez par catégorie."],
    "p11": ["Un article en rupture apparaît : Épuisé."],
    "p12": ["Enfin, Mes consommations : chaque achat,<br>avec sa date, son montant et son mode de paiement."],
    "p13": ["Le repas validé en un scan, le menu sous les yeux,<br>et un bon de caisse toujours à jour."],
    "p14": ["Roxgold SiteLife.<br>Bon appétit !"],
}


def sous_titres():
    """Répartit les lignes de chaque plan sur sa durée (le générateur les recale ensuite sur la voix réelle)."""
    out, t = [], 0.0
    for pid, d in PLANS:
        lignes = TEXTES[pid]; n = len(lignes); pas = (d - 0.7) / n
        for i, l in enumerate(lignes):
            out.append((round(t + 0.3 + i * pas, 2), round(t + 0.3 + (i + 1) * pas - 0.1, 2), l))
        t += d
    return out


CFG = {
    "dossier": os.path.dirname(os.path.abspath(__file__)),
    "code": "T07", "titre": "Repas et bar : mon QR, le menu, mon bon",
    "titre_intro_html": "Repas et bar<br>mon QR, le menu, mon bon",
    "etiquette": "Tutoriel · Espace résident",
    "plans": PLANS,
    "plan_solution": "p03",
    "etapes_total": 4,
    "constat": {"plan": "p02", "titre": "Au restaurant, au bar…", "decor": "notes",
                "notes": ["Mon repas est compté ?", "Il y a quoi au menu ?", "Il reste combien sur mon bon ?"],
                "maux": [("Pointage sur liste papier", 3.0), ("Consommations du bar non suivies", 5.6), ("Solde du bon inconnu", 7.6)]},
    # zone = (x, y, w, h, t_relatif, zoom|None) en pixels de la capture (1170 × 1992)
    "telephone": {
        "p03": ("02_mon_qr.png", None, "Roxgold SiteLife", "Repas et bar, dans votre poche", "Votre QR, le menu du jour, votre bon de caisse.", []),
        "p04": ("01_accueil.png", 1, "Point d'entrée", "Onglet « Repas »", "Barre d'onglets, en bas de l'écran d'accueil.", [(585,1761,176,192,0.5,None)]),
        "p05": ("02_mon_qr.png", 1, "Mon QR restaurant", "À présenter au restaurant", "L'équipe le scanne pour valider votre repas.", [(48,228,1074,1379,0.5,None)]),
        "p06": ("03_menu_du_jour.png", 2, "Le menu du jour", "Matin, midi et soir", "Petit-déjeuner, déjeuner, dîner.", [(48,188,1074,1500,0.5,None)]),
        "p07": ("04_horaires.png", 2, "Les horaires", "Horaires des repas", "Sous le menu du jour.", [(48,1176,1074,469,0.5,None)]),
        "p08": ("05_plus_bar.png", 3, "Le bar", "Plus › Bar", "Toutes vos pages, depuis l'onglet Plus.", [(42,1460,346,247,0.5,None)]),
        "p09": ("06_bar_bon.png", 3, "Mon bon de caisse", "Le solde de l'année", "Et vos consommations du mois.", [(36,452,1098,414,0.5,None),(36,902,1098,366,5.2,None)]),
        "p10": ("07_bar_carte.png", 4, "La carte du bar", "Prix et disponibilité", "Filtre par catégorie.", [(36,184,1098,1560,0.5,None),(258,455,240,102,4.6,None)]),
        "p11": ("08_bar_boissons.png", 4, "La carte du bar", "Article épuisé", "Rupture de stock signalée.", [(600,1101,483,479,0.5,None)]),
        "p12": ("09_consommations.png", 4, "Mes consommations", "Chaque achat, tracé", "Date, montant, mode de paiement.", [(36,433,1098,1222,0.5,None)]),
    },
    "taps": {"p04": (673, 1857, 3.6), "p08": (215, 1583, 3.4), "p10": (378, 506, 5.6)},
    "resultat": {"plan": "p13", "titre": "Repas et bar,<br>sans papier.",
                 "cartes": [("Mon QR", "Présenté à l'entrée, scanné par l'équipe du restaurant"),
                            ("Le menu du jour", "Petit-déjeuner, déjeuner, dîner, et les horaires"),
                            ("Mon bon de caisse", "Solde, carte du bar et consommations")]},
    "conclusion": {"plan": "p14", "phrase": "Bon appétit !", "chemin": "Repas · Plus › Bar"},
    "sous_titres": sous_titres(),
}

if __name__ == "__main__":
    generer(CFG)
