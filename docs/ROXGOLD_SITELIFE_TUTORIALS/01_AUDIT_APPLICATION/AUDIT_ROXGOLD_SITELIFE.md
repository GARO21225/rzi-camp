# Audit fonctionnel de ROXGOLD SITELIFE (phase 1)

> **Méthode.** Ce document a été établi en lisant le code source de la branche `main` (novembre 2026) :
> les routes et la garde d'accès (`frontend/src/App.jsx`, `components/Layout.jsx`), les menus par rôle
> (`constants/roleNav.js`), les 39 pages de `frontend/src/pages/`, les appels API de chaque page,
> ainsi que les modèles, vues et URL des 7 applications Django (`accounts`, `residences`, `maintenance`,
> `restauration`, `voyages`, `evenements`, `induction`).
> **Limite.** Rien n'a été exécuté contre la production. Le statut « opérationnel » veut dire qu'une page
> routée et présente dans un menu appelle une API backend réelle qui persiste les données. Il ne garantit
> pas que l'écran est utilisé sur le terrain. Chaque tutoriel sera confirmé par des captures réelles
> avant production (phase 5).

Légende des statuts :

| Code | Signification |
|---|---|
| ✅ **Opérationnel** | Écran accessible depuis un menu, branché à l'API, données persistées en base. |
| 🟡 **Partiel** | Fonctionne, mais une partie dépend d'un réglage externe ou n'est pas persistée côté serveur. |
| 🔧 **En développement / non exposé** | Le code existe, mais l'écran n'apparaît dans aucun menu (accessible seulement en tapant l'URL, ou réservé à un écran secondaire). |
| ⛔ **Non disponible** | Code sans route, sans écran ou sans branchement : à ne jamais montrer en vidéo. |

---

## 1. Architecture générale

| Élément | Constat dans le code |
|---|---|
| Nom affiché | `Roxgold SiteLife` (`capacitor.config.ts`, identifiant `com.roxgold.rzicamp`). Le nom de l'application est aussi paramétrable (`Paramétrage > Apparence`, clé `nom_application`). |
| Web | SPA React/Vite, 39 pages, toutes chargées à la demande. |
| Mobile | La même application est : (1) installable comme PWA (bouton d'installation, service worker `sw.js`) ; (2) compilée en app native Android/iOS via Capacitor. Sur mobile, une **barre d'onglets en bas** (`BottomTabBar`) remplace le menu latéral. |
| Temps réel | Cloche de notifications, bandeau d'événements, alertes « live » (sirène) via WebSocket et Web Push. |
| Sécurité de session | Déconnexion automatique après inactivité, avec un avertissement de 60 s et un bouton « Rester ». |
| Hors ligne | Bandeau « hors ligne » et resynchronisation au retour du réseau. La file d'attente hors ligne réelle n'est codée que pour l'induction QHSE. |

---

## 2. Cartographie des profils utilisateurs

Deux notions de rôle coexistent (voir `CLAUDE.md`) :
- `Profile.role` : **c'est lui qui pilote les menus et les droits**.
- `Personnel.profil` : profil métier sur la fiche du personnel.

L'administrateur peut aussi créer des rôles personnalisés et redéfinir le menu de chaque rôle (`Paramétrage > Rôles & Accès`). **Les menus décrits ci-dessous sont donc les menus par défaut.** Chaque vidéo devra être tournée avec un compte de démonstration dont le menu est vérifié.

Règle d'accès (code) : un utilisateur `is_staff`/`is_superuser`, ou de rôle `admin`, est **administrateur** et accède à toutes les pages. Tout autre utilisateur voit **les pages de son métier, plus les pages de résident**. Les pages `Accueil`, `Mon compte`, `Ma conduite`, `Bar`, `Induction QHSE` et `Induction Camp` sont toujours autorisées, chacune filtrée sur la personne connectée.

| Profil (code) | Libellé | Page d'arrivée | Pages métier par défaut (en plus des pages résident) |
|---|---|---|---|
| `admin` | Administrateur | Tableau de bord (`/`) | Toutes les pages, en 7 groupes : Vue principale · Personnel & Conformité · Hébergement & Mobilité · Services aux résidents · Exploitation · Pilotage & Analyse · Système |
| `agent` | Agent / Résident | Accueil personnel (`/accueil`) | — (menu résident seul) |
| `restauration` | Équipe restauration | `/accueil` | Carte, Événements, Restauration (scan et menu), Restaurants & superviseurs |
| `camp_boss` | Camp Boss | `/accueil` | Ceux de la restauration, plus Historique et Analytics |
| `technicien` | Technicien maintenance | `/accueil` | Carte, Événements, Maintenance (+ « Mon tableau de bord »), Induction QHSE (la sienne) |
| `menage` | Équipe ménage | `/accueil` | Carte, Événements, Maintenance (« Signaler ») |
| `boutique` | Gérant Bar & Boutique | `/accueil` | Carte, Événements, Bar & Boutique en mode gestion (caisse, historique, stock) |
| `securite` | Sécurité | `/accueil` | Carte, Événements, Annuaire |
| `medical` | Médical | `/accueil` | Carte, Événements, Annuaire, **gestion de tous les dossiers d'induction QHSE** |
| `hse` | HSE / QHSE | `/accueil` | Carte, Événements, **Induction QHSE (tous les dossiers)**, Maintenance, Équipements EPI |
| `accueil` | Agent d'accueil | `/accueil` | Carte, Événements, Annuaire, Résidences |
| `manager` | Manager / Responsable | `/accueil` | Carte, Événements, Demandes, Rapports, Analytics, Historique |
| *(conducteur)* | Pas un rôle, une affectation | — | `Ma conduite` n'affiche que les convois dont la personne est le conducteur désigné |

**Menu résident par défaut** (tout utilisateur non administrateur) : Mon compte · Carte GIS · Mes demandes · Événements · Voyages · Restauration (mon QR, menu) · Mon bar · Induction Camp · Mon induction QHSE · Signaler un incident · Ma chambre / Plaintes.

**Barrière d'entrée** : tant que l'**Induction Camp** d'un résident hébergé n'est pas signée, l'application le **renvoie de force** sur `/induction-camp`, quelle que soit la page demandée (`Layout.jsx`). C'est le premier contact de tout nouvel arrivant.

---

## 3. Cartographie des modules

```
ROXGOLD SITELIFE
├── Accès & compte ........ Connexion (mot de passe / code OTP) · Mot de passe oublié · Mon compte
├── Accueil ............... Accueil résident (/accueil) · Tableau de bord admin (/) · Salle de contrôle (écran mural)
├── Personnel & Conformité  Personnel · Présences · Induction QHSE · Induction Camp · Équipements EPI · Annuaire
├── Hébergement & Mobilité  Carte GIS · Résidences · Centre de Mobilité · Voyages · Ma conduite · Suivi en direct
├── Services aux résidents  Restauration · Bar & Boutique / Mon bar · Réservations de ressources
├── Exploitation .......... Maintenance · Plaintes & contrôle de chambre · Événements & alertes · Demandes
├── Pilotage .............. Analytics · Rapports · Historique · Audit · Assistant · Diagnostic
└── Système ............... Paramétrage (13 onglets) · Notifications (cloche, push)
```

**Interactions principales entre modules (constatées dans le code) :**

| Flux | Description |
|---|---|
| Demande → Voyage | Une demande de voyage validée crée un `Voyage` lié (`Voyage.demande_origine`), qui apparaît ensuite dans le Centre de Mobilité (« À organiser »). |
| Demande → Résidence | Une demande de réservation est validée avec une résidence attribuée, ou l'admin propose une autre résidence que le demandeur accepte ou refuse. |
| Voyage ↔ Résidence | Un départ sans décision déclenche une alerte « Départ résidence dépassé — décision requise » (règle unique `residences/departs.py`), traitée depuis le tableau de bord (« Il part / Il reste »). |
| Convoi → Présence | Pour un convoi suivi en direct vers le camp, la personne n'est déclarée arrivée qu'à l'arrivée réelle (`arriver`). |
| Plainte → Maintenance | Lors de la qualification, une plainte peut être marquée « Maintenance nécessaire ». |
| Personnel → Restauration / Bar | Le badge QR du personnel sert au scan des repas. Le bon de caisse sert au bar. |
| Induction Camp → Accès | Une induction non signée bloque l'accès au reste de l'application. |
| Tous modules → Notifications | `push.envoyer()` (Web Push + natif) et cloche ; chaque notification ouvre la bonne page. |
| Tous modules → Audit / Historique | Journal d'audit et historisation (personnel, bâtiments, articles, etc.). |

---

## 4. Inventaire des fonctionnalités

### 4.1 Accès & compte

| Fonctionnalité | Écran / point d'entrée | Statut | Détail vérifié |
|---|---|---|---|
| Connexion identifiant + mot de passe | `/login` | ✅ | Vue backend `custom_login` (JWT). |
| Connexion par code à usage unique (OTP) | `/login`, bouton OTP → téléphone → code | 🟡 | Code complet (`auth/otp/demander`, `verifier`). L'envoi dépend du fournisseur SMS / WhatsApp / e-mail configuré dans Paramétrage. |
| Mot de passe oublié | `/login` | 🟡 | `forgot-password` / `reset-password-confirm`. Dépend de l'envoi d'e-mails. |
| Mon compte : informations, changement de mot de passe avec jauge de robustesse | `/mon-compte` | ✅ | `change-password`. |
| Régénérer les identifiants d'un agent (admin) | Personnel → icône | ✅ | `reset-password/<id>`. |
| Déconnexion automatique après inactivité | Global | ✅ | Avertissement à 60 s, bouton « Rester ». |
| Installation de l'application (PWA) / app native | Bouton d'installation | ✅ / 🟡 | La PWA fonctionne. L'app native se compile, mais les notifications push quand l'app est fermée attendent le compte Firebase (voir `CLAUDE.md`). |

### 4.2 Accueil & tableaux de bord

| Fonctionnalité | Écran | Statut | Détail |
|---|---|---|---|
| Accueil résident : salutation, **prochain trajet** avec ligne de route (ville de descente en or), « Au camp prochainement », **Mes demandes**, **Raccourcis** vers les pages du menu | `/accueil` | ✅ | Les données sont affichées tout de suite depuis le cache, puis rafraîchies (réseau lent). |
| Tableau de bord admin : indicateurs (occupation, personnel logé/total, chambres disponibles, maintenance en attente, repas du jour, rotation en cours, stocks critiques, alertes sécurité), **alertes opérationnelles** (SLA détaillé, départs résidence à décider), accès rapides, conformité induction QHSE, carte « Digital Twin », activité récente | `/` | ✅ | Admin seulement. |
| Fenêtre de décision « Il part / Il reste » | `/?departs=1` (depuis l'alerte ou la notification) | ✅ | |
| Salle de contrôle (écran mural plein écran : occupation, résidences libres, déplacements, incidents, EPI) | Bouton du tableau de bord → nouvel onglet `/salle-controle` | ✅ | Admin seulement. Pas d'entrée dans le menu. |

### 4.3 Personnel & conformité

| Fonctionnalité | Écran | Statut | Détail |
|---|---|---|---|
| Fiche personnel (nom, prénom, société, département, matricule, type Roxgold / sous-traitant / visiteur, pays d'origine, téléphones, WhatsApp…) | `/personnel` → « Ajouter un membre du personnel » | ✅ | |
| Recherche et filtres (société, type, profil, statut, induction, centre de mobilité, expatriation) | `/personnel` | ✅ | |
| **Import CSV en masse** + téléchargement d'un modèle (`📋 Template`, `📤 Import CSV`) | `/personnel` | ✅ | Les colonnes sont reconnues en français et en anglais. |
| Badge QR personnel (« Voir le QR code ») | `/personnel` | ✅ | Utilisé pour le scan des repas. |
| Rôle de connexion et profil métier, actions en masse | `/personnel` | ✅ | |
| Déclaration de sous-traitants en masse | API `declarer-soustraitants/` | ✅ | |
| Présences : au camp / en voyage / en congé / absent, taux de présence | `/presences` | ✅ | Calculées à partir des voyages et des chambres. Admin. |
| **Induction QHSE** : dossier en 6 étapes (Accueil & enregistrement · Documents obligatoires · Visite médicale · Formation QHSE · Quiz QHSE · Badge & accès), pièces jointes, constantes médicales (tension, température, tests alcool et drogues), dossier PDF à imprimer | `/induction` | ✅ | Gestion de tous les dossiers : admin, HSE, médical. Les autres profils ne voient que leur propre dossier. File d'attente hors ligne. |
| **Induction Camp** (parcours immersif) : infrastructures du camp · règles de vie (Standard / Important / Critique) · déclaration des appareils énergivores · quiz de validation tiré au sort · engagement et signature · certificat | `/induction-camp` | ✅ | Obligatoire au premier hébergement (redirection forcée). |
| Registre de l'Induction Camp (admin) : terminés / à faire / exemptés, taux de conformité, score moyen au quiz, exemption avec motif, export Excel, aperçu côté participant | `/induction-camp` → « Registre admin » | ✅ | |
| Configuration de l'Induction Camp (camp, infrastructures, règles, questions du quiz) | `Paramétrage > Induction du Camp` | ✅ | |
| Équipements EPI : remise, date d'expiration, état (Bon / Bientôt / Expiré) | `/epi` | ✅ | Admin, HSE. |
| Annuaire du site (présent / inactif) | `/annuaire` | ✅ | Admin, sécurité, médical, accueil. |

### 4.4 Hébergement & mobilité

| Fonctionnalité | Écran | Statut | Détail |
|---|---|---|---|
| **Carte GIS** : résidences colorées par statut, points d'intérêt, chemins de circulation, couches, fonds de carte (OSM / satellite / clair / sombre), recherche, retour au GPS, étages | `/carte` | ✅ | Accessible à tous. |
| Édition de la carte (admin) : ajouter un point d'intérêt, tracer un chemin (voirie, clôture, escalier, passerelle…), import GeoJSON/CSV, export des données | `/carte` | ✅ | |
| **Résidences** : liste et fiche de chaque chambre, statut, affectation d'un occupant (avec confirmation), blocs, renommer, déplacer vers un bloc, chambres partagées (groupe), historique d'occupation, signaler une anomalie, import KML | `/residences` | ✅ | Admin, accueil. |
| **Centre de Mobilité** : 5 espaces. *Vue d'ensemble* · *Planification* (Rotations, À organiser, Calendrier, Gantt) · *Exploitation* (Command, En direct) · *Passagers* (Tous les voyages, Manifest) · *Validations* (demandes à valider) | `/rotations` | ✅ | Admin. |
| Organiser une rotation (convoi) : type de transport, véhicule, chauffeur principal et 2ᵉ chauffeur, itinéraire, point de RDV, heure, **niveau d'alerte sécurité (JMP)**, distance, gestion de la fatigue ; montée et descente par passager ; ajout à une rotation existante | Centre de Mobilité → « Organiser une rotation » | ✅ | |
| Voyage individuel, vol (n° de vol, date, heure), changement de date ou d'itinéraire, export Excel, impression PDF du plan de voyage (JMP) | Centre de Mobilité | ✅ | |
| **Voyages** (vue résident et gestion) : liste / calendrier, création (personnel, origine, destination, dates, montée et descente, billet d'avion en justificatif, coût), valider / refuser, marquer « en voyage » / « retour camp », billet imprimable | `/voyages` | ✅ | Au menu du résident. L'admin y accède par l'URL. |
| **Ma conduite** (chauffeur) : liste des convois à démarrer, autorisation GPS, **🚦 Partir**, position envoyée automatiquement, écran maintenu allumé, ⏸️ Signaler un arrêt, ⬆️ Ramasser des passagers, déposes par arrêt, ▶ Reprendre la route, 🏁 Arrivé à destination, rapport PDF provisoire, données CSV | `/conduite` | ✅ | Limité aux convois dont la personne est le conducteur. |
| **Suivi en direct** côté passager : carte du bus, km restants, heure d'arrivée estimée | `/voyages` → « 📍 Suivre en direct » | ✅ | |
| Historique des trajets GPS des convois | `/historique` → « Trajets de convois (GPS) » | ✅ | |
| Paramétrage des itinéraires modèles (JMP) : étapes, distances, pauses fatigue | `Paramétrage > JMP` | ✅ | |

### 4.5 Services aux résidents

| Fonctionnalité | Écran | Statut | Détail |
|---|---|---|---|
| **Restauration, côté résident** : mon QR repas, menu du jour (petit-déjeuner / déjeuner / dîner, horaires paramétrables) | `/restauration` | ✅ | |
| **Restauration, côté restaurant** : choix du restaurant, scan du QR à la caméra (avec retour sonore), dernier scan, historique (aujourd'hui / hier), mini-sondage de satisfaction après le scan | `/restauration` → « 📷 Scan & menu » | ✅ | Admin, restauration, camp boss. |
| Gestion du menu : ajout de plats (type, repas, photo), modification, déplacement par glisser-déposer, modification en masse | `/restauration` | ✅ | |
| Tableau de bord restauration : repas servis, personnes distinctes, couverture, pic, moyenne par jour, satisfaction, export CSV, PDF, **envoi par e-mail** | `/restauration` → « 📊 Tableau de bord » | ✅ (l'e-mail est 🟡) | |
| Restaurants & superviseurs : créer un restaurant, affecter des superviseurs, **régénérer les QR de tous les badges** | `/restaurants` | ✅ | |
| Questions de l'avis restauration | `Paramétrage > Questions Avis Restauration` | ✅ | |
| **Bar & Boutique, gestion** : caisse (panier, paiement en espèces, bon de caisse, crédit, Orange Money / Wave / MTN / Moov), historique des ventes, gestion du stock (entrées et sorties avec motif), catalogue avec catégories et images, analyses (7 j / 30 j / 3 mois / année), **bons de caisse** (crédit et remboursement) | `/boutique` | ✅ | Le mobile money est **un mode de paiement enregistré** (le numéro de transaction est saisi). Aucun paiement n'est débité depuis l'application. Stock géré par mise à jour atomique. |
| **Mon bar**, côté résident : la carte (prix, disponibilité), son bon de caisse, ses consommations | `/boutique` (résident) | ✅ | Filtré côté API. |
| Réservations de ressources : véhicules, salles, engins, matériels, équipements HSE ; créneaux, détection de conflits, QR véhicule | `/reservations` | 🟡 | **Seule la flotte de véhicules est enregistrée sur le serveur. Les réservations elles-mêmes et le catalogue des salles et matériels sont stockés uniquement dans le navigateur (`localStorage`)** : invisibles pour les autres utilisateurs et perdus si l'on change d'appareil. À ne pas filmer comme un processus partagé avant correction. |

### 4.6 Exploitation

| Fonctionnalité | Écran | Statut | Détail |
|---|---|---|---|
| **Déclarer un incident de maintenance** (titre, description, catégorie, priorité, résidence/bloc, photo) | `/maintenance` → « Déclarer un incident » | ✅ | Ouvert au résident (« Signaler »). |
| Suivi des incidents : Déclaré → Assigné → En cours → Résolu → Clôturé (ou Annulé), commentaires, SLA dépassé | `/maintenance` | ✅ | |
| Assignation à un technicien, onglet « Assignations », **actions en masse** (assigner, commencer, résoudre, clôturer, commenter, annuler) | `/maintenance` | ✅ | Admin. |
| **Mon tableau de bord technicien** | `/maintenance` → onglet | ✅ | Technicien. |
| Statistiques (par catégorie, statut, priorité, évolution mensuelle, résidences les plus touchées, charge par technicien), filtres par dates, **rapport PDF**, import CSV | `/maintenance` | ✅ | |
| **Plaintes / Ma chambre** : déposer une plainte (catégorie, sous-catégorie, description, photo) ; la chambre est déduite automatiquement de l'hébergement réel | `/plaintes` → « Déposer une plainte » | ✅ | |
| Traitement des plaintes : Qualifier (priorité, « Maintenance nécessaire ») → Affecter → ▶ Prendre en charge → En attente (motif) → ✅ Résolu (photo après intervention) → **confirmation par l'occupant (« ✅ Oui, résolu » / « ❌ Persiste »)** → clôture ou réouverture | `/plaintes` | ✅ | Frise de suivi. |
| **Contrôle de chambre** (grille : propreté, fournitures, équipements, état général) | `/plaintes` → « Contrôle de chambre » | ✅ | |
| Catégories de plaintes paramétrables | `Paramétrage > Gestion des plaintes` | ✅ | |
| **Événements** : ➕ créer (type, participation obligatoire, groupe de diffusion) et notifier, ▶ démarrer, ⏹ terminer, annuler ; vues À venir / En cours / Tout | `/evenements` | ✅ | Tout le monde consulte. L'admin crée. |
| QR de participation à un événement, avec **préférence de boisson** (alcool / sucrerie / les deux) | `/evenements` | ✅ | |
| **Déclencher une alerte** sur le camp (Info / Attention / Urgent / OK), sirène, test de la sirène sur l'appareil | `/evenements` → « Déclencher une alerte » | ✅ | |
| Groupes de diffusion | `Paramétrage > Groupes de diffusion` | ✅ | |
| **Demandes** : le résident « Réserver résidence » / « Planifier voyage » (motif, itinéraire, je monte à / je descends à, transport) ; l'admin Valide / Rejette / **Propose** une alternative ; le résident Accepte / Refuse / Annule | `/demandes` | ✅ | Les onglets Induction, Maintenance et Plainte de cette page regroupent en lecture les demandes des autres modules. |
| Notifications : cloche (avec « Tout lire »), push navigateur, bandeau d'événement | Global | ✅ | Le push natif avec l'app fermée est 🟡 (Firebase). |

### 4.7 Pilotage & analyse

| Fonctionnalité | Écran | Statut | Détail |
|---|---|---|---|
| **Analytics** : personnes enregistrées, taux d'occupation, chambres libres, incidents ouverts, voyages en cours ; graphiques (chambres occupées par nuit, départs et retours des 14 prochains jours, créés vs résolus, sociétés, types de personnel, occupation par bloc…) | `/analytics` | ✅ | Admin, camp boss, manager. |
| **Rapports** : rapport opérationnel global (synthèse, camp, résidences, mobilité, boutique, maintenance), imprimer / PDF, **envoi par e-mail** | `/rapports` | ✅ (l'e-mail est 🟡) | PDF produit par l'impression du navigateur ou du téléphone. |
| **Rapports automatiques par e-mail** (fréquence, jour) | `Paramétrage > Rapports par email` | 🟡 | Dépend du fournisseur d'e-mail configuré. |
| **Historique** en 11 onglets : occupation des chambres, parcours d'un résident (« Où a dormi cette personne ? »), voyages du personnel, tous les voyages, trajets GPS, restaurant, maintenance clôturée, plaintes, induction QHSE, événements passés, audit (archive) | `/historique` | ✅ | Onglets filtrés selon le rôle. Impression par fiche. |
| **Audit** : journal du jour (connexions, modifications) | `/audit` | ✅ | Admin. |
| **Assistant** : questions en langage courant sur la situation du camp (occupation, voyages, incidents, plaintes, événements, inductions) | `/assistant` | ✅ avec réserve | **Ce n'est pas une IA générative** : c'est un moteur de règles par mots-clés qui répond avec les chiffres réels et renvoie vers la bonne page (commentaire explicite dans `AssistantIA.jsx`). Le menu l'appelle « 🤖 Assistant IA ». Une vidéo devra le présenter honnêtement. |
| Diagnostic système (base, migrations, cache, utilisateurs, mode DEBUG) | `/status` | ✅ | Usage technique, pas de tutoriel. |

### 4.8 Système : Paramétrage

13 onglets, tous branchés à l'API, admin seulement : Général & SLA · Rôles & Accès (rôles personnalisés et menus par rôle) · Départements & sous-traitants · Motif / Objet (mobilité) · Rapports par email · Groupes de diffusion · Apparence (couleurs, police, fonds, logo) · Badges QR du personnel · JMP (itinéraires) · Gestion des plaintes · Induction du Camp · Catalogue Boutique · Questions Avis Restauration. On y trouve aussi les fournisseurs SMS / WhatsApp / e-mail et les horaires des repas et du bar. ✅

### 4.9 En développement / non exposé (🔧)

| Élément | Constat | Recommandation vidéo |
|---|---|---|
| `Centre opérationnel` (`/operations`) | Route active, écran d'indicateurs branché à l'API, mais aucun menu n'y mène. Seul `Sidebar.jsx` y pointe, et ce fichier n'est plus utilisé. | Ne pas tutorialiser. |
| `Workflows` (`/workflows`) | Même situation. | Ne pas tutorialiser. |
| `Caisse POS` (`/boutique-pos`) | Écran de caisse simplifié, branché à l'API, sans entrée de menu. La caisse officielle est l'onglet Caisse de `/boutique`. | Ne pas tutorialiser. |
| `Paramétrage induction` (`/induction-admin`) | Route directe sans menu. Le même écran est intégré à `Paramétrage > Induction du Camp`. | Passer par Paramétrage. |
| Mode hors ligne généralisé | File d'attente réelle seulement pour l'induction QHSE. | Ne pas promettre de mode hors ligne global. |

### 4.10 Non disponible (⛔) : à ne jamais montrer

| Élément | Constat |
|---|---|
| `QrAntiFraude.jsx` | Fichier présent, aucune route ne l'affiche. |
| Application Django `induction` (`/api/induction/` : workflow, scan QR de site, export) | Backend présent, aucun écran frontend ne l'appelle. |
| `dashboard-next/` | Prototype Next.js/Tailwind séparé, non déployé (absent de `render.yaml`). |
| `Sidebar.jsx` | Ancien menu, plus importé nulle part. |
| Recommandations « IA » prédictives des rotations | Heuristiques côté navigateur, pas de calcul prédictif réel (`docs/04-FEATURE-BACKLOG.md`). |

---

## 5. Disponibilité ordinateur / mobile

| Usage | Ordinateur | Mobile (PWA / app) | Remarque |
|---|---|---|---|
| Accueil résident, demandes, voyages, suivi en direct, mon QR repas, mon bar, plaintes, signaler, induction camp | ✅ | ✅ **(usage principal)** | Barre d'onglets en bas, écrans optimisés pour le plein soleil. |
| Ma conduite (GPS du chauffeur) | — | ✅ **mobile uniquement en pratique** | Exige le GPS et un écran maintenu allumé. |
| Scan des repas (caméra) | ✅ (webcam) | ✅ | |
| Caisse du bar | ✅ | ✅ | |
| Centre de Mobilité, Paramétrage, Analytics, Rapports, Historique, import CSV/KML/GeoJSON | ✅ **(usage principal)** | Possible, mais dense | À filmer sur ordinateur. |
| Impression / PDF | Fenêtre d'impression du navigateur | Fenêtre d'impression native du téléphone (plugin `Impression`) | |
| Salle de contrôle | ✅ écran mural | — | |

---

## 6. Points d'attention pour la production vidéo

1. **Données de démonstration** : filmer sur un environnement de démo (local ou base séparée) alimenté par des données fictives clairement identifiées (ex. société « DEMO SARL », noms fictifs). Ne jamais filmer la production : noms réels, téléphones, constantes médicales, tests alcool et drogues, positions GPS des convois et carte du site sont des données sensibles.
2. **Carte et plan du camp** : la carte GIS affiche le plan réel du site minier. Prévoir un floutage ou un fond de carte neutre, à faire valider par la sécurité du site.
3. **Menus par rôle paramétrables** : avant chaque tournage, capturer le menu du compte de démo pour qu'il corresponde à ce que la vidéo annonce.
4. **Nom « Assistant IA »** : décrire l'écran comme un assistant de questions sur les chiffres du camp, sans parler d'intelligence artificielle générative.
5. **Mobile money** : dire « enregistrer un paiement Orange Money », pas « payer via l'application ».
6. **Réservations de ressources** : en attente d'une persistance serveur avant tout tutoriel.
