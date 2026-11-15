#!/usr/bin/env python3
"""T17 : Restauration, scanner les repas (flasheurs). Deux versions : française et anglaise.
Usage : python3 generer_composition.py <gsap.min.js 3.14.2> <dossier @fontsource/ibm-plex-sans/files>
Sorties : hyperframes/ (FR) et hyperframes_en/ (EN), captures/fr et captures/en, T17_flasheurs_scan.srt et T17_flasheurs_scan_EN.srt.
"""
import copy, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_commun"))
from generateur_tutoriel import generer

PLANS = [("p01",4),("p02",10),("p03",7),("p04",6),("p05",9),("p06",8),("p07",6),("p08",6),
         ("p09",7),("p10",7),("p11",7),("p12",5),("p13",8),("p14",4)]

# Voix off, plan par plan (une ligne = un sous-titre ; <br> = retour à la ligne)
TEXTES = {
 "fr": {
    "p01": ["Roxgold SiteLife.<br>Restauration : scanner les repas."],
    "p02": ["À l'entrée du restaurant, le pointage se fait souvent<br>sur une liste papier.",
            "Les comptes sont approximatifs,<br>et rien n'empêche de passer deux fois."],
    "p03": ["Avec Roxgold SiteLife, votre téléphone devient un scanner :<br>chaque repas est validé, compté et tracé."],
    "p04": ["Connectez-vous avec votre compte restauration,<br>puis appuyez sur l'onglet Repas."],
    "p05": ["Vérifiez votre restaurant et le repas en cours :<br>petit-déjeuner, déjeuner ou dîner.",
            "Les compteurs du jour s'affichent."],
    "p06": ["Le scanner s'active : autorisez la caméra,<br>puis présentez le QR du résident devant l'objectif."],
    "p07": ["Écran vert et bip : le repas est validé,<br>au nom du résident."],
    "p08": ["Le résident peut noter son repas en un instant,<br>ou passer."],
    "p09": ["S'il se présente une deuxième fois pour le même repas :<br>écran orange, Déjà pris."],
    "p10": ["Un QR inconnu ou falsifié est refusé :<br>écran rouge, Non reconnu."],
    "p11": ["L'historique liste les repas validés,<br>avec l'heure et le restaurant."],
    "p12": ["Et les compteurs se mettent à jour automatiquement."],
    "p13": ["Un scan par repas, un compte exact,<br>et une trace pour chaque passage."],
    "p14": ["Roxgold SiteLife.<br>Bon service !"],
 },
 "en": {
    "p01": ["Roxgold SiteLife.<br>Catering: scanning meals."],
    "p02": ["At the restaurant entrance, check-in is often done<br>on a paper list.",
            "Counts are approximate,<br>and nothing stops someone from coming through twice."],
    "p03": ["With Roxgold SiteLife, your phone becomes a scanner:<br>every meal is validated, counted and recorded."],
    "p04": ["Sign in with your catering account,<br>then tap the Meals tab."],
    "p05": ["Check your restaurant and the current meal:<br>breakfast, lunch or dinner.",
            "Today's counters are shown."],
    "p06": ["The scanner starts: allow the camera,<br>then hold the resident's QR code in front of the lens."],
    "p07": ["Green screen and a beep: the meal is validated,<br>in the resident's name."],
    "p08": ["The resident can rate the meal in a moment,<br>or skip."],
    "p09": ["If they come back for the same meal:<br>orange screen, Already taken."],
    "p10": ["An unknown or forged QR code is refused:<br>red screen, Not recognised."],
    "p11": ["The history lists validated meals,<br>with the time and the restaurant."],
    "p12": ["And the counters update automatically."],
    "p13": ["One scan per meal, an accurate count,<br>and a record of every visit."],
    "p14": ["Roxgold SiteLife.<br>Have a good service!"],
 },
}

# Textes à l'écran : (kicker, titre, sous-titre) par plan, et blocs fixes
ECRAN = {
 "fr": {
    "titre": "Restauration : scanner les repas", "intro": "Restauration<br>scanner les repas", "etiquette": "Tutoriel · Équipe restauration",
    "constat": ("À l'entrée du restaurant…", ["Il a déjà mangé ?", "On était combien ?", "C'est bien lui ?"],
                ["Pointage sur liste papier", "Comptes approximatifs", "Double passage possible"]),
    "p03": ("Roxgold SiteLife", "Votre téléphone, scanner de repas", "Validé, compté, tracé."),
    "p04": ("Point d'entrée", "Onglet « Repas »", "Avec votre compte restauration."),
    "p05": ("Avant de scanner", "Restaurant et repas", "Petit-déjeuner, déjeuner, dîner."),
    "p06": ("Le scan", "Scanner actif", "Le QR du résident devant l'objectif."),
    "p07": ("Le scan", "Repas validé", "Écran vert et bip, au nom du résident."),
    "p08": ("Le scan", "Son avis, en un instant", "Ou « Passer »."),
    "p09": ("Les contrôles", "Déjà pris", "Même repas, deuxième passage : refusé."),
    "p10": ("Les contrôles", "Non reconnu", "QR inconnu ou falsifié : refusé."),
    "p11": ("Le suivi", "Historique du jour", "Heure et restaurant de chaque repas."),
    "p12": ("Le suivi", "Compteurs à jour", "Automatiquement, après chaque scan."),
    "resultat": ("Chaque repas,<br>compté une fois.", [("Un scan, un repas", "Validé au nom du résident, avec un bip"),
                 ("Pas de double passage", "« Déjà pris » si le repas est déjà servi"),
                 ("QR sécurisé", "Un QR inconnu ou falsifié est refusé")]),
    "conclusion": ("Bon service !", "Repas › Scanner"),
 },
 "en": {
    "titre": "Catering: scanning meals", "intro": "Catering<br>scanning meals", "etiquette": "Tutorial · Catering team",
    "constat": ("At the restaurant entrance…", ["Has he eaten already?", "How many were we?", "Is it really her?"],
                ["Paper check-in list", "Approximate counts", "People can come twice"]),
    "p03": ("Roxgold SiteLife", "Your phone, a meal scanner", "Validated, counted, recorded."),
    "p04": ("Where to start", "“Meals” tab", "With your catering account."),
    "p05": ("Before scanning", "Restaurant and meal", "Breakfast, lunch, dinner."),
    "p06": ("Scanning", "Scanner on", "The resident's QR code in front of the lens."),
    "p07": ("Scanning", "Meal validated", "Green screen and a beep, in the resident's name."),
    "p08": ("Scanning", "Their feedback, in a moment", "Or “Skip”."),
    "p09": ("Checks", "Already taken", "Same meal, second visit: refused."),
    "p10": ("Checks", "Not recognised", "Unknown or forged QR code: refused."),
    "p11": ("Follow-up", "Today's history", "Time and restaurant of every meal."),
    "p12": ("Follow-up", "Counters up to date", "Automatically, after each scan."),
    "resultat": ("Every meal,<br>counted once.", [("One scan, one meal", "Validated in the resident's name, with a beep"),
                 ("No second helping", "“Already taken” if the meal was already served"),
                 ("Secure QR code", "An unknown or forged QR code is refused")]),
    "conclusion": ("Have a good service!", "Meals › Scanner"),
 },
}

# Captures (identiques en FR et EN, même mise en page) : (fichier, étape, [zones (x, y, w, h, t_rel, zoom)])
TEL = {
    "p03": ("03_scanner_actif.png", None, []),
    "p04": ("01_accueil.png", 1, [(585,1761,176,192,0.5,None)]),
    "p05": ("02_repas_haut.png", 1, [(339,372,783,228,0.5,None),(48,648,1074,335,4.6,None)]),
    "p06": ("03_scanner_actif.png", 2, [(48,591,1074,991,0.5,None)]),
    "p07": ("04_scan_valide.png", 2, [(48,591,1074,991,0.5,None)]),
    "p08": ("05_avis_rapide.png", 2, [(48,1000,1074,545,0.5,None)]),
    "p09": ("06_deja_pris.png", 3, [(48,587,1074,991,0.5,None)]),
    "p10": ("09_non_reconnu.png", 3, [(48,587,1074,991,0.5,None)]),
    "p11": ("07_historique.png", 4, [(48,840,1074,800,0.5,None)]),
    "p12": ("08_compteurs_apres.png", 4, [(48,270,1074,720,0.5,None)]),
}


def sous_titres(langue):
    """Répartit les lignes de chaque plan sur sa durée (le générateur les recale ensuite sur la voix réelle)."""
    out, t = [], 0.0
    for pid, d in PLANS:
        lignes = TEXTES[langue][pid]; n = len(lignes); pas = (d - 0.7) / n
        for i, l in enumerate(lignes):
            out.append((round(t + 0.3 + i * pas, 2), round(t + 0.3 + (i + 1) * pas - 0.1, 2), l))
        t += d
    return out


def config(langue):
    e = ECRAN[langue]
    ct, notes, maux = e["constat"]
    return {
        "dossier": os.path.dirname(os.path.abspath(__file__)),
        "langue": langue, "captures": langue, "suffixe_langue": True,
        "code": "T17", "titre": e["titre"], "titre_intro_html": e["intro"], "etiquette": e["etiquette"],
        "plans": copy.deepcopy(PLANS), "plan_solution": "p03", "etapes_total": 4,
        "constat": {"plan": "p02", "titre": ct, "decor": "notes", "notes": notes,
                    "maux": list(zip(maux, (3.0, 5.6, 7.8)))},
        "telephone": {pid: (f, n, *e[pid], zones) for pid, (f, n, zones) in TEL.items()},
        "taps": {"p04": (673, 1857, 3.4)},
        "resultat": {"plan": "p13", "titre": e["resultat"][0], "cartes": e["resultat"][1]},
        "conclusion": {"plan": "p14", "phrase": e["conclusion"][0], "chemin": e["conclusion"][1]},
        "sous_titres": sous_titres(langue),
    }


if __name__ == "__main__":
    for l in ("fr", "en"):
        generer(config(l))
