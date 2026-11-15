#!/usr/bin/env python3
"""T01 : Se connecter et prendre en main son espace. Configuration de la composition HyperFrames.
Usage : python3 generer_composition.py <gsap.min.js 3.14.2> <dossier @fontsource/ibm-plex-sans/files>
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_commun"))
from generateur_tutoriel import generer, version_anglaise

W = 1090
CFG = {
    "dossier": os.path.dirname(os.path.abspath(__file__)),
    "code": "T01", "titre": "Se connecter et prendre en main son espace",
    "titre_intro_html": "Se connecter et prendre<br>en main son espace",
    "etiquette": "Tutoriel · Espace résident",
    "plans": [("p01",4),("p02",10),("p03",8),("p04",7),("p05",8),("p06",6),("p07",9),("p08",7),("p09",7),
              ("p10",7),("p11",8),("p12",7),("p13",7),("p14",9),("p15",7),("p16",10),("p17",4)],
    "plan_solution": "p03",
    "etapes_total": 6,
    "constat": {"plan": "p02", "titre": "Où sont mes infos ?", "decor": "notes",
                "notes": ["Mon trajet ?", "Ma demande ?", "Mot de passe ?"],
                "maux": [("Informations dispersées", 3.4), ("Aucune vue personnelle", 5.0), ("Identifiants mal protégés", 7.2)]},
    # zone = (x, y, w, h, t_relatif, zoom|None) en pixels de la capture (1170 × 1992)
    "telephone": {
        "p03": ("03_accueil.png", None, "Roxgold SiteLife", "Votre espace personnel", "Trajet, demandes, raccourcis : tout au même endroit.", []),
        "p04": ("00_installation_iphone.png", 1, "Installer", "L'application sur l'écran d'accueil", "Sur iPhone : Safari › Partager › « Sur l'écran d'accueil ».", [(50,1230,1070,800,0.5,None)]),
        "p05": ("02_connexion_remplie.png", 2, "Se connecter", "Identifiant · Mot de passe", "Puis « Se connecter → ».", [(50,1190,1070,220,0.5,None),(50,1510,1070,170,2.6,None),(50,1715,1070,160,5.0,None)]),
        "p06": ("01_connexion.png", 2, "Se connecter", "Code SMS", "Selon la configuration de votre site.", [(600,1015,520,110,0.5,None)]),
        "p07": ("03_accueil.png", 3, "Accueil", "Votre prochain trajet", "Destination, date, heure, compte à rebours.", [(40,650,W,660,0.5,None)]),
        "p08": ("04_accueil_raccourcis.png", 3, "Accueil", "Les raccourcis", "Les pages de votre menu, en un geste.", [(40,1330,W,480,0.5,None)]),
        "p09": ("05_accueil_demandes.png", 3, "Accueil", "Mes demandes", "En attente · Validées", [(40,1090,W,400,0.5,None)]),
        "p10": ("03_accueil.png", 4, "Naviguer", "La barre d'onglets", "Accueil · Voyages · Demandes · Repas · Signaler · Plus", [(20,1745,1130,225,0.5,None)]),
        "p11": ("06_menu_plus.png", 4, "Naviguer", "« Plus » : toutes vos pages", "Et en bas : Mon compte, Déconnexion.", [(30,640,1110,1050,0.5,None),(30,1800,1110,165,4.2,None)]),
        "p12": ("07_mon_compte.png", 5, "Mon compte", "Profil et langue", "Société, identifiant, français ou anglais.", [(40,230,W,670,0.5,None),(40,1350,W,130,3.6,None)]),
        "p13": ("08_securite.png", 6, "Sécurité", "Onglet « Sécurité »", "Modifier le mot de passe.", [(580,960,520,135,0.5,None),(40,1195,W,180,3.2,None)]),
        "p14": ("09_mdp_rempli.png", 6, "Sécurité", "Ancien · Nouveau · Confirmer", "La jauge indique la force du mot de passe.", [(40,270,W,160,0.5,None),(40,520,W,270,2.6,None),(40,890,W,220,5.0,None)]),
        "p15": ("11_retour_connexion.png", 6, "Sécurité", "Reconnectez-vous", "Avec votre nouveau mot de passe.", [(40,1310,W,560,0.6,None)]),
    },
    "taps": {"p14": (585, 1226, 7.8)},
    "resultat": {"plan": "p16", "titre": "Votre camp,<br>dans votre poche.",
                 "cartes": [("Tout au même endroit", "Prochain trajet, demandes, raccourcis"),
                            ("Sur votre téléphone", "Application installable, barre d'onglets"),
                            ("Compte protégé", "Mot de passe personnel, déconnexion après 15 min sans activité")]},
    "conclusion": {"plan": "p17", "phrase": "Bienvenue dans votre espace.", "chemin": "Accueil › Mon compte"},
    "sous_titres": [
        (0.3,3.6,"Roxgold SiteLife.<br>Se connecter et prendre en main son espace."),
        (4.3,8.2,"Mon prochain trajet ? Ma demande est-elle validée ?<br>Les informations sont souvent dispersées."),
        (8.4,13.6,"Et sans espace personnel,<br>chacun doit demander autour de lui."),
        (14.3,21.6,"Avec Roxgold SiteLife, votre espace personnel<br>réunit tout, sur votre téléphone."),
        (22.3,28.6,"Sur iPhone, ouvrez l'application dans Safari : elle vous explique<br>comment l'ajouter à votre écran d'accueil."),
        (29.3,32.6,"Saisissez votre identifiant et votre mot de passe,"),
        (32.8,36.6,"puis appuyez sur Se connecter."),
        (37.3,42.6,"Selon la configuration de votre site,<br>une connexion par code SMS peut aussi être proposée."),
        (43.3,51.6,"Vous arrivez sur votre accueil : votre prochain trajet,<br>sa date, son heure et le compte à rebours."),
        (52.3,58.6,"Les raccourcis mènent directement<br>aux pages de votre menu."),
        (59.3,65.6,"Plus bas : vos demandes,<br>en attente et validées."),
        (66.3,72.6,"En bas de l'écran, la barre d'onglets :<br>Accueil, Voyages, Demandes, Repas, Signaler."),
        (73.3,80.6,"Plus ouvre toutes vos pages.<br>En bas : Mon compte et Déconnexion."),
        (81.3,87.6,"Mon compte affiche votre profil<br>et le choix de la langue : français ou anglais."),
        (88.3,94.6,"Dans l'onglet Sécurité,<br>vous pouvez modifier votre mot de passe."),
        (95.3,99.6,"Saisissez l'ancien mot de passe,<br>puis le nouveau, deux fois."),
        (99.8,103.6,"La jauge indique sa force.<br>Appuyez sur Modifier le mot de passe."),
        (104.3,110.6,"Vous êtes alors déconnecté :<br>reconnectez-vous avec le nouveau mot de passe."),
        (111.3,116.0,"Tout au même endroit, sur votre téléphone,<br>avec un compte protégé."),
        (116.2,120.6,"Sans activité pendant quinze minutes,<br>l'application vous déconnecte automatiquement."),
        (121.3,124.6,"Roxgold SiteLife.<br>Bienvenue dans votre espace."),
    ],
}

# Version anglaise (application filmée en anglais : captures/en/) — mêmes plans, encadrés et minutage
EN = {
    "titre": "Logging in and getting started",
    "titre_intro_html": "Logging in and<br>getting started",
    "etiquette": "Tutorial · Resident area",
    "constat": {"titre": "Where is my information?", "notes": ["My trip?", "My request?", "Password?"],
                "maux": ["Information scattered", "No personal view", "Poorly protected logins"]},
    "telephone": {
        "p03": ("Roxgold SiteLife", "Your personal space", "Trip, requests, shortcuts: all in one place."),
        "p04": ("Install", "The app on your home screen", "On iPhone: Safari › Share › “Add to Home Screen”."),
        "p05": ("Log in", "Username · Password", "Then “Log in →”."),
        "p06": ("Log in", "SMS code", "Depending on your site's settings."),
        "p07": ("Home", "Your next trip", "Destination, date, time, countdown."),
        "p08": ("Home", "Shortcuts", "The pages of your menu, in one tap."),
        "p09": ("Home", "My requests", "Pending · Approved"),
        "p10": ("Getting around", "The tab bar", "Home · Trips · Requests · Meals · Report · More"),
        "p11": ("Getting around", "“More”: all your pages", "And at the bottom: My account, Log out."),
        "p12": ("My account", "Profile and language", "Company, username, French or English."),
        "p13": ("Security", "“Security” tab", "Change your password."),
        "p14": ("Security", "Current · New · Confirm", "The gauge shows how strong the password is."),
        "p15": ("Security", "Log in again", "With your new password."),
    },
    "resultat": {"titre": "Your camp,<br>in your pocket.",
                 "cartes": [("All in one place", "Next trip, requests, shortcuts"),
                            ("On your phone", "Installable app, tab bar"),
                            ("Protected account", "Personal password, logged out after 15 min of inactivity")]},
    "conclusion": {"phrase": "Welcome to your space.", "chemin": "Home › My account"},
    "sous_titres": [
        "Roxgold SiteLife.<br>Logging in and getting started.",
        "My next trip? Has my request been approved?<br>Information is often scattered.",
        "And without a personal space,<br>everyone has to ask around.",
        "With Roxgold SiteLife, your personal space<br>brings everything together, on your phone.",
        "On iPhone, open the app in Safari: it shows you<br>how to add it to your home screen.",
        "Enter your username and your password,",
        "then tap Log in.",
        "Depending on your site's settings,<br>logging in with an SMS code may also be offered.",
        "You land on your home screen: your next trip,<br>its date, its time and the countdown.",
        "The shortcuts take you straight<br>to the pages of your menu.",
        "Further down: your requests,<br>pending and approved.",
        "At the bottom of the screen, the tab bar:<br>Home, Trips, Requests, Meals, Report.",
        "More opens all your pages.<br>At the bottom: My account and Log out.",
        "My account shows your profile<br>and the language choice: French or English.",
        "In the Security tab,<br>you can change your password.",
        "Enter your current password,<br>then the new one, twice.",
        "The gauge shows its strength.<br>Tap Change the password.",
        "You are then logged out:<br>log in again with the new password.",
        "Everything in one place, on your phone,<br>with a protected account.",
        "After fifteen minutes without activity,<br>the app logs you out automatically.",
        "Roxgold SiteLife.<br>Welcome to your space.",
    ],
}

if __name__ == "__main__":
    generer(CFG)
    generer(version_anglaise(CFG, EN))
