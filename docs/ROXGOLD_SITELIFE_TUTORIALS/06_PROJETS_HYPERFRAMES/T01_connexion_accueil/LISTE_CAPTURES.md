# T01 : captures d'écran

Captures **réelles** prises le 11/11/2026 sur l'instance locale de démonstration (jamais la production), iPhone 13 émulé, horloge du navigateur fixée à 10h15 (Africa/Abidjan). Compte fictif `demo.resident` (Aya DEMO, DEMO SARL, chambre DEMO-A02), trajet « Camp Roxgold Sango → Abidjan » et demande en attente créés par `seed_demo_t01.py`.

| Fichier | Plan | Contenu |
|---|---|---|
| `00_installation_iphone.png` | P04 | Page de connexion avec la notice « Installer l'application sur iPhone » |
| `01_connexion.png` | P06 | Page de connexion vide (onglets Mot de passe / Code SMS) |
| `02_connexion_remplie.png` | P05 | Identifiant et mot de passe saisis |
| `03_accueil.png` | P03, P07, P10 | Accueil : Bonjour Aya, prochain trajet Abidjan J-4, raccourcis, barre d'onglets |
| `04_accueil_raccourcis.png` | P08 | Raccourcis |
| `05_accueil_demandes.png` | P09 | Mes demandes : 1 en attente, 0 validée |
| `06_menu_plus.png` | P11 | Menu « Plus » : pages, Mon compte, Déconnexion |
| `07_mon_compte.png` | P12 | Mon compte : profil, langue |
| `08_securite.png` | P13 | Onglet Sécurité |
| `09_mdp_rempli.png` | P14 | Ancien, nouveau (jauge « Excellent »), confirmation correspondante |
| `10_mdp_modifie.png` | — | Juste après l'envoi (non utilisée) |
| `11_retour_connexion.png` | P15 | Retour automatique à la connexion |

## Reproduire

Prérequis : base de démo T05 (`seed_demo.py`), Daphne et Vite lancés (voir `T05_signaler_incident/LISTE_CAPTURES.md`).

```bash
cd backend && DEBUG=True python manage.py shell < ../docs/ROXGOLD_SITELIFE_TUTORIALS/06_PROJETS_HYPERFRAMES/T01_connexion_accueil/seed_demo_t01.py
```

```bash
cd frontend && node ../docs/ROXGOLD_SITELIFE_TUTORIALS/06_PROJETS_HYPERFRAMES/T01_connexion_accueil/capture_t01.js
```

```bash
cd backend && DEBUG=True python manage.py shell < ../docs/ROXGOLD_SITELIFE_TUTORIALS/06_PROJETS_HYPERFRAMES/T01_connexion_accueil/seed_demo_t01.py
```

La seconde exécution du script remet le mot de passe de démo, que la capture a modifié.
