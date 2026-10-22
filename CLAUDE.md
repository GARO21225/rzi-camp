# CLAUDE.md — Roxgold SiteLife ERP

Ce fichier est le point d'entrée pour toute instance de Claude qui reprend ce projet. Lis-le avant de toucher au code.

## C'est quoi

ERP de gestion d'un camp minier résidentiel (Roxgold Sango, Côte d'Ivoire). Django REST + React/Vite. Déployé sur Render (deux services séparés : backend et frontend).

## Stack exacte

| Couche | Techno | Détail |
|---|---|---|
| Backend | Django 4.2 + DRF | servi en **ASGI via Daphne**, pas WSGI/gunicorn |
| DB | PostgreSQL | sur Render |
| Auth | JWT (`rest_framework_simplejwt`) via une vue **custom** `custom_login`, pas `TokenObtainPairView` directement |
| Temps réel | Django Channels | WebSocket sur `/ws/notifications/` |
| Frontend | React 18 + Vite | pas Next.js malgré ce qui a pu être dit ailleurs — c'est du Vite SPA classique |
| Routing | react-router-dom | toutes les pages doivent être lazy-loaded (voir section Perf) |
| State | Zustand (`src/store.js`) | pas Redux |
| Cartes | Leaflet + react-leaflet | chargé en chunk séparé `map` |
| Styles | CSS-in-JS inline (`style={{...}}`) partout + `index.css` pour le global | **pas de Tailwind, pas de CSS modules** malgré des demandes passées mentionnant Tailwind/shadcn — le projet n'utilise ni l'un ni l'autre en pratique |

## Démarrage local

```bash
# Backend
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver        # OU pour tester l'ASGI réel: daphne -b 0.0.0.0 -p 8000 rzi_camp.asgi:application

# Frontend
cd frontend
npm install
npm run dev
```

## Déploiement

- **Backend** : Render Web Service, `Procfile` → `daphne -b 0.0.0.0 -p $PORT rzi_camp.asgi:application`. Le `release:` phase lance `migrate` puis `seed_db` (tolérant aux erreurs, ne bloque jamais le déploiement).
- **Frontend** : Render Static Site, build = `vite build`, rootDir = `frontend`.
- **Après tout déploiement touchant le schéma DB** : aller sur `/api/setup-db/` (GET) pour exécuter les `ALTER TABLE` manuels — voir section "Pièges connus" ci-dessous.

## Règles non négociables avant de pousser du code

1. **Toujours valider le build avant de push.** `cd frontend && rm -rf dist/ && npm run build`. Zéro tolérance pour une erreur esbuild. Un warning n'est pas bloquant mais doit être lu.
2. **Toute nouvelle page = lazy-loaded.** Jamais `import X from './pages/X'` en haut de `App.jsx`. Toujours `const X = lazy(() => import('./pages/X'))` + wrapper `<Suspense>` autour de la route. Un import statique fait gonfler le bundle principal et ralentit le premier chargement pour tout le monde, même ceux qui ne visitent jamais cette page. (C'était la cause #1 de la lenteur signalée — voir Journal d'erreurs.)
3. **Jamais de composant `lazy()` rendu sans `<Suspense>` parent.** React lève une erreur non catchée → page blanche totale, pas juste sur le composant concerné. Si une page est rendue via une fonction intermédiaire (ex: `RoleHome()`), vérifier que le `<Suspense>` est bien à l'intérieur de cette fonction, pas seulement dans la route.
4. **Toujours déclarer un `useState` avant de l'utiliser dans le JSX.** Un état référencé sans déclaration ne plante pas à la compilation (JS le tolère comme variable globale undefined côté lecture du JSX généré), mais plante au runtime → page blanche silencieuse.
5. **Un seul attribut par nom sur un élément JSX.** `<div style={{...}} onClick={...} style={{...}}>` compile parfois mais le comportement runtime est imprévisible. Toujours fusionner.
6. **CORS ne fonctionne PAS automatiquement avec Daphne/ASGI.** `django-cors-headers` est fait pour WSGI. Le projet a un middleware CORS maison dans `backend/rzi_camp/asgi.py` (classe `CORSMiddleware`) qui injecte les headers sur **toutes** les réponses, y compris les 500. Si une erreur CORS apparaît dans la console malgré `CORS_ALLOW_ALL_ORIGINS = True` dans `settings.py`, le problème n'est presque jamais dans `settings.py` — il est dans `asgi.py` ou dans une exception non catchée qui empêche le middleware de s'exécuter.
7. **Toute vue avec `@api_view` doit avoir le décorateur collé directement à la fonction, sans ligne vide entre les deux.** Une ligne vide entre `@api_view(...)` et `def ma_vue(...)` fait que le décorateur ne s'applique à rien — `request.data` n'existe alors plus (c'est un `HttpRequest` Django brut, pas un `Request` DRF) → `AttributeError` → 500 silencieux. C'est arrivé une fois sur `custom_login`, cherché pendant plusieurs tours de conversation avant d'être trouvé.

## Pièges connus (lire avant de "corriger" quelque chose qui semble déjà correct)

- ~~Champs `Voyage` ajoutés en session mais pas confirmés dans `models.py`~~ — **résolu (22/10)** : `rotation_id`, `vehicule`, `nb_places_total`, `heure_depart`, `point_rdv`, `type_voyage`, `notes_admin` sont bien déclarés dans `models.py` avec migrations propres (`0002`, `0003`), pas de dépendance à `/api/setup-db/` pour ces colonnes. `makemigrations --check --dry-run` confirme : aucune dérive. Il suffit que le déploiement applique les migrations (automatique au démarrage du backend) pour qu'elles existent en base.
- **Le stock de `ArticleBoutique` se touche en SQL brut**, pas via `instance.save()` — `ConsommationBoutiqueViewSet.create()` (vente) et `ArticleBoutiqueViewSet.ajuster_stock` (correction manuelle admin/gérant) dans `backend/restauration/views.py`, tous les deux `UPDATE ... stock = ...` atomique côté base. **Résolu (22/10)** : un troisième chemin ORM (`ArticleBoutiqueViewSet.stock_update`, `article.stock -= x; article.save()`) coexistait déjà en silence — risque réel de perte de mise à jour sous concurrence (vente + correction manuelle simultanées). Il n'était appelé par aucune route frontend (mort) : supprimé. Ne pas réintroduire un chemin ORM sur `stock` sans passer par `F('stock')` pour rester atomique comme le SQL brut existant.
- **Deux notions de rôle coexistent** : `Profile.role` (5 valeurs : admin/agent/restauration/technicien/menage) et `Personnel.profil` (10 valeurs, plus fin). Le frontend lit l'un ou l'autre selon l'écran. Ne pas assumer qu'un seul champ fait foi.
- ~~Fichiers dead code supprimés en session~~ — **résolu, vérifié (22/10)** : `RotationCommandCenter.jsx`, `RotationsPage.jsx`, `RapportPage.jsx` ne sont plus présents ni référencés nulle part dans `frontend/src`.
- ~~`InductionRecord` vs "Induction Camp" : même modèle backend ?~~ — **résolu** : deux modèles bien distincts existent déjà. `InductionRecord` (QHSE, `/api/induction-records/`) pour le suivi formel (documents, formation, médical, badge) ; `InductionCampRecord` (`/api/induction-camp/`, `residences/models.py`) pour la fin du parcours immersif (bienvenue/règles/quiz/signature), avec son propre modèle d'exemption `InductionCampExemption` et de config `InductionCampConfig`. `InductionCamp.jsx` n'appelle plus `/api/induction-records/`. Rien à corriger ici.

## Conventions de code observées (à respecter pour la cohérence)

- Couleurs en dur dans le JSX (`#1e3a8a`, `#0f172a`...) plutôt que variables CSS partout — c'est l'état actuel, pas forcément l'idéal, mais rester cohérent avec l'existant plutôt que de mélanger deux systèmes dans le même fichier.
- Devise toujours en FCFA, jamais de décimales (`DecimalField(decimal_places=0)`).
- Les dates de l'API sont en `YYYY-MM-DD` (DateField) ou ISO 8601 complet (DateTimeField) — toujours utiliser `toLocaleDateString('fr-FR', ...)` côté frontend pour l'affichage.
- Les modals suivent un pattern constant : `position:fixed, inset:0, background:rgba(15,23,42,.6), backdropFilter:blur(4px)` pour l'overlay, contenu blanc `borderRadius:16`.
- Le Mission Control / Command Center utilise une palette distincte volontairement sombre (`#060d1f`, `#0b1628`, accent `#60a5fa`) — ne pas la faire fuiter vers les modules utilitaires (Maintenance, Personnel...) qui doivent rester clairs et fonctionnels.

## Avant de dire "c'est corrigé"

Toujours, sans exception :
1. Lire le fichier exact depuis GitHub (pas se fier à un résumé de conversation précédente, le code peut avoir changé).
2. Faire la modification.
3. Synchroniser en local et lancer `npm run build` avec `rm -rf dist/` avant.
4. Vérifier qu'`index.html` pointe sur le bon hash de bundle si le doute existe sur un cache.
5. Pour les routes : vérifier qu'un nouveau composant lazy a son `<Suspense>`.

Voir aussi `JOURNAL-ERREURS.md` pour l'historique détaillé de ce qui a cassé et pourquoi — beaucoup de bugs rencontrés sont des variations du même piège (Suspense manquant, décorateur mal placé, état non déclaré).
