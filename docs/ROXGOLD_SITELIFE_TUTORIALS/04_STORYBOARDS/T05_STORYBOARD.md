# T05 : storyboard plan par plan

Format 1920 × 1080, 30 i/s. Charte : bleu nuit `#06142E` / marine `#0F2A5C`, or `#C9972B`, fond clair `#EEF1F6`, typographie **IBM Plex Sans** (celle de l'accueil de l'application). Le téléphone est un cadre sombre arrondi qui contient les **captures réelles**, sans aucune retouche de l'interface.
Surlignages : encadré or 4 px aux coins arrondis, plus un léger halo. Zooms : ×1,6 à ×2,2 sur la zone utile, en 0,6 s (`power2.inOut`).

| Plan | Durée | Visuel (image) | Action visuelle | Texte incrusté | Animation | Voix off | Transition vers suivant |
|---|---|---|---|---|---|---|---|
| P01 | 0:00-0:04 (4 s) | Fond bleu nuit et courbes de niveau dorées (rappel de l'accueil de l'app), logo Roxgold | Le logo apparaît, puis le titre | ROXGOLD SITELIFE · *Tutoriel* · Signaler un incident de maintenance | Logo `back.out`, tracé des lignes dorées, titre en fondu montant | P01 | Coupe franche |
| P02 | 0:04-0:15 (11 s) | Illustration FLORA (voir `05_ASSETS_FLORA`) : chambre de camp, climatiseur à l'arrêt. Mention « Illustration » en bas à droite | Lent zoom avant (Ken Burns) | « Signalé de vive voix » · « Vite oublié » · « Aucun suivi » (une étiquette à la fois) | Étiquettes en `power4.out`, légère flottaison | P02 | Coupe |
| P03 | 0:15-0:23 (8 s) | Téléphone avec `04_maintenance_liste.png` | Le téléphone monte depuis le bas, à droite | Gauche : ROXGOLD SITELIFE · « Déclarer · Prioriser · Suivre » | Téléphone `expo.out`, mots en cascade | P03 | Coupe |
| P04 | 0:23-0:29 (6 s) | `03_accueil.png` | Encadré or sur l'onglet **Signaler** (barre du bas) | Étape ① · Onglet « Signaler » | Pulsation de l'encadré | P04 | Coupe |
| P05 | 0:29-0:35 (6 s) | `04_maintenance_liste.png` | Cercle or pulsant sur le bouton **+** | Étape ② · Bouton « + » | Pulsation ×2 | P05 | Coupe |
| P06 | 0:35-0:39 (4 s) | `05_formulaire_vide.png` | Le formulaire apparaît | Déclarer un incident | Fondu, léger zoom | P06 | Coupe |
| P07 | 0:39-0:45 (6 s) | `06_titre.png` | Zoom sur le champ **TITRE \*** | Étape ③ · Titre * | Zoom ×1,8 | P07 | Coupe |
| P08 | 0:45-0:53 (8 s) | `07_description_categorie_priorite.png` | Encadrés successifs : Description, Catégorie, Priorité | Étape ④ · Description * · Catégorie · Priorité | Encadré qui glisse d'un champ à l'autre | P08 | Coupe |
| P09 | 0:53-1:02 (9 s) | `08_lieu_et_envoi.png` | Encadrés : Type de lieu, Résidence, Bloc / Chambre | Étape ⑤ · Lieu | Glissement de l'encadré | P09 | Coupe |
| P10 | 1:02-1:11 (9 s) | `08_lieu_et_envoi.png` | Encadrés : Photo, bandeau délai, bouton **Déclarer l'incident** (effet d'appui) | Étape ⑥ · Photo (facultatif) · Délai automatique · Envoyer | Effet « tap » : cercle qui s'étend | P10 | **Transition shader `cinematic-zoom` (0,5 s)**, le seul moment fort |
| P11 | 1:11-1:18 (7 s) | `09_incident_declare.png` | Zoom sur la carte de l'incident | ✅ Incident déclaré · Statut « Déclaré » · Échéance | Coche `back.out`, zoom | P11 | Coupe |
| P12 | 1:18-1:26 (8 s) | `10_detail_incident.png` | Surlignage du parcours, une étape après l'autre | Déclaré → Assigné → En cours → Résolu → Clôturé | Remplissage progressif | P12 | Coupe |
| P13 | 1:26-1:36 (10 s) | Fond bleu nuit | 3 cartes de bénéfices | 🔔 Responsables prévenus · ⏱️ Priorité & échéance · 📋 Suivi tracé | Cartes en cascade, flottaison | P13 | Coupe |
| P14 | 1:36-1:40 (4 s) | Logo | Signature de fin | ROXGOLD SITELIFE · Maintenance › Signaler | Fondu final | P14 | Fin |

**Sous-titres** : synchronisés, en bas au centre, 40 px, fond `rgba(6,20,46,.75)` (fichier `08_SOUS_TITRES/T05_signaler_incident.srt`).
**Musique** : nappe corporate discrète, −24 dB sous la voix. Elle sera ajoutée à l'étape « Enhance » d'HyperFrames.
