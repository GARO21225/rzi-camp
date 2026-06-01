# RZI CAMP 2.0 — Prototype Interactif (Concept V2)

> Refonte UX/UI complète du frontend RZI CAMP. **Non-breaking** : ce dossier est un livrable de design, autonome, à ouvrir en local.

---

## 🚀 Lancer le prototype

```bash
# Option 1 : ouvrir directement
open frontend/concept-v2/index.html        # macOS
xdg-open frontend/concept-v2/index.html    # Linux
start frontend/concept-v2/index.html       # Windows

# Option 2 : servir (recommandé pour activer caméra / géoloc)
cd frontend/concept-v2
python3 -m http.server 8080
# Puis http://localhost:8080
```

---

## ✨ Ce qui est dans le prototype

**13 écrans navigables** via la sidebar :

1. **Tableau de bord** — KPIs animés, jumeau numérique mini, activité temps réel, insights IA
2. **Jumeau Numérique** — 204 bâtiments interactifs, sélection, heatmap 24h × 7j
3. **Résidences** — table 204 bâtiments avec statuts
4. **Maintenance** — Kanban 4 colonnes (nouveau / en cours / vérification / résolu)
5. **Restauration** — Scanner QR animé, services du jour, alertes anti-fraude
6. **QR Anti-Fraude** — démo du QR rotatif + explication du mécanisme
7. **Copilote IA** — conversationnel multi-tour avec actions exécutables
8. **Analytics** — 4 KPIs + 4 charts (occupation, incidents, énergie)
9. **Personnel** — table employés
10. **Événements** — cards événements à venir
11. **Induction** — workflow 8 étapes visuel
12. **Audit Trail** — registre immuable avec hash chain
13. **Voyages** — vols en cours / arrivés

**Fonctionnalités globales** :
- 🌗 **Dark / Light mode** (bouton dans la topbar)
- 🌍 **Multi-langue FR/EN/RU** (toggle dans la topbar)
- 🔔 **Centre de notifications** (cloche en haut à droite)
- 🤖 **FAB Copilote IA** flottant (en bas à droite)
- 🎤 **Bouton micro** (placeholder commande vocale)
- ⌨️ **Raccourci ⌘K** pour la recherche
- 📊 **6 graphiques** Chart.js
- 🗺️ **204 bâtiments** simulés sur le jumeau
- 🎨 **Animations live** : feed activité auto-refresh toutes les 12s

---

## 🔗 Lien avec le code de prod

| Concept v2 (ce prototype) | Code prod (`frontend/src/`) |
|---|---|
| Tokens cuivre/émeraude | `design-system/v2/tokens.css` |
| Layout sidebar + topbar | `components/Layout.jsx` |
| Dashboard | `pages/Dashboard.jsx` |
| Jumeau Numérique | `pages/MapPage.jsx` (à enrichir) |
| Maintenance Kanban | `pages/Maintenance.jsx` |
| QR Scanner | `pages/Restauration.jsx` |
| Copilote IA | `pages/AssistantIA.jsx` (déjà existant) |
| Audit | `pages/AuditPage.jsx` |

**Roadmap migration** : voir `frontend/design-system/v2/README.md` § Roadmap.

---

## 💡 Innovations clés intégrées

1. **Jumeau Numérique** du camp (vue spatiale interactive 2D)
2. **Copilote IA conversationnel** avec actions exécutables
3. **Maintenance prédictive** (score ML sur signaux concordants)
4. **QR rotatif HMAC-SHA256** anti-fraude
5. **Heatmap occupation** 24h × 7j
6. **Audit trail immuable** hash-chain
7. **Centre de notifications** unifié
8. **Workflow Induction** 8 étapes visuel
9. **Dark mode + multi-langues** (FR/EN/RU)
10. **Commande vocale** (placeholder UX)

---

## 🛠️ Stack technique du prototype

| Couche | Techno |
|---|---|
| Layout | Tailwind CSS (CDN) |
| Charts | Chart.js 4 |
| Map | Leaflet (chargée, prête) |
| Icons | Lucide (inline SVG) |
| Fonts | Outfit + DM Serif Display + JetBrains Mono |
| JS | Vanilla ES2020 |

Zéro build, zéro `npm install`. Tout est self-contained dans le `index.html`.

---

**Auteur** · Mavis · 2026-06-01
