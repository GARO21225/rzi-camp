# RZI CAMP — Concept V2 (Refonte UX/UI + Innovations)

> **Vision** · Transformer RZI CAMP d'un ERP fonctionnel "corporate 2020" en plateforme **SaaS premium** adaptée au contexte minier 24/7, multi-pays, multi-langues.

---

## 🎯 Pourquoi cette refonte

L'existant (`v1`) est solide techniquement mais souffre de 3 lacunes :

| Lacune v1 | Impact | Solution v2 |
|---|---|---|
| Design "corporate 2019" (Inter, navy/gold plat) | Adoption lente côté terrain | **Outfit + cuivre/émeraude** + animations partout |
| Pas de vue spatiale du camp | Manager navigue 10 menus pour comprendre l'état | **Jumeau Numérique** = situation en 2 secondes |
| IA = chatbot Q&A passif | Ne fait rien, ne décide rien | **Copilote IA actionnable** : crée des interventions, commande des pièces, notifie les gens |

---

## 📦 Livrables V2 dans ce repo

```
rzi-camp-main/
├── CONCEPT_V2.md                          ← ce fichier
├── frontend/
│   ├── concept-v2/                        ← prototype interactif autonome
│   │   ├── index.html                     ← 13 écrans navigables
│   │   └── README.md
│   └── design-system/
│       ├── colors_and_type.css            ← v1 (préservé)
│       └── v2/                            ← v2 (nouveau, opt-in)
│           ├── tokens.css                 ← tous les CSS vars + composants
│           └── README.md                  ← guide de migration
└── (backend/ inchangé)
```

Le code de production (React + Django) **n'est pas touché** : la migration se fait progressivement via les nouveaux tokens CSS.

---

## 🎨 Le nouveau design system (v2)

### Palette (extraite du logo Roxgold)
- **Primaire (Bleu marine)** : `#003b7a` — couleur dominante du logo, utilisée pour tous les CTA et l'identité
- **Accent (Jaune logo)** : `#ffcd00` — filet du haut du logo, utilisé pour les highlights et l'IA
- **Accent secondaire (Orange logo)** : `#e87722` — accent tertiaire, transitions dégradées
- **Succès (vert sémantique)** : `#16a34a` — indépendant du logo
- **Warning** : ambre `#f59e0b`
- **Alerte** : rouge `#dc2626`
- **Fond** : `#f5f8fc` (bleuté très clair, plus chaud que le slate v1)
- **Texte** : `#001e42` (bleu marine foncé)
- **Dark mode** : `#001327` (deep navy Roxgold)

### Typographie
- **Sans** : **Outfit** (300→800) — remplace Inter, beaucoup plus moderne
- **Display** : **DM Serif Display** — pour les H1 hero / chiffres importants
- **Mono** : **JetBrains Mono** — pour les IDs, hash, tokens techniques

### Composants clés
- `.card` avec hover lift, ombres diffuses bleutées
- `.btn` avec 6 variants : `primary` (bleu), `gold` (jaune), `ghost`, `soft`, `ok` (vert), `dark` (bleu marine)
- `.badge` sémantiques (ok, warn, alert, info, copper/or, ink)
- `.kpi` avec sparkline SVG inline + delta coloré
- `.dot` avec pulse animation pour le live status
- **Filet jaune Roxgold** en haut de la sidebar (identique au logo)
- Dark mode auto-adapté sur tous les composants

---

## 🚀 12 innovations intégrées dans le prototype

1. **Jumeau Numérique** — Vue spatiale des 204 bâtiments, statut temps réel, sélection, ETA interventions
2. **Copilote IA conversationnel** — Actions exécutables, raisonnement multi-sources, 3 scénarios
3. **Maintenance prédictive ML** — Score 87% basé sur 3 capteurs, ROI explicite
4. **QR rotatif HMAC-SHA256** — Anti-fraude nouvelle génération, validation hors-ligne
5. **Heatmap occupation 24h** — Visualisation densité bâtiments × heures
6. **Audit trail immuable** — Hash-chain visible, conformité ISO 27001
7. **Centre de notifications** — Modal contextuel unifié
8. **Workflow Induction 8 étapes** — Visuel avec progression
9. **Dark mode** complet — Tous les charts s'adaptent
10. **Multi-langues FR/EN/RU** — Toggle dans la topbar (préparé i18next)
11. **Commande vocale** — Placeholder UX mains-libres
12. **Live activity feed** — Auto-refresh toutes les 12s

---

## 📊 Comparaison v1 vs v2

| Aspect | v1 (existant) | v2 (concept) |
|---|---|---|
| Font | Inter | Outfit + DM Serif Display |
| Couleurs | Navy `#1e3a8a` + Gold `#f0a500` | **Bleu marine Roxgold `#003b7a`** + **Jaune logo `#ffcd00`** + **Orange `#e87722`** |
| Animations | Minimales (fadeIn, slideIn basiques) | Multiples (hover-lift, scale, pulse, ping) |
| Sidebar | Bleue plate, basique | **Filet jaune Roxgold en haut** + gradient bleu + badges notif |
| KPI | Cartes plates, valeurs statiques | Sparklines SVG, compteurs animés, deltas |
| Cartes | 4 coins arrondis 10px | 16px + ombres diffuses bleutées + hover lift |
| Dark mode | ❌ | ✅ Complet (deep navy Roxgold) |
| Mobile | Basique | Grids responsive adaptatifs |
| Vue spatiale | Leaflet 2D basique | Digital Twin riche + heatmap |
| IA | Chat passif | Copilote actionnable (logo jaune) |
| Maintenance | Liste | Kanban 4 colonnes drag-drop |
| QR | Scanner basique | Scanner + démo QR rotatif + audit |

---

## 🛣️ Roadmap migration v1 → v2

**Effort total estimé** : 6-8 jours pour un développeur.

| Étape | Effort | Risque |
|---|---|---|
| 1. Importer fonts + tokens v2 | 30 min | Aucun (additif) |
| 2. Migrer Login | 1h | Faible |
| 3. Migrer Layout + Sidebar | 2h | Faible |
| 4. Migrer Dashboard | 3h | Moyen (composant dense) |
| 5. Migrer Map → Digital Twin v2 | 1j | Élevé (refonte Map) |
| 6. Migrer Maintenance Kanban | 4h | Moyen |
| 7. Activer dark mode | 1h | Faible |
| 8. i18n FR/EN/RU | 1j | Moyen |
| 9. Brancher Copilote IA sur API | 2-3j | Élevé (backend) |
| **Total** | **~8j** | |

---

## 🎬 Démonstration

Le prototype est consultable immédiatement :

```bash
cd frontend/concept-v2
open index.html
# ou servir : python3 -m http.server 8080
```

**Parcours suggéré** (5 min) :
1. Dashboard → jumeau mini + KPIs animés + insights IA
2. Toggle 🌗 dark mode
3. Copilote IA → "résumé" / "pompe P-203" / "alertes"
4. Jumeau Numérique → cliquer un bâtiment rouge (alerte)
5. Maintenance → Kanban 4 colonnes
6. QR → animation scanner + démo du QR rotatif

---

**Auteur** · Mavis · 2026-06-01
**Source** · Analyse de `rzi-camp-main` v1 (Django + React/Vite)
**Statut** · Concept validé · prêt pour migration progressive
