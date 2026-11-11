# T05 : structure de production HyperFrames

Version installée et testée : **CLI `hyperframes` 0.9.31** (npm). Le lint donne **0 erreur**. Les 18 avertissements recommandent seulement de découper en sous-compositions ; ils sont sans effet sur le rendu.

```
T05_signaler_incident/
├── captures/                      # captures RÉELLES de l'application (instance de démo, données fictives)
├── capture_t05.js                 # rejoue le parcours et refait les captures (Playwright)
├── seed_demo.py                   # crée le compte et les résidences fictifs sur une base locale vierge
├── generer_composition.py         # configuration du tutoriel (plans, textes, encadrés, sous-titres) → ../_commun/generateur_tutoriel.py
├── hyperframes/                   # PROJET HYPERFRAMES LOCAL (CLI)
│   ├── index.html                 # composition 1920×1080, 100 s, 14 plans + 21 sous-titres
│   ├── assets/                    # captures, logo, gsap.min.js (local)
│   ├── hyperframes.json · meta.json
└── send_to_hyperframes/
    └── T05_send_to_hyperframes.html   # MÊME composition en fichier unique (tout en base64), pour le flux hébergé HeyGen
```

## Composition (`hyperframes/index.html`)

- Racine `#main`, `data-composition-id="main"`, 1920 × 1080, `data-duration="100"`.
- Piste 2 : fond bleu nuit avec courbes de niveau dorées qui défilent lentement (signature visuelle de l'accueil de l'application).
- Piste 0 : 14 plans `p01` … `p14`, collés bout à bout (timings du storyboard).
- Piste 1 : 21 sous-titres incrustés, mêmes textes et mêmes temps que le fichier `.srt`.
- Une seule timeline GSAP en pause, enregistrée dans `window.__timelines["main"]`, entièrement déterministe.
- Téléphone : écran de 499 × 850 px contenant la capture d'origine (1170 × 1992). Les encadrés or et les zooms sont placés en pixels de la capture : ils restent exacts si on remplace une capture par une nouvelle de même taille.

## Commandes

```bash
cd docs/ROXGOLD_SITELIFE_TUTORIALS/06_PROJETS_HYPERFRAMES/T05_signaler_incident/hyperframes
```

```bash
npx hyperframes@0.9.31 lint
```

```bash
npx hyperframes@0.9.31 snapshot --at 26,49,74
```

```bash
npx hyperframes@0.9.31 render -o ../../../07_EXPORTS_VIDEO/T05_signaler_incident_v1.mp4
```

Après avoir modifié le script, les sous-titres ou une capture, régénérer la composition :

```bash
python3 generer_composition.py <chemin vers gsap.min.js 3.14.2> <dossier @fontsource/ibm-plex-sans/files>
```

## Étapes restantes (phase 7, après ta validation)

1. **Voix FLORA** : générer `T05_P01.mp3` … `T05_P14.mp3` (texte : `03_SCRIPTS_VOIX_OFF/T05_signaler_incident/03_VOIX_OFF_FLORA.txt`) et les déposer dans `hyperframes/assets/voix/`. Chaque fichier sera placé au début de son plan avec une balise `<audio class="clip" data-start="…">` (piste 3). Ensuite, recaler le SRT sur les durées réelles.
2. **Illustration FLORA du plan P02**, à placer derrière le texte du constat, avec la mention « Illustration ».
3. **Logo officiel en haute définition** (le fichier du dépôt `roxgold-logo.png` ne fait que 385 × 227 px).
4. **Musique et transition** : une nappe discrète et, si souhaité, la transition `cinematic-zoom` entre P10 et P11, via l'étape « Enhance » d'HyperFrames hébergé, ou ajoutées ici.
5. Rendu final en 1080p (`render`), puis la checklist `10_CHECKLIST_VALIDATION.md`.

## Flux hébergé HeyGen (facultatif)

`send_to_hyperframes/T05_send_to_hyperframes.html` respecte le contrat du guide « Send to HyperFrames » : fichier unique, polices et images en base64, GSAP et runtime chargés par CDN. Il peut être importé dans un projet HeyGen depuis claude.ai avec le connecteur HyperFrames, pour l'enrichir (son, musique) et le rendre dans le cloud. Attention : l'offre gratuite donne 3 rendus par mois, puis 20 crédits par minute.
