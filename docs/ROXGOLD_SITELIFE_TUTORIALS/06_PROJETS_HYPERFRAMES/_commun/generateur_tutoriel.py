#!/usr/bin/env python3
"""Générateur commun des compositions HyperFrames des tutoriels ROXGOLD SITELIFE.

Chaque tutoriel fournit un dictionnaire de configuration (voir T05/T02 `generer_composition.py`) :
  dossier        dossier du tutoriel (contient captures/)
  code, titre    ex. "T05", "Signaler un incident de maintenance"
  etiquette      ligne sous le titre d'ouverture (ex. "Tutoriel · Espace résident")
  plans          [(id, durée_s)] dans l'ordre ; p01 = ouverture, dernier = conclusion, plan "constat" et "resultat" désignés
  constat        {"plan", "titre", "maux": [(texte, t_relatif)], "decor": "clim" | "notes"}
  telephone      {plan: (capture, n_etape|None, kicker, titre, sous_titre, [(x, y, w, h, t_rel, zoom|None)])}
  etapes_total   nombre d'étapes numérotées (barre de progression)
  taps           {plan: (x, y, t_rel)}   effet « appui » sur un bouton (pixels de la capture)
  recentrages    {plan: [(x, y, w, h, t_rel, zoom)]}  déplacements de caméra supplémentaires
  resultat       {"plan", "titre", "cartes": [(titre, sous_titre)]}
  conclusion     {"plan", "phrase", "chemin"}
  sous_titres    [(début, fin, texte avec <br>)]  -> aussi exportés en .srt (source unique)
Sorties : <dossier>/hyperframes/index.html (projet CLI local), <dossier>/send_to_hyperframes/<code>_send_to_hyperframes.html
(fichier unique pour le flux hébergé), 08_SOUS_TITRES/<code>_<slug>.srt.
Usage : python3 generer_composition.py <gsap.min.js 3.14.2> <dossier @fontsource/ibm-plex-sans/files>
"""
import base64, io, json, os, shutil, sys
from PIL import Image

W_IMG, H_IMG = 1170, 1992            # captures iPhone 13 (390x664 pt, x3)
SCR_W, SCR_H = 499, 850              # écran du téléphone dans la vidéo
K0 = SCR_W / W_IMG
RACINE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))  # racine du dépôt
LOGO = os.path.join(RACINE, "roxgold-logo.png")
TUTOS = os.path.join(RACINE, "docs", "ROXGOLD_SITELIFE_TUTORIALS")


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
    """Translation/échelle pour centrer la zone au facteur z ; la zone reste entière en largeur, bornée aux bords."""
    z = max(1.0, min(z, SCR_W / ((w + 60) * K0)))
    k = K0 * z
    cx, cy = x + w / 2, y + h / 2
    tx = min(0, max(SCR_W - W_IMG * k, SCR_W / 2 - cx * k))
    ty = min(0, max(SCR_H - H_IMG * k, SCR_H / 2 - cy * k))
    return round(tx, 1), round(ty, 1), round(k, 4)


def srt(sous_titres):
    def t(s):
        ms = round(s * 1000); return f"{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}"
    return "\n".join(f"{i}\n{t(a)} --> {t(b)}\n{x.replace('<br>', chr(10))}\n" for i, (a, b, x) in enumerate(sous_titres, 1))


CSS = """
:root{--nuit:#06142E;--marine:#0F2A5C;--or:#C9972B;--encre:#F4F6FA;--gris:#9FB0C8;--rouge:#E0524A;--font:"IBM Plex Sans",system-ui,sans-serif}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden;background:var(--nuit);color:var(--encre);font-family:var(--font)}
.scene{position:absolute;inset:0;width:1920px;height:1080px;overflow:hidden}
.fond{position:absolute;inset:0;background:radial-gradient(1200px 700px at 78% 30%,#13305F 0%,var(--nuit) 62%)}
.courbes{position:absolute;inset:0;width:2040px;height:1080px;fill:none;stroke:rgba(201,151,43,.22);stroke-width:2}
.scene-content{position:relative;z-index:1;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px}
.kicker{font-weight:600;font-size:24px;letter-spacing:.32em}
.or{color:var(--or)} .rouge{color:var(--rouge)}
.titre-xl{font-weight:700;font-size:92px;line-height:1.04;text-align:center;letter-spacing:-.01em}
.titre-l{font-weight:700;font-size:64px;line-height:1.08;letter-spacing:-.01em}
.centre{text-align:center}
.etiquette,.chemin{font-weight:400;font-size:28px;color:var(--gris);border:1px solid rgba(159,176,200,.35);padding:10px 26px;border-radius:99px}
.logo-carte{background:#fff;border-radius:36px;padding:26px 40px;box-shadow:0 0 0 6px rgba(201,151,43,.9),0 20px 60px rgba(0,0,0,.45)}
.logo-carte img{display:block;height:120px}
.constat{width:1500px;display:grid;grid-template-columns:1fr 560px;grid-template-rows:auto auto 1fr;column-gap:80px;row-gap:22px;align-items:start}
.constat .kicker,.constat .titre-l{grid-column:1}
.decor{grid-column:2;grid-row:1/4;align-self:center;width:520px;position:relative}
.clim-corps{height:170px;border-radius:26px;background:linear-gradient(#F4F6FA,#D7DDE7);position:relative;box-shadow:0 30px 60px rgba(0,0,0,.4)}
.clim-led{position:absolute;right:34px;top:30px;width:18px;height:18px;border-radius:50%;background:var(--rouge);box-shadow:0 0 18px var(--rouge)}
.clim-lames{height:34px;margin:0 30px;border-radius:0 0 18px 18px;background:repeating-linear-gradient(90deg,#B9C2D0 0 18px,#CDD4DF 18px 36px)}
.note{position:absolute;width:300px;padding:26px 28px;border-radius:14px;background:#F4F1E8;color:#2B3346;font-size:34px;font-weight:600;box-shadow:0 24px 50px rgba(0,0,0,.45)}
.maux{grid-column:1;display:flex;flex-direction:column;gap:18px;margin-top:20px}
.mal{font-size:40px;font-weight:600;display:flex;align-items:center;gap:22px}
.croix{width:56px;height:56px;border-radius:50%;background:rgba(224,82,74,.15);color:var(--rouge);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;flex-shrink:0}
.panneau{position:absolute;left:150px;top:300px;width:820px;display:flex;flex-direction:column;gap:20px}
.pastille{width:84px;height:84px;border-radius:50%;background:var(--or);color:var(--nuit);font-weight:700;font-size:44px;display:flex;align-items:center;justify-content:center}
.sous{font-size:32px;line-height:1.4;color:var(--gris);font-weight:400}
.progression{display:flex;gap:10px;margin-top:10px}
.progression span{width:64px;height:8px;border-radius:8px;background:rgba(159,176,200,.25)}
.progression span.on{background:var(--or)}
.tel{position:absolute;left:1210px;top:40px;width:531px;height:882px;border-radius:66px;background:#0A0F1A;padding:16px;box-shadow:0 0 0 2px #2A3550,0 40px 90px rgba(0,0,0,.55)}
.ecran{width:%(SW)spx;height:%(SH)spx;border-radius:52px;overflow:hidden;position:relative;background:#fff}
.shot{position:absolute;left:0;top:0;width:%(IW)spx;height:%(IH)spx;transform-origin:0 0}
.shot img{display:block;width:%(IW)spx;height:%(IH)spx}
.hl{position:absolute;border:10px solid var(--or);border-radius:34px;box-shadow:0 0 0 0 rgba(201,151,43,0),0 0 30px rgba(201,151,43,.6);opacity:0}
.tap{position:absolute;width:180px;height:180px;border-radius:50%;background:rgba(201,151,43,.55);opacity:0}
.cartes{display:flex;gap:40px;margin-top:40px}
.carte{width:460px;padding:40px 38px;border-radius:28px;background:rgba(15,42,92,.75);border:1px solid rgba(201,151,43,.35);display:flex;flex-direction:column;gap:14px}
.carte-n{width:56px;height:56px;border-radius:50%;background:var(--or);color:var(--nuit);font-weight:700;font-size:28px;display:flex;align-items:center;justify-content:center}
.carte-t{font-size:36px;font-weight:700}
.carte-s{font-size:24px;color:var(--gris);line-height:1.4}
.st{position:absolute;left:0;right:0;bottom:34px;display:flex;justify-content:center;z-index:20;pointer-events:none}
.st span{background:rgba(6,20,46,.82);color:#fff;font-size:36px;line-height:1.35;font-weight:600;padding:10px 26px;border-radius:12px;text-align:center;max-width:1300px}
""".replace("%(SW)s", str(SCR_W)).replace("%(SH)s", str(SCR_H)).replace("%(IW)s", str(W_IMG)).replace("%(IH)s", str(H_IMG))


def construire(cfg, images, fonts, gsap_tag):
    plans, total = [], 0
    for pid, d in cfg["plans"]:
        plans.append((pid, total, d)); total += d
    START = {p: s for p, s, d in plans}; DUR = {p: d for p, s, d in plans}
    css_fonts = "".join(
        f'@font-face{{font-family:"IBM Plex Sans";font-weight:{w};font-style:normal;font-display:block;src:url({src}) format("woff2");}}'
        for w, src in fonts.items())
    scenes, js = [], []
    a = js.append

    def scene(pid, contenu):
        scenes.append(f'<div class="scene clip" id="{pid}" data-start="{START[pid]}" data-duration="{DUR[pid]}" data-track-index="0">'
                      f'<div class="scene-content">{contenu}</div></div>')

    # Ouverture
    p0 = plans[0][0]
    titre_html = cfg.get("titre_intro_html", cfg["titre"])
    scene(p0, f'<div class="logo-carte" id="{p0}-logo"><img src="{images["logo"]}" alt="Roxgold"></div>'
              f'<div class="kicker or" id="{p0}-k">ROXGOLD · SITELIFE</div>'
              f'<h1 class="titre-xl" id="{p0}-t">{titre_html}</h1>'
              f'<div class="etiquette" id="{p0}-e">{cfg["etiquette"]}</div>')
    a(f'tl.from("#{p0}-logo",{{scale:.6,autoAlpha:0,duration:.7,ease:"back.out(1.6)"}},.15);'
      f'tl.from("#{p0}-k",{{autoAlpha:0,scale:1.15,duration:.8,ease:"power2.out"}},.5);'
      f'tl.from("#{p0}-t",{{y:40,autoAlpha:0,duration:.7,ease:"power4.out"}},.8);'
      f'tl.from("#{p0}-e",{{autoAlpha:0,y:20,duration:.5,ease:"power2.out"}},1.3);'
      f'tl.to("#{p0}-logo",{{y:-8,duration:1.2,ease:"sine.inOut",yoyo:true,repeat:1}},1.2);')

    # Constat
    c = cfg["constat"]; pc = c["plan"]; s = START[pc]
    if c.get("decor") == "clim":
        decor = (f'<div class="decor" id="{pc}-decor"><div class="clim-corps"><span class="clim-led" id="{pc}-led"></span></div>'
                 '<div class="clim-lames"></div></div>')
    else:
        notes = c.get("notes", ["?"])
        decor = f'<div class="decor" id="{pc}-decor" style="height:520px">' + "".join(
            f'<div class="note" id="{pc}-n{i}" style="left:{40+i*90}px;top:{30+i*140}px;transform:rotate({[-6,4,-3][i%3]}deg)">{t}</div>'
            for i, t in enumerate(notes)) + '</div>'
    maux = "".join(f'<div class="mal" id="{pc}-m{i}"><span class="croix">✕</span>{t}</div>' for i, (t, _) in enumerate(c["maux"]))
    scene(pc, f'<div class="constat"><div class="kicker rouge" id="{pc}-k">LE CONSTAT</div>'
              f'<h2 class="titre-l" id="{pc}-t">{c["titre"]}</h2>{decor}<div class="maux">{maux}</div></div>')
    a(f'tl.from("#{pc}-k",{{autoAlpha:0,x:-30,duration:.5,ease:"power2.out"}},{s+.2});'
      f'tl.from("#{pc}-t",{{autoAlpha:0,y:30,duration:.6,ease:"power4.out"}},{s+.4});'
      f'tl.from("#{pc}-decor",{{autoAlpha:0,scale:.9,duration:.8,ease:"expo.out"}},{s+.6});'
      f'tl.to("#{pc}-decor",{{y:-10,duration:2,ease:"sine.inOut",yoyo:true,repeat:1}},{s+5});')
    if c.get("decor") == "clim":
        a(f'tl.to("#{pc}-led",{{opacity:.2,duration:.45,ease:"sine.inOut",yoyo:true,repeat:11}},{s+1});')
    else:
        for i in range(len(c.get("notes", []))):
            a(f'tl.from("#{pc}-n{i}",{{autoAlpha:0,y:-40,rotation:0,duration:.6,ease:"back.out(1.6)"}},{s+.9+i*.35});')
    for i, (_, t) in enumerate(c["maux"]):
        a(f'tl.from("#{pc}-m{i}",{{autoAlpha:0,x:60,duration:.5,ease:"back.out(1.6)"}},{s+t});')

    # Plans téléphone
    for pid, (img, etape, kicker, titre, sous, zones) in cfg["telephone"].items():
        s, d = START[pid], DUR[pid]
        pastille = f'<div class="pastille" id="{pid}-n">{etape}</div>' if etape else ''
        hls = "".join(f'<div class="hl" id="{pid}-h{j}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px"></div>'
                      for j, (x, y, w, h, t, z) in enumerate(zones))
        tap = ''
        if pid in cfg.get("taps", {}):
            tx_, ty_, _ = cfg["taps"][pid]
            tap = f'<div class="tap" id="{pid}-tap" style="left:{tx_-90}px;top:{ty_-90}px"></div>'
        prog = ('<div class="progression">' + "".join(f'<span class="{"on" if i <= etape else ""}"></span>'
                for i in range(1, cfg["etapes_total"] + 1)) + '</div>') if etape else ''
        texte = (f'<div class="panneau">{pastille}<div class="kicker or" id="{pid}-k">{kicker.upper()}</div>'
                 f'<h2 class="titre-l" id="{pid}-t">{titre}</h2><p class="sous" id="{pid}-s">{sous}</p>{prog}</div>')
        tel = (f'<div class="tel" id="{pid}-tel"><div class="ecran"><div class="shot" id="{pid}-shot">'
               f'<img src="{images[img]}" alt="">{hls}{tap}</div></div></div>')
        scene(pid, texte + tel)
        a(f'gsap.set("#{pid}-shot",{{x:0,y:0,scale:{K0:.4f},transformOrigin:"0 0"}});')
        entree = "y:120" if pid == cfg.get("plan_solution") else "x:40"
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
        for (x, y, w, h, t, z) in cfg.get("recentrages", {}).get(pid, []):
            tx, ty, k = zoom_cible(x, y, w, h, z)
            a(f'tl.to("#{pid}-shot",{{x:{tx},y:{ty},scale:{k},duration:.7,ease:"power2.inOut"}},{s+t});')
        if pid in cfg.get("taps", {}):
            a(f'tl.fromTo("#{pid}-tap",{{autoAlpha:.9,scale:.2}},{{autoAlpha:0,scale:1.6,duration:.7,ease:"power2.out"}},{s+cfg["taps"][pid][2]});')

    # Résultat
    r = cfg["resultat"]; pr = r["plan"]; s = START[pr]
    scene(pr, f'<div class="kicker or" id="{pr}-k">LE RÉSULTAT</div><h2 class="titre-l centre" id="{pr}-t">{r["titre"]}</h2>'
              '<div class="cartes">' + "".join(f'<div class="carte" id="{pr}-c{i}"><div class="carte-n">{i+1}</div><div class="carte-t">{t}</div><div class="carte-s">{st}</div></div>'
                                               for i, (t, st) in enumerate(r["cartes"])) + '</div>')
    a(f'tl.from("#{pr}-k",{{autoAlpha:0,y:-20,duration:.5,ease:"power2.out"}},{s+.2});'
      f'tl.from("#{pr}-t",{{autoAlpha:0,y:30,duration:.6,ease:"power4.out"}},{s+.4});')
    for i in range(len(r["cartes"])):
        a(f'tl.from("#{pr}-c{i}",{{autoAlpha:0,y:60,duration:.6,ease:"back.out(1.6)"}},{s+1.0+i*.9});'
          f'tl.to("#{pr}-c{i}",{{y:-8,duration:1.6,ease:"sine.inOut",yoyo:true,repeat:1}},{s+4+i*.3});')

    # Conclusion
    k = cfg["conclusion"]; pk = k["plan"]; s = START[pk]
    scene(pk, f'<div class="logo-carte" id="{pk}-logo"><img src="{images["logo"]}" alt="Roxgold"></div>'
              f'<div class="kicker or" id="{pk}-k">ROXGOLD · SITELIFE</div>'
              f'<h2 class="titre-l centre" id="{pk}-t">{k["phrase"]}</h2>'
              f'<div class="chemin" id="{pk}-c">{k["chemin"]}</div>')
    a(f'tl.from("#{pk}-logo",{{scale:.7,autoAlpha:0,duration:.6,ease:"back.out(1.6)"}},{s+.1});'
      f'tl.from("#{pk}-k",{{autoAlpha:0,duration:.5,ease:"power2.out"}},{s+.4});'
      f'tl.from("#{pk}-t",{{autoAlpha:0,y:24,duration:.6,ease:"power4.out"}},{s+.6});'
      f'tl.from("#{pk}-c",{{autoAlpha:0,y:16,duration:.5,ease:"power2.out"}},{s+1.0});'
      f'tl.to("#{pk}-logo",{{y:-6,duration:1,ease:"sine.inOut",yoyo:true,repeat:1}},{s+1.4});'
      f'tl.to("#main",{{opacity:0,duration:.5,ease:"power2.in"}},{total-.5});')

    subs = "".join(f'<div class="st clip" id="st{i}" data-start="{a0}" data-duration="{round(b0-a0,2)}" data-track-index="1"><span>{t}</span></div>'
                   for i, (a0, b0, t) in enumerate(cfg["sous_titres"]))
    return f'''<!doctype html>
<html lang="fr" style="overflow:hidden;margin:0">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=1920, height=1080">
<title>{cfg["code"]} · {cfg["titre"]} · Roxgold SiteLife</title>
{gsap_tag}
<style>
{css_fonts}
{CSS}
</style>
</head>
<body>
<div id="main" data-composition-id="main" data-width="1920" data-height="1080" data-start="0" data-duration="{total}">
<div class="fond clip" id="fond" data-start="0" data-duration="{total}" data-track-index="2"><svg class="courbes" id="courbes" viewBox="0 0 2040 1080" preserveAspectRatio="none"><path d="M-50 820 C 400 700, 800 900, 1300 760 S 1900 640, 2080 700"/><path d="M-50 900 C 420 800, 820 1000, 1320 860 S 1900 760, 2080 800"/><path d="M-50 240 C 380 160, 760 330, 1260 210 S 1900 120, 2080 170"/></svg></div>
{"".join(scenes)}
{subs}
</div>
<script>
window.__timelines = window.__timelines || {{}};
var tl = gsap.timeline({{ paused: true }});
tl.fromTo("#courbes",{{x:0}},{{x:-120,duration:{total},ease:"none"}},0);
{chr(10).join(js)}
window.__timelines["main"] = tl;
</script>
</body>
</html>
''', total


def generer(cfg):
    gsap, fonts_dir = sys.argv[1], sys.argv[2]
    ici = cfg["dossier"]; cap = os.path.join(ici, "captures"); out = os.path.join(ici, "hyperframes")
    os.makedirs(os.path.join(out, "assets"), exist_ok=True)
    fonts = {w: b64(os.path.join(fonts_dir, f"ibm-plex-sans-latin-{w}-normal.woff2"), "font/woff2") for w in (400, 600, 700)}
    utilisees = sorted({v[0] for v in cfg["telephone"].values()})
    imgs = {"logo": "assets/roxgold-logo.png"}
    shutil.copy(LOGO, os.path.join(out, "assets", "roxgold-logo.png"))
    for n in utilisees:
        shutil.copy(os.path.join(cap, n), os.path.join(out, "assets", n)); imgs[n] = f"assets/{n}"
    shutil.copy(gsap, os.path.join(out, "assets", "gsap.min.js"))
    html, total = construire(cfg, imgs, fonts, '<script src="assets/gsap.min.js"></script>')
    open(os.path.join(out, "index.html"), "w").write(html)
    imgs = {"logo": b64(LOGO, "image/png"), **{n: jpeg_b64(os.path.join(cap, n)) for n in utilisees}}
    os.makedirs(os.path.join(ici, "send_to_hyperframes"), exist_ok=True)
    html, _ = construire(cfg, imgs, fonts, '<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>\n'
                         '<script src="https://cdn.jsdelivr.net/npm/@hyperframes/core/dist/hyperframe.runtime.iife.js"></script>')
    open(os.path.join(ici, "send_to_hyperframes", f'{cfg["code"]}_send_to_hyperframes.html'), "w").write(html)
    json.dump({"id": f'roxgold-sitelife-{cfg["code"].lower()}', "name": f'{cfg["code"]} {cfg["titre"]}'},
              open(os.path.join(out, "meta.json"), "w"), ensure_ascii=False, indent=2)
    if not os.path.exists(os.path.join(out, "hyperframes.json")):
        shutil.copy(os.path.join(os.path.dirname(os.path.abspath(__file__)), "hyperframes.json"), out)
    open(os.path.join(out, ".gitignore"), "w").write(".hyperframes/\nrenders/\n")
    srt_path = os.path.join(TUTOS, "08_SOUS_TITRES", f'{cfg["code"]}_{os.path.basename(ici).split("_", 1)[1]}.srt')
    open(srt_path, "w").write(srt(cfg["sous_titres"]))
    print(f'ok {cfg["code"]} : {total} s, {len(cfg["plans"])} plans, {len(cfg["sous_titres"])} sous-titres -> {os.path.relpath(srt_path, TUTOS)}')
