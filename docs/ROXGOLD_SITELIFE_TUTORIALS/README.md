# ROXGOLD SITELIFE : bibliothèque de tutoriels vidéo

Chaîne de production : **Claude** (audit, scripts, orchestration) → **FLORA** (voix off, illustrations) → **HyperFrames** (montage, animation, rendu).

| Dossier | Contenu | État |
|---|---|---|
| `00_IDENTITE_VISUELLE/` | Charte vidéo (logo, couleurs, typographies, habillage) | Phase 5 |
| `01_AUDIT_APPLICATION/` | Audit fonctionnel du code : modules, profils, statuts | ✅ Livré, phase 1 |
| `02_CATALOGUE_TUTORIELS/` | Catalogue priorisé des 29 tutoriels | ✅ Livré, à valider (phase 4) |
| `03_SCRIPTS_VOIX_OFF/` | Scripts complets et scripts FLORA par tutoriel | **T05, T02, T01, T03, T04 livrés** |
| `04_STORYBOARDS/` | Storyboards plan par plan | **T05, T02, T01, T03, T04 livrés** |
| `05_ASSETS_FLORA/` | Prompts FLORA et illustrations complémentaires | **T05, T02, T01, T03, T04 : prompts livrés** |
| `06_PROJETS_HYPERFRAMES/` | Structure et compositions HyperFrames | **T05, T02, T01, T03, T04 : compositions, captures réelles et voix FLORA**, générateur commun `_commun/` |
| `07_EXPORTS_VIDEO/` | Rendus MP4 (non versionnés dans Git) | T05, T02, T01, T03, T04 : versions v1 **avec voix off FLORA** |
| `08_SOUS_TITRES/` | Sous-titres `.srt` | **T05, T02, T01, T03, T04 livrés** |

Voix off : FLORA, modèle Gemini 3.1 Flash TTS, voix **Charon** (fr-FR), consigne de ton naturel et posé ; un fichier par plan dans `06_PROJETS_HYPERFRAMES/TXX/hyperframes/assets/voix/`. Le générateur cale automatiquement chaque plan, ses animations et ses sous-titres sur la durée réelle de la voix.

Règles : seules les fonctionnalités vérifiées comme opérationnelles sont filmées, uniquement sur un environnement de démonstration avec des données fictives, et sans aucune fausse capture.
