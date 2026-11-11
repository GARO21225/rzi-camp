# T02 : captures d'écran

**Captures réelles** de l'application, prises le 11/11/2026 sur une **instance locale de démonstration** (base SQLite vierge, jamais la production), iPhone 13 émulé, compte fictif `demo.arrivant` (Yao DEMO, DEMO SARL, chambre DEMO-A03).
Le contenu de l'induction est le contenu officiel chargé par les migrations (`residences/induction_roxgold.py`), **contacts anonymisés** par `seed_demo_t02.py`.

| Fichier | Plan | Contenu |
|---|---|---|
| `01_bienvenue.png` | P03, P04 | Étape 1/6 Bienvenue (ouverte automatiquement après la connexion) |
| `02_bienvenue_parcours.png` | P05 | Chiffres du camp et « Votre parcours d'induction — ~15 minutes » |
| `03_infras_grille.png` | P06 | Grille des 8 infrastructures |
| `04_infra_selection.png` | — | Carte Restaurant sélectionnée (non utilisée) |
| `04b_infra_detail.png` | P07 | Fiche Restaurant : horaires et consignes |
| `05_infras_vues.png` | P08 | 4/8 infrastructures visitées, bouton Continuer actif |
| `06_regles_liste.png` | P09 | Règles de vie avec leurs badges de niveau |
| `07_regle_critique.png` | P10 | Règle critique dépliée |
| `08_regles_lues.png` | P11 | Toutes les règles lues, bouton vers le quiz |
| `09_quiz.png` | P12 | Quiz : 10 questions, bonnes réponses toutes requises |
| `10_quiz_reponses.png` | P13 | Réponses sélectionnées |
| `11_quiz_reussi.png` | P14 | Quiz réussi ! 10/10 |
| `12_appareils.png` | P15 | Étape Appareils énergivores |
| `13_appareil_formulaire.png` | P16 | Formulaire : Réfrigérateur, 150 W, DEMO-A03 |
| `14_appareil_declare.png` | P17 | Appareil déclaré |
| `15_engagement.png` | P18 | Récapitulatif de l'induction |
| `16_signature.png` | P19 | Signature tracée, bouton Finaliser |
| `17_certificat.png` | P20 | Certificat d'induction Camp |

## Reproduire

Prérequis : backend Daphne et frontend Vite lancés comme pour T05 (voir `T05_signaler_incident/LISTE_CAPTURES.md`).

```bash
cd backend && T02_REPONSES=/tmp/reponses_quiz.json DEBUG=True python manage.py shell < ../docs/ROXGOLD_SITELIFE_TUTORIALS/06_PROJETS_HYPERFRAMES/T02_induction_camp/seed_demo_t02.py
```

```bash
cd frontend && T02_REPONSES=/tmp/reponses_quiz.json node ../docs/ROXGOLD_SITELIFE_TUTORIALS/06_PROJETS_HYPERFRAMES/T02_induction_camp/capture_t02.js
```

`seed_demo_t02.py` remet le parcours à zéro à chaque lancement, et peut être relancé sans dommage.
