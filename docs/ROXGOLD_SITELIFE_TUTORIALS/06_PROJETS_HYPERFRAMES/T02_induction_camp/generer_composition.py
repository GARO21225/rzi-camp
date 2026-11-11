#!/usr/bin/env python3
"""T02 : Réaliser son Induction Camp. Configuration de la composition HyperFrames.
Usage : python3 generer_composition.py <gsap.min.js 3.14.2> <dossier @fontsource/ibm-plex-sans/files>
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_commun"))
from generateur_tutoriel import generer

W = 1090  # largeur utile des zones (pleine largeur de l'écran, marges comprises)
CFG = {
    "dossier": os.path.dirname(os.path.abspath(__file__)),
    "code": "T02", "titre": "Réaliser son Induction Camp",
    "titre_intro_html": "Réaliser son<br>Induction Camp",
    "etiquette": "Tutoriel · Nouvel arrivant",
    "plans": [("p01",4),("p02",11),("p03",9),("p04",8),("p05",7),("p06",8),("p07",8),("p08",7),("p09",8),("p10",7),
              ("p11",6),("p12",9),("p13",7),("p14",8),("p15",10),("p16",8),("p17",6),("p18",8),("p19",8),("p20",8),
              ("p21",10),("p22",4)],
    "plan_solution": "p03",
    "etapes_total": 6,
    "constat": {"plan": "p02", "titre": "Arriver au camp…", "decor": "notes", "notes": ["Horaires ?", "Urgences ?", "Règles ?"],
                "maux": [("Transmis à l'oral", 3.6), ("Vite oublié", 5.2), ("Aucune preuve d'acceptation", 7.8)]},
    # zone = (x, y, w, h, t_relatif, zoom|None) en pixels de la capture (1170 × 1992)
    "telephone": {
        "p03": ("01_bienvenue.png", None, "Roxgold SiteLife", "Un parcours guidé en 6 étapes", "Bienvenue · Infrastructures · Règles · Quiz · Appareils · Engagement", []),
        "p04": ("01_bienvenue.png", 1, "Bienvenue", "Ouverture automatique", "Tant que l'induction n'est pas signée, le reste de l'application est bloqué.", [(30,455,1110,130,0.5,None)]),
        "p05": ("02_bienvenue_parcours.png", 1, "Bienvenue", "Votre parcours", "Environ 15 minutes · « Commencer l'induction »", [(40,990,W,760,0.5,None)]),
        "p06": ("03_infras_grille.png", 2, "Infrastructures", "Découvrir le camp", "Touchez une zone pour l'ouvrir.", [(40,960,540,330,0.6,None)]),
        "p07": ("04b_infra_detail.png", 2, "Infrastructures", "L'essentiel de chaque zone", "Horaires, règles d'usage, consignes.", [(290,640,780,1010,0.5,None)]),
        "p08": ("05_infras_vues.png", 2, "Infrastructures", "4 zones visitées", "Le bouton « Continuer » s'active.", [(40,1305,W,150,0.4,None),(40,1480,W,170,3.0,None)]),
        "p09": ("06_regles_liste.png", 3, "Règles de vie", "Critique · Important · Standard", "Chaque règle est classée par niveau.", [(40,960,W,230,0.6,None)]),
        "p10": ("07_regle_critique.png", 3, "Règles de vie", "Lire chaque règle", "Touchez une règle pour la déplier.", [(40,890,W,360,0.5,None)]),
        "p11": ("08_regles_lues.png", 3, "Règles de vie", "Toutes les règles lues", "« J'ai tout lu → Quiz de validation »", [(40,1410,W,160,0.5,None)]),
        "p12": ("09_quiz.png", 4, "Quiz", "10 questions au hasard", "Toutes les bonnes réponses sont requises.", [(60,770,1050,110,0.5,None),(40,920,W,800,4.2,None)]),
        "p13": ("10_quiz_reponses.png", 4, "Quiz", "Une réponse par question", "Puis « Valider le quiz ».", [(40,260,W,135,0.5,None),(40,1010,W,140,3.0,None)]),
        "p14": ("11_quiz_reussi.png", 4, "Quiz", "Quiz réussi", "En cas d'erreur : retour aux règles, puis nouvelle série.", [(60,1365,1050,170,0.5,None),(60,1610,1050,155,3.5,None)]),
        "p15": ("12_appareils.png", 5, "Appareils", "Plus de 100 W : à déclarer", "Sinon : « Je n'ai pas d'appareil >100W ».", [(40,910,W,260,0.5,None),(40,1196,W,150,2.6,None),(40,1374,W,136,4.8,None)]),
        "p16": ("13_appareil_formulaire.png", 5, "Appareils", "Type · Puissance · Chambre", "Puis « ✓ Déclarer ».", [(40,630,W,205,0.5,None),(40,1070,W,195,2.6,None),(96,1290,700,130,5.0,None)]),
        "p17": ("14_appareil_declare.png", 5, "Appareils", "Appareil déclaré", "« Continuer » vers l'engagement.", [(45,1100,1080,195,0.5,None),(45,1500,1080,140,3.0,None)]),
        "p18": ("15_engagement.png", 6, "Engagement", "Le récapitulatif", "Chaque étape est confirmée.", [(40,925,W,560,0.5,None)]),
        "p19": ("16_signature.png", 6, "Engagement", "Signer au doigt", "Puis « Finaliser mon induction ».", [(40,800,W,565,0.5,None),(40,1515,W,175,4.0,None)]),
        "p20": ("17_certificat.png", None, "Résultat", "Certificat d'induction", "Le reste de l'application est débloqué.", [(60,580,1050,330,0.6,None)]),
    },
    "taps": {"p16": (443, 1355, 6.8), "p19": (585, 1600, 6.8)},
    "resultat": {"plan": "p21", "titre": "Des règles connues,<br>comprises et acceptées.",
                 "cartes": [("Règles connues", "Infrastructures et règles de vie parcourues"),
                            ("Compréhension vérifiée", "Quiz : 10 bonnes réponses sur 10"),
                            ("Engagement tracé", "Signature, certificat et registre de l'administration")]},
    "conclusion": {"plan": "p22", "phrase": "Bienvenue au camp.", "chemin": "Menu › Induction Camp"},
    "sous_titres": [
        (0.3,3.6,"Roxgold SiteLife.<br>Réaliser son Induction Camp."),
        (4.3,8.2,"À votre arrivée, les règles du camp<br>se transmettent souvent à l'oral."),
        (8.4,14.6,"Horaires, sécurité, contacts d'urgence : on retient mal,<br>et rien ne prouve qu'elles ont été comprises."),
        (15.3,19.8,"Avec Roxgold SiteLife, chaque nouvel arrivant suit<br>l'Induction Camp : un parcours guidé en six étapes."),
        (20.0,23.6,"Il se termine par une signature<br>et un certificat."),
        (24.3,28.0,"Dès que vous êtes hébergé au camp,<br>l'application ouvre directement l'Induction Camp."),
        (28.2,31.6,"Tant qu'elle n'est pas terminée,<br>les autres pages restent inaccessibles."),
        (32.3,35.6,"L'écran de bienvenue présente votre parcours,<br>d'environ quinze minutes."),
        (35.8,38.6,"Appuyez sur Commencer l'induction."),
        (39.3,46.6,"Étape 2 : les infrastructures du camp.<br>Touchez une zone pour la découvrir."),
        (47.3,54.6,"Chaque fiche donne l'essentiel :<br>horaires, règles d'usage, consignes."),
        (55.3,61.6,"Après quatre zones visitées,<br>le bouton Continuer s'active."),
        (62.3,69.6,"Étape 3 : les règles de vie. Elles sont classées :<br>critique, important, standard."),
        (70.3,76.6,"Touchez chaque règle pour la lire."),
        (77.3,82.6,"Toutes les règles sont lues :<br>passez au quiz de validation."),
        (83.3,87.0,"Étape 4 : le quiz.<br>Dix questions, tirées au hasard."),
        (87.2,91.6,"Toutes les réponses doivent être justes."),
        (92.3,98.6,"Choisissez une réponse par question,<br>puis validez le quiz."),
        (99.3,100.8,"Quiz réussi."),
        (101.0,106.6,"En cas d'erreur, vous revenez aux règles,<br>puis une nouvelle série de questions est proposée."),
        (107.3,111.6,"Étape 5 : les appareils énergivores. Tout appareil<br>de plus de 100 watts doit être déclaré."),
        (111.8,116.6,"Sans appareil concerné, choisissez<br>« Je n'ai pas d'appareil de plus de 100 W »."),
        (117.3,124.6,"Pour déclarer un appareil : choisissez le type,<br>indiquez la puissance et la chambre, puis Déclarer."),
        (125.3,130.6,"L'appareil apparaît comme déclaré.<br>Appuyez sur Continuer."),
        (131.3,138.6,"Étape 6 : l'engagement.<br>Le récapitulatif confirme chaque étape."),
        (139.3,146.6,"Signez avec le doigt,<br>puis appuyez sur Finaliser mon induction."),
        (147.3,154.6,"Votre certificat d'induction s'affiche.<br>Le reste de l'application est débloqué."),
        (155.3,160.0,"Les règles sont connues, le quiz prouve<br>qu'elles sont comprises, la signature engage."),
        (160.2,164.6,"L'administration suit qui a terminé,<br>depuis le registre de l'induction."),
        (165.3,168.6,"Roxgold SiteLife.<br>Bienvenue au camp."),
    ],
}

if __name__ == "__main__":
    generer(CFG)
