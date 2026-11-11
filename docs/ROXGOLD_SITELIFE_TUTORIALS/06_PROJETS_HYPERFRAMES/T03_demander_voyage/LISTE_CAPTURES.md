# T03 : captures d'écran

Captures **réelles** prises le 11/11/2026 sur l'instance locale de démonstration (jamais la production), iPhone 13 émulé, navigateur en français, horloge fixée à 10h15 (Africa/Abidjan). Compte fictif `demo.resident` (Aya DEMO, chambre DEMO-A02). La validation est faite par `demo.admin` via l'API, comme le ferait l'administration depuis Demandes ou le Centre de Mobilité.

| Fichier | Plan | Contenu |
|---|---|---|
| `01_accueil_sans_trajet.png` | P04 | Accueil : aucun trajet prévu, bouton « Demander un voyage » |
| `02_demandes.png` | P05 | Page Demandes vide, bouton bus |
| `03_formulaire.png` | P06 | Formulaire Voyage vide |
| `04_itineraire.png` | P07 | Itinéraire Camp → Abidjan, montée CAMP, descente ABIDJAN, jours de circulation |
| `05_transport_dates.png` | P08 | Car du camp, départ 16/11/2026, retour 28/11/2026 |
| `06_motif_soumettre.png` | P09 | Motif Repos, précisions, bouton Soumettre |
| `07_demande_en_attente.png` | P03, P10 | Demande « En attente », bouton Annuler |
| `08_demande_validee.png` | P11 | Demande « Validée » et commentaire de l'administration |
| `09_accueil_trajet.png` | P13 | Accueil : prochain trajet Abidjan, lundi 16 novembre, J-5 |
| `10_notification.png` | P12 | Cloche : « Votre demande a été validée » |

## Reproduire

Prérequis : base de démo T05 (`seed_demo.py`), Daphne et Vite lancés (voir `T05_signaler_incident/LISTE_CAPTURES.md`).

```bash
cd backend && DEBUG=True python manage.py shell < ../docs/ROXGOLD_SITELIFE_TUTORIALS/06_PROJETS_HYPERFRAMES/T03_demander_voyage/seed_demo_t03.py
```

```bash
cd frontend && node ../docs/ROXGOLD_SITELIFE_TUTORIALS/06_PROJETS_HYPERFRAMES/T03_demander_voyage/capture_t03.js
```
