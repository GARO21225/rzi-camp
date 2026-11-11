# Générateur commun des tutoriels

`generateur_tutoriel.py` construit, à partir de la configuration d'un tutoriel (`TXX_.../generer_composition.py`) :
- `hyperframes/index.html` : projet HyperFrames local (CLI `hyperframes` 0.9.31), avec les captures en fichiers ;
- `send_to_hyperframes/TXX_send_to_hyperframes.html` : la même composition en fichier unique autonome, pour le flux hébergé HeyGen ;
- `08_SOUS_TITRES/TXX_*.srt` : sous-titres générés depuis la **même** liste que ceux incrustés dans la vidéo, donc toujours synchrones.

Habillage commun : fond bleu nuit et courbes dorées, téléphone à droite avec les captures réelles, panneau d'étape à gauche, encadrés or, zooms bornés pour que chaque zone reste entière, sous-titres incrustés.

```bash
python3 TXX_.../generer_composition.py <gsap.min.js 3.14.2> <node_modules/@fontsource/ibm-plex-sans/files>
```

```bash
cd TXX_.../hyperframes && npx hyperframes@0.9.31 lint && npx hyperframes@0.9.31 render -o ../../../07_EXPORTS_VIDEO/TXX_..._v1.mp4
```
