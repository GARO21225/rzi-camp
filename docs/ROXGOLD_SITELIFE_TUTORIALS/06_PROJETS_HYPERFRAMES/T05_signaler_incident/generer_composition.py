#!/usr/bin/env python3
"""Génère la composition HyperFrames du tutoriel T05 (Signaler un incident de maintenance).

Sorties :
  hyperframes/index.html          projet local (captures en fichiers relatifs, GSAP local) -> `npx hyperframes render`
  hyperframes/send_to_hyperframes.html  fichier unique autonome (tout en base64, GSAP via CDN)
                                        pour le flux hébergé « Send to HyperFrames ».
Usage : python3 generer_composition.py <chemin gsap.min.js> <dossier fontsource ibm-plex-sans/files>
"""
import base64, io, json, os, shutil, sys
from PIL import Image

ICI = os.path.dirname(os.path.abspath(__file__))
CAP = os.path.join(ICI, "captures")
OUT = os.path.join(ICI, "hyperframes")
LOGO = os.path.join(ICI, "..", "..", "..", "..", "roxgold-logo.png")
GSAP, FONTS = sys.argv[1], sys.argv[2]

W_IMG, H_IMG = 1170, 1992            # captures iPhone 13 (390x664 pt, x3)
SCR_W, SCR_H = 499, 850              # écran du téléphone dans la vidéo
K0 = SCR_W / W_IMG                   # échelle de base de la capture

# ── Plans : (id, début, durée) ─────────────────────────────────────────────
PLANS = [("p01",0,4),("p02",4,11),("p03",15,8),("p04",23,6),("p05",29,6),("p06",35,4),("p07",39,6),
         ("p08",45,8),("p09",53,9),("p10",62,9),("p11",71,7),("p12",78,8),("p13",86,10),("p14",96,4)]
TOTAL = 100
START = {p: s for p, s, d in PLANS}

# ── Sous-titres (identiques au SRT 08_SOUS_TITRES/T05_signaler_incident.srt) ─
SUBS = [
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
]

# ── Plans « téléphone » : capture, étape, textes, zones (px de la capture) ──
# zone = (x, y, w, h, t_relatif_apparition, zoom ou None)
TEL = {
 "p03": ("04_maintenance_liste.png", None, "Roxgold SiteLife", "Déclarer · Prioriser · Suivre", "La maintenance du camp, depuis votre téléphone.", []),
 "p04": ("03_accueil.png", 1, "Point d'entrée", "Onglet « Signaler »", "Barre d'onglets, en bas de l'écran d'accueil.", [(774,1770,170,180,0.4,None)]),
 "p05": ("04_maintenance_liste.png", 2, "Ouvrir le formulaire", "Bouton « + »", "Page Maintenance, bouton doré en bas à droite.", [(1038-95,1614-95,190,190,0.5,None)]),
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
}
TAP_P10 = (585, 1867)   # centre du bouton « Déclarer l'incident »


def b64(path, mime):
    with open(path, "rb") as f:
        return f"data:{mime};base64," + base64.b64encode(f.read()).decode()


def jpeg_b64(path, largeur=1170):
    im = Image.open(path).convert("RGB")
    if im.width > largeur:
        im = im.resize((largeur, round(im.height * largeur / im.width)), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=86, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def zoom_cible(x, y, w, h, z):
    """Translation/échelle pour centrer la zone dans l'écran au facteur z (bornée aux bords)."""
    z = max(1.0, min(z, SCR_W / ((w + 60) * K0)))   # la zone reste entière en largeur
    k = K0 * z
    cx, cy = x + w / 2, y + h / 2
    tx = min(0, max(SCR_W - W_IMG * k, SCR_W / 2 - cx * k))
    ty = min(0, max(SCR_H - H_IMG * k, SCR_H / 2 - cy * k))
    return round(tx, 1), round(ty, 1), round(k, 4)


def construire(images, fonts, gsap_tag):
    css_fonts = "".join(
        f'@font-face{{font-family:"IBM Plex Sans";font-weight:{w};font-style:normal;font-display:block;src:url({src}) format("woff2");}}'
        for w, src in fonts.items())
    scenes, js = [], []
    a = js.append
    # visibilité : le runtime gère data-start/data-duration ; on ajoute des bascules autoAlpha (contrat Send-to)
    # visibilité des plans : gérée par le runtime HyperFrames (data-start / data-duration des .clip)

    def scene(pid, contenu, fond="nuit"):
        s = START[pid]; d = dict((p, dd) for p, _, dd in PLANS)[pid]
        style = ''
        scenes.append(f'<div class="scene clip {fond}" id="{pid}" data-start="{s}" data-duration="{d}" data-track-index="0"{style}>'
                      f'<div class="scene-content">{contenu}</div></div>')

    # P01 — ouverture
    scene("p01", f'<div class="logo-carte" id="p01-logo"><img src="{images["logo"]}" alt="Roxgold"></div>'
                 '<div class="kicker or" id="p01-k">ROXGOLD · SITELIFE</div>'
                 '<h1 class="titre-xl" id="p01-t">Signaler un incident<br>de maintenance</h1>'
                 '<div class="etiquette" id="p01-e">Tutoriel · Espace résident</div>')
    a('tl.from("#p01-logo",{scale:.6,autoAlpha:0,duration:.7,ease:"back.out(1.6)"},.15);'
      'tl.from("#p01-k",{autoAlpha:0,scale:1.15,duration:.8,ease:"power2.out"},.5);'
      'tl.from("#p01-t",{y:40,autoAlpha:0,duration:.7,ease:"power4.out"},.8);'
      'tl.from("#p01-e",{autoAlpha:0,y:20,duration:.5,ease:"power2.out"},1.3);'
      'tl.to("#p01-logo",{y:-8,duration:1.2,ease:"sine.inOut",yoyo:true,repeat:1},1.2);')

    # P02 — constat (mise en page typographique ; l'illustration FLORA viendra au fond, mention « Illustration »)
    scene("p02", '<div class="constat">'
                 '<div class="kicker rouge" id="p02-k">LE CONSTAT</div>'
                 '<h2 class="titre-l" id="p02-t">Une panne dans votre chambre…</h2>'
                 '<div class="clim" id="p02-clim"><div class="clim-corps"><span class="clim-led" id="p02-led"></span></div><div class="clim-lames"></div></div>'
                 '<div class="maux">'
                 '<div class="mal" id="p02-m1"><span class="croix">✕</span>Signalé de vive voix</div>'
                 '<div class="mal" id="p02-m2"><span class="croix">✕</span>Vite oublié</div>'
                 '<div class="mal" id="p02-m3"><span class="croix">✕</span>Aucun suivi</div>'
                 '</div></div>')
    s = START["p02"]
    a(f'tl.from("#p02-k",{{autoAlpha:0,x:-30,duration:.5,ease:"power2.out"}},{s+.2});'
      f'tl.from("#p02-t",{{autoAlpha:0,y:30,duration:.6,ease:"power4.out"}},{s+.4});'
      f'tl.from("#p02-clim",{{autoAlpha:0,scale:.9,duration:.8,ease:"expo.out"}},{s+.6});'
      f'tl.to("#p02-led",{{opacity:.2,duration:.45,ease:"sine.inOut",yoyo:true,repeat:11}},{s+1});'
      f'tl.from("#p02-m1",{{autoAlpha:0,x:60,duration:.5,ease:"back.out(1.6)"}},{s+4.2});'
      f'tl.from("#p02-m2",{{autoAlpha:0,x:60,duration:.5,ease:"back.out(1.6)"}},{s+5.6});'
      f'tl.from("#p02-m3",{{autoAlpha:0,x:60,duration:.5,ease:"back.out(1.6)"}},{s+7.4});'
      f'tl.to("#p02-clim",{{y:-10,duration:2,ease:"sine.inOut",yoyo:true,repeat:1}},{s+5});')

    # Plans téléphone
    for pid, (img, etape, kicker, titre, sous, zones) in TEL.items():
        s = START[pid]; d = dict((p, dd) for p, _, dd in PLANS)[pid]
        pastille = f'<div class="pastille" id="{pid}-n">{etape}</div>' if etape else ''
        hls = "".join(f'<div class="hl" id="{pid}-h{j}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px"></div>'
                      for j, (x, y, w, h, t, z) in enumerate(zones))
        tap = f'<div class="tap" id="{pid}-tap" style="left:{TAP_P10[0]-90}px;top:{TAP_P10[1]-90}px"></div>' if pid == "p10" else ''
        texte = (f'<div class="panneau">{pastille}<div class="kicker or" id="{pid}-k">{kicker.upper()}</div>'
                 f'<h2 class="titre-l" id="{pid}-t">{titre}</h2><p class="sous" id="{pid}-s">{sous}</p>'
                 + ('<div class="progression">' + "".join(f'<span class="{"on" if i <= etape else ""}"></span>' for i in range(1, 7)) + '</div>' if etape else '')
                 + '</div>')
        tel = (f'<div class="tel" id="{pid}-tel"><div class="ecran"><div class="shot" id="{pid}-shot" '
               f'><img src="{images[img]}" alt="">{hls}{tap}</div></div></div>')
        scene(pid, texte + tel)
        a(f'gsap.set("#{pid}-shot",{{x:0,y:0,scale:{K0:.4f},transformOrigin:"0 0"}});')
        entree = "y:120" if pid == "p03" else "x:40"
        a(f'tl.from("#{pid}-tel",{{autoAlpha:0,{entree},duration:.7,ease:"expo.out"}},{s+.1});')
        if etape: a(f'tl.from("#{pid}-n",{{scale:0,duration:.5,ease:"back.out(2)"}},{s+.2});')
        a(f'tl.from("#{pid}-k",{{autoAlpha:0,x:-30,duration:.5,ease:"power2.out"}},{s+.25});'
          f'tl.from("#{pid}-t",{{autoAlpha:0,y:30,duration:.6,ease:"power4.out"}},{s+.35});'
          f'tl.from("#{pid}-s",{{autoAlpha:0,y:16,duration:.5,ease:"power2.out"}},{s+.6});'
          f'tl.to("#{pid}-tel",{{y:-8,duration:{d/2-.4:.2f},ease:"sine.inOut",yoyo:true,repeat:1}},{s+.8});')
        for j, (x, y, w, h, t, z) in enumerate(zones):
            a(f'tl.fromTo("#{pid}-h{j}",{{autoAlpha:0,scale:1.15}},{{autoAlpha:1,scale:1,duration:.45,ease:"power4.out"}},{s+t});')
            fin = zones[j + 1][4] if j + 1 < len(zones) else d - .2
            if j + 1 < len(zones):
                a(f'tl.to("#{pid}-h{j}",{{autoAlpha:.25,duration:.3,ease:"power2.out"}},{s+fin-.1});')
            pulses = max(0, int((fin - t - .6) / 1.0) - 1)
            if pulses:
                a(f'tl.to("#{pid}-h{j}",{{boxShadow:"0 0 0 18px rgba(201,151,43,.0), 0 0 40px rgba(201,151,43,.9)",duration:.5,ease:"sine.inOut",yoyo:true,repeat:{pulses*2-1}}},{s+t+.5});')
            if z:
                tx, ty, k = zoom_cible(x, y, w, h, z)
                a(f'tl.to("#{pid}-shot",{{x:{tx},y:{ty},scale:{k},duration:.7,ease:"power2.inOut"}},{s+t+.1});')
        if pid == "p10":   # recentrage sur le bouton puis appui
            tx, ty, k = zoom_cible(96, 1792, 980, 150, 1.4)
            a(f'tl.to("#p10-shot",{{x:{tx},y:{ty},scale:{k},duration:.7,ease:"power2.inOut"}},{s+2.4});'
              f'tl.fromTo("#p10-tap",{{autoAlpha:.9,scale:.2}},{{autoAlpha:0,scale:1.6,duration:.7,ease:"power2.out"}},{s+8.0});')

    # P13 — bénéfices
    s = START["p13"]
    cartes = [("Responsables prévenus", "Notification dès la déclaration"),
              ("Priorité &amp; échéance", "Délai de traitement automatique"),
              ("Suivi tracé", "Déclaré → Assigné → En cours → Résolu → Clôturé")]
    scene("p13", '<div class="kicker or" id="p13-k">LE RÉSULTAT</div><h2 class="titre-l centre" id="p13-t">Chaque incident est tracé,<br>priorisé et suivi.</h2>'
                 '<div class="cartes">' + "".join(f'<div class="carte" id="p13-c{i}"><div class="carte-n">{i+1}</div><div class="carte-t">{t}</div><div class="carte-s">{st}</div></div>' for i, (t, st) in enumerate(cartes)) + '</div>')
    a(f'tl.from("#p13-k",{{autoAlpha:0,y:-20,duration:.5,ease:"power2.out"}},{s+.2});'
      f'tl.from("#p13-t",{{autoAlpha:0,y:30,duration:.6,ease:"power4.out"}},{s+.4});')
    for i in range(3):
        a(f'tl.from("#p13-c{i}",{{autoAlpha:0,y:60,duration:.6,ease:"back.out(1.6)"}},{s+1.0+i*.9});'
          f'tl.to("#p13-c{i}",{{y:-8,duration:1.6,ease:"sine.inOut",yoyo:true,repeat:1}},{s+4+i*.3});')

    # P14 — conclusion
    s = START["p14"]
    scene("p14", f'<div class="logo-carte" id="p14-logo"><img src="{images["logo"]}" alt="Roxgold"></div>'
                 '<div class="kicker or" id="p14-k">ROXGOLD · SITELIFE</div>'
                 '<h2 class="titre-l centre" id="p14-t">Un signalement, un suivi.</h2>'
                 '<div class="chemin" id="p14-c">Maintenance › Signaler</div>')
    a(f'tl.from("#p14-logo",{{scale:.7,autoAlpha:0,duration:.6,ease:"back.out(1.6)"}},{s+.1});'
      f'tl.from("#p14-k",{{autoAlpha:0,duration:.5,ease:"power2.out"}},{s+.4});'
      f'tl.from("#p14-t",{{autoAlpha:0,y:24,duration:.6,ease:"power4.out"}},{s+.6});'
      f'tl.from("#p14-c",{{autoAlpha:0,y:16,duration:.5,ease:"power2.out"}},{s+1.0});'
      f'tl.to("#p14-logo",{{y:-6,duration:1,ease:"sine.inOut",yoyo:true,repeat:1}},{s+1.4});'
      f'tl.to("#main",{{opacity:0,duration:.5,ease:"power2.in"}},{TOTAL-.5});')

    # Sous-titres
    subs = "".join(f'<div class="st clip" id="st{i}" data-start="{a0}" data-duration="{round(b0-a0,2)}" data-track-index="1"><span>{t}</span></div>'
                   for i, (a0, b0, t) in enumerate(SUBS))

    return f'''<!doctype html>
<html lang="fr" style="overflow:hidden;margin:0">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=1920, height=1080">
<title>T05 · Signaler un incident de maintenance · Roxgold SiteLife</title>
{gsap_tag}
<style>
{css_fonts}
:root{{--nuit:#06142E;--marine:#0F2A5C;--or:#C9972B;--or-clair:#E8C46A;--papier:#EEF1F6;--encre:#F4F6FA;--gris:#9FB0C8;--rouge:#E0524A;--font:"IBM Plex Sans",system-ui,sans-serif}}
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:1920px;height:1080px;overflow:hidden;background:var(--nuit);color:var(--encre);font-family:var(--font)}}
.scene{{position:absolute;inset:0;width:1920px;height:1080px;overflow:hidden}}
.fond{{position:absolute;inset:0;background:radial-gradient(1200px 700px at 78% 30%,#13305F 0%,var(--nuit) 62%)}}
.courbes{{position:absolute;inset:0;width:2040px;height:1080px;fill:none;stroke:rgba(201,151,43,.22);stroke-width:2}}
.scene-content{{position:relative;z-index:1;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px}}
.kicker{{font-weight:600;font-size:24px;letter-spacing:.32em}}
.or{{color:var(--or)}} .rouge{{color:var(--rouge)}}
.titre-xl{{font-weight:700;font-size:92px;line-height:1.04;text-align:center;letter-spacing:-.01em}}
.titre-l{{font-weight:700;font-size:64px;line-height:1.08;letter-spacing:-.01em}}
.centre{{text-align:center}}
.etiquette,.chemin{{font-weight:400;font-size:28px;color:var(--gris);border:1px solid rgba(159,176,200,.35);padding:10px 26px;border-radius:99px}}
.logo-carte{{background:#fff;border-radius:36px;padding:26px 40px;box-shadow:0 0 0 6px rgba(201,151,43,.9),0 20px 60px rgba(0,0,0,.45)}}
.logo-carte img{{display:block;height:120px}}
.constat{{width:1500px;display:grid;grid-template-columns:1fr 560px;grid-template-rows:auto auto 1fr;column-gap:80px;row-gap:22px;align-items:start}}
.constat .kicker,.constat .titre-l{{grid-column:1}}
.clim{{grid-column:2;grid-row:1/4;align-self:center;width:520px}}
.clim-corps{{height:170px;border-radius:26px;background:linear-gradient(#F4F6FA,#D7DDE7);position:relative;box-shadow:0 30px 60px rgba(0,0,0,.4)}}
.clim-led{{position:absolute;right:34px;top:30px;width:18px;height:18px;border-radius:50%;background:var(--rouge);box-shadow:0 0 18px var(--rouge)}}
.clim-lames{{height:34px;margin:0 30px;border-radius:0 0 18px 18px;background:repeating-linear-gradient(90deg,#B9C2D0 0 18px,#CDD4DF 18px 36px)}}
.maux{{grid-column:1;display:flex;flex-direction:column;gap:18px;margin-top:20px}}
.mal{{font-size:40px;font-weight:600;display:flex;align-items:center;gap:22px}}
.croix{{width:56px;height:56px;border-radius:50%;background:rgba(224,82,74,.15);color:var(--rouge);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700}}
.panneau{{position:absolute;left:150px;top:300px;width:820px;display:flex;flex-direction:column;gap:20px}}
.pastille{{width:84px;height:84px;border-radius:50%;background:var(--or);color:var(--nuit);font-weight:700;font-size:44px;display:flex;align-items:center;justify-content:center}}
.sous{{font-size:32px;line-height:1.4;color:var(--gris);font-weight:400}}
.progression{{display:flex;gap:10px;margin-top:10px}}
.progression span{{width:64px;height:8px;border-radius:8px;background:rgba(159,176,200,.25)}}
.progression span.on{{background:var(--or)}}
.tel{{position:absolute;left:1210px;top:40px;width:531px;height:882px;border-radius:66px;background:#0A0F1A;padding:16px;box-shadow:0 0 0 2px #2A3550,0 40px 90px rgba(0,0,0,.55)}}
.ecran{{width:{SCR_W}px;height:{SCR_H}px;border-radius:52px;overflow:hidden;position:relative;background:#fff}}
.shot{{position:absolute;left:0;top:0;width:{W_IMG}px;height:{H_IMG}px;transform-origin:0 0}}
.shot img{{display:block;width:{W_IMG}px;height:{H_IMG}px}}
.hl{{position:absolute;border:10px solid var(--or);border-radius:34px;box-shadow:0 0 0 0 rgba(201,151,43,0),0 0 30px rgba(201,151,43,.6);opacity:0}}
.tap{{position:absolute;width:180px;height:180px;border-radius:50%;background:rgba(201,151,43,.55);opacity:0}}
.cartes{{display:flex;gap:40px;margin-top:40px}}
.carte{{width:460px;padding:40px 38px;border-radius:28px;background:rgba(15,42,92,.75);border:1px solid rgba(201,151,43,.35);display:flex;flex-direction:column;gap:14px}}
.carte-n{{width:56px;height:56px;border-radius:50%;background:var(--or);color:var(--nuit);font-weight:700;font-size:28px;display:flex;align-items:center;justify-content:center}}
.carte-t{{font-size:36px;font-weight:700}}
.carte-s{{font-size:24px;color:var(--gris);line-height:1.4}}
.st{{position:absolute;left:0;right:0;bottom:34px;display:flex;justify-content:center;z-index:20;pointer-events:none}}
.st span{{background:rgba(6,20,46,.82);color:#fff;font-size:36px;line-height:1.35;font-weight:600;padding:10px 26px;border-radius:12px;text-align:center;max-width:1300px}}
</style>
</head>
<body>
<div id="main" data-composition-id="main" data-width="1920" data-height="1080" data-start="0" data-duration="{TOTAL}">
<div class="fond clip" id="fond" data-start="0" data-duration="{TOTAL}" data-track-index="2"><svg class="courbes" id="courbes" viewBox="0 0 2040 1080" preserveAspectRatio="none"><path d="M-50 820 C 400 700, 800 900, 1300 760 S 1900 640, 2080 700"/><path d="M-50 900 C 420 800, 820 1000, 1320 860 S 1900 760, 2080 800"/><path d="M-50 240 C 380 160, 760 330, 1260 210 S 1900 120, 2080 170"/></svg></div>
{"".join(scenes)}
{subs}
</div>
<script>
window.__timelines = window.__timelines || {{}};
var tl = gsap.timeline({{ paused: true }});
tl.fromTo("#courbes",{{x:0}},{{x:-120,duration:{TOTAL},ease:"none"}},0);
{chr(10).join(js)}
window.__timelines["main"] = tl;
</script>
</body>
</html>
'''


def main():
    os.makedirs(os.path.join(OUT, "assets"), exist_ok=True)
    fonts_local = {w: b64(os.path.join(FONTS, f"ibm-plex-sans-latin-{w}-normal.woff2"), "font/woff2") for w in (400, 600, 700)}
    noms = sorted(f for f in os.listdir(CAP) if f.endswith(".png"))
    # 1) projet local : fichiers relatifs
    imgs = {"logo": "assets/roxgold-logo.png"}
    shutil.copy(LOGO, os.path.join(OUT, "assets", "roxgold-logo.png"))
    for n in noms:
        shutil.copy(os.path.join(CAP, n), os.path.join(OUT, "assets", n)); imgs[n] = f"assets/{n}"
    shutil.copy(GSAP, os.path.join(OUT, "assets", "gsap.min.js"))
    with open(os.path.join(OUT, "index.html"), "w") as f:
        f.write(construire(imgs, fonts_local, '<script src="assets/gsap.min.js"></script>'))
    # 2) fichier unique « Send to HyperFrames »
    imgs = {"logo": b64(LOGO, "image/png")}
    for n in noms: imgs[n] = jpeg_b64(os.path.join(CAP, n))
    os.makedirs(os.path.join(ICI, "send_to_hyperframes"), exist_ok=True)
    with open(os.path.join(ICI, "send_to_hyperframes", "T05_send_to_hyperframes.html"), "w") as f:
        f.write(construire(imgs, fonts_local, '<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>\n'
                           '<script src="https://cdn.jsdelivr.net/npm/@hyperframes/core/dist/hyperframe.runtime.iife.js"></script>'))
    with open(os.path.join(OUT, "meta.json"), "w") as f:
        json.dump({"id": "roxgold-sitelife-t05", "name": "T05 Signaler un incident de maintenance"}, f, ensure_ascii=False, indent=2)
    print("ok", os.path.getsize(os.path.join(ICI, "send_to_hyperframes", "T05_send_to_hyperframes.html")) // 1024, "Ko")


if __name__ == "__main__":
    main()
