# T04 : captures d'écran

Captures **réelles** prises le 11/11/2026 vers 05 h 15 UTC sur l'instance locale de démonstration (jamais la production), iPhone 13 émulé, navigateur en français, **heure réelle**. Le convoi a été mis en route par la vraie API (`seed_demo_t04.py`), avec un tracé GPS fictif. Le fond de carte est celui de l'application (tuiles Esri World Street Map).

| Fichier | Plan | Contenu |
|---|---|---|
| `01_accueil_trajet_en_cours.png` | P04 | Accueil : Trajet en cours · En route, Yamoussoukro, Bus DÉMO · DEMO-001, bouton « Suivre mon bus en direct » |
| `02_suivi_carte.png` | P03, P05, P06 | Panneau « Mon trajet en direct » : carte, arrivée estimée, km restants |
| `03_suivi_parcours.png` | P07 | Parcours : arrêts passés, votre montée |
| `04_suivi_bus_entre.png` | P08 | « Le bus est entre… » et votre descente |
| `05_voyages.png` | P09 | Page Voyages, ligne du trajet **en cours** (Camp → Yamoussoukro) : « En route » et bouton « Suivre en direct ». La ligne du retour planifié (21/11) a aussi ce bouton (son propre convoi, à venir) : elle n'est pas celle mise en avant. |

## Reproduire (à lancer juste avant la capture, pour des positions fraîches)

Prérequis : bases de démo T05 et T03, Daphne et Vite lancés (voir `T05_signaler_incident/LISTE_CAPTURES.md`). Le réseau doit autoriser `server.arcgisonline.com` et `unpkg.com` (environnement « Roxgold SiteLife »).

```bash
cd backend && DEBUG=True python manage.py shell < ../docs/ROXGOLD_SITELIFE_TUTORIALS/06_PROJETS_HYPERFRAMES/T04_suivre_bus/seed_demo_t04.py
```

```bash
cd frontend && node ../docs/ROXGOLD_SITELIFE_TUTORIALS/06_PROJETS_HYPERFRAMES/T04_suivre_bus/capture_t04.js
```
