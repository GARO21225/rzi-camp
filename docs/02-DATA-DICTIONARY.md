# Data Dictionary — RZI Camp ERP

Source de vérité : `backend/*/models.py` (Django 4.2, PostgreSQL). Tous les noms de champs ci-dessous sont exacts — copiables tels quels dans une requête SQL ou un serializer.

---

## App `residences`

### `Personnel`
Table : `residences_personnel`

| Champ | Type | Détail |
|---|---|---|
| `nom`, `prenom` | CharField(100) | — |
| `societe` | CharField(100) | — |
| `numero` | CharField(20) | matricule, optionnel |
| `type_personnel` | CharField, choices | `roxgold` / `sous_traitant` / `visiteur` |
| `profil` | CharField, choices | `admin`, `agent`, `technicien`, `restaurant`, `boutique`, `securite`, `medical`, `hse`, `accueil`, `manager` |
| `email` | EmailField | optionnel |
| `qr_code_data`, `qr_code_string` | Text/CharField | badge QR |
| `actif` | BooleanField | default `True` |
| `user` | OneToOneField → `auth.User` | nullable — lien compte de connexion |
| `login_genere`, `password_genere` | CharField | identifiants auto-générés à la création |
| `date_creation` | DateTimeField | auto |

Historisé via `simple_history` (table `residences_historicalpersonnel`).

### `Batiment` (= résidence/chambre)
Table : `residences_batiment`

| Champ | Type | Détail |
|---|---|---|
| `residence` | CharField(20), **unique** | ex: `A-204` |
| `bloc` | CharField(30) | ex: `Bloc A` |
| `statut` | choices | `Libre` / `Occupé` / `Réservé` / `Maintenance` |
| `personnel` | FK → Personnel | nullable, occupant actuel |
| `occupant`, `societe` | CharField | dénormalisé pour affichage rapide |
| `date_arrivee`, `date_depart` | DateField | nullable |
| `latitude`, `longitude` | FloatField | coordonnées GPS pour la carte GIS |
| `geojson_geometry` | JSONField | géométrie importée (polygone/point) |

Historisé via `simple_history`.

### `OccupationHistory`
Table : `residences_occupationhistory` — trace chaque passage d'un occupant dans un bâtiment.

| Champ | Type |
|---|---|
| `batiment` | FK → Batiment |
| `personnel` | FK → Personnel, nullable |
| `occupant_nom`, `societe` | CharField |
| `date_arrivee` | DateField |
| `date_depart` | DateField, nullable |
| `motif_depart` | CharField(200) |
| `enregistre_par` | FK → User |

### `Demande`
Table : `residences_demande` — demandes de logement/services soumises par le personnel.

| Champ | Type | Détail |
|---|---|---|
| `type_demande` | choices | (voir `TYPE_CHOICES` dans le modèle) |
| `statut` | choices, default `en_attente` | — |
| `demandeur` | FK → User | — |
| `traite_par` | FK → User, nullable | admin qui a traité |
| `donnees` | JSONField | payload flexible selon type |
| `residence_souhaitee`, `residence_attribuee` | CharField(20) | — |
| `message_demandeur`, `commentaire_admin` | TextField | — |
| `proposition_admin` | JSONField | contre-proposition de l'admin |
| `date_debut_souhaitee`, `date_fin_souhaitee` | DateField | — |
| `date_creation`, `date_traitement`, `date_reponse` | DateTimeField | — |

### `InductionRecord` (Induction QHSE — module historique)
Table : `residences_inductionrecord`

| Champ | Type | Détail |
|---|---|---|
| `personnel` | OneToOneField → Personnel | — |
| `statut` | choices | `en_cours` / `valide` / `refuse` / `expire` |
| `etapes_data`, `form_data`, `docs_data`, `medical_data` | JSONField | données saisies par étape |
| `quiz_score` | PositiveIntegerField, nullable | — |
| `quiz_tentatives` | PositiveIntegerField | — |
| `date_debut`, `date_fin` | DateTimeField | — |
| `badge_emis` | BooleanField | — |
| `badge_date`, `badge_expire` | DateTimeField / DateField | — |

Méthode `progression_pct()` calcule le % sur 6 étapes (`accueil`, `documents`, `formation`, `quiz`, `medical`, `badge`).

> ⚠️ Le module **Induction Camp** (bienvenue, infrastructures, règles, appareils énergivores, signature) utilise l'endpoint `/api/induction-records/` côté frontend mais n'a pas son propre modèle dédié distinct — à vérifier/aligner si un modèle séparé est souhaité (voir Feature Backlog).

---

## App `voyages`

### `Voyage`
Table : `voyages_voyage`

| Champ | Type | Détail |
|---|---|---|
| `personnel` | FK → Personnel, CASCADE | — |
| `batiment` | FK → Batiment, nullable | chambre liée |
| `destination` | CharField(200) | — |
| `motif` | TextField | — |
| `date_depart` | DateField | **obligatoire** |
| `date_retour_prevue` | DateField | **obligatoire** |
| `date_retour_effective` | DateField, nullable | rempli au retour réel |
| `statut` | choices | `planifie` / `en_voyage` / `retour` / `annule` |
| `enregistre_par` | FK → User | — |
| `created_at` | DateTimeField | auto |

> **Champs ajoutés en session pour le concept "rotation groupe"** (à valider en DB via `/api/setup-db/` — `ALTER TABLE`) : `rotation_id` (CharField, ID partagé entre voyageurs du même convoi), `vehicule`, `nb_places_total`, `heure_depart`, `point_rdv`, `type_voyage`, `notes_admin`. **Non présents** dans le fichier `models.py` lu lors de cet audit — à confirmer qu'ils ont bien été migrés en base, sinon les colonnes existent en DB mais pas dans le modèle Django (risque de désynchronisation schema/ORM, voir Journal d'erreurs).

---

## App `maintenance`

### `Incident`
Table : `maintenance_incident`

| Champ | Type | Détail |
|---|---|---|
| `titre` | CharField(200) | — |
| `description` | TextField | — |
| `categorie` | choices | `Plomberie`, `Electricite`, `Serrurerie`, `Climatisation`, `Toiture`, `Informatique`, `Generateur`, `Vehicule`, `Autre` |
| `priorite` | choices | `critique` / `haute` / `moyenne` / `basse` |
| `statut` | choices | `declare` / `assigne` / `en_cours` / `resolu` / `cloture` / `annule` |
| `residence`, `bloc` | CharField | localisation |
| `auteur` | FK → User | déclarant |
| `assigne_a` | FK → User, nullable | technicien assigné |
| `photo_base64`, `photo_mime`, `photo_resolution_base64` | Text/CharField | photos jointes en base64 |
| `latitude`, `longitude` | FloatField, nullable | géolocalisation |
| `date_creation`, `date_assignation`, `date_debut`, `date_resolution`, `date_cloture` | DateTimeField | workflow temporel complet |
| `sla_echeance` | DateTimeField, nullable | — |
| `sla_depasse` | BooleanField | calculé/maintenu par tâche |
| `sla_notification_envoyee` | BooleanField | anti-spam notification |
| `commentaire_resolution`, `commentaire_cloture` | TextField | — |

### `CommentaireIncident`
Table : `maintenance_commentaireincident` — fil de discussion/suivi sur un incident, avec `type_comment`, `contenu`, `photo_base64`, `date_creation`.

---

## App `restauration` (couvre repas, boutique, bar, audit)

### `QRToken`
Badge repas à usage unique. `token`, `personnel`, `residence`, `resident`, `type_repas` (choices repas), `genere_par`, `cree_le`, `expire_le`, `utilise`, `utilise_le`, `device_id`.

### `RepasLog`
Trace la consommation effective d'un repas, lié 1-1 à un `QRToken`.

### `AuditLog`
Table : `restauration_auditlog` — journal d'actions transverses (`utilisateur`, `action`, `module`, `detail`, `ip`, `timestamp`).

### `ArticleBoutique`
Table : `restauration_articleboutique`

| Champ | Type | Détail |
|---|---|---|
| `nom` | CharField(150) | — |
| `categorie` | CharField(50) | default `autre` |
| `prix` | DecimalField(10,0) | FCFA, sans décimales |
| `stock` | IntegerField | **décrémenté manuellement en SQL brut** dans `ConsommationBoutiqueViewSet.create()` — pas via le modèle Django (voir Journal d'erreurs) |
| `unite` | CharField(30) | default `pièce` |
| `actif` | BooleanField | — |
| `image_url` | TextField | URL externe ou data URI base64 |
| `cree_le` | DateTimeField | auto |

### `ConsommationBoutique`
Table : `restauration_consommationboutique`

| Champ | Type | Détail |
|---|---|---|
| `personnel` | FK → Personnel, nullable | — |
| `article` | FK → ArticleBoutique, CASCADE | — |
| `quantite` | IntegerField | default 1 |
| `montant` | DecimalField(10,0) | **calculé automatiquement** dans `save()` = `article.prix * quantite` |
| `mode_paiement` | choices | `especes` / `bon` / `credit` |
| `notes` | TextField | — |
| `valide_par` | FK → User, nullable | — |
| `date_conso` | DateTimeField | auto |

### `BonCaisse`
Table : `restauration_boncaisse` — crédit annuel de 100 000 FCFA par résident.

| Champ | Type | Détail |
|---|---|---|
| `personnel` | FK → Personnel, CASCADE | — |
| `annee` | IntegerField | default 2026, **`unique_together` avec personnel** |
| `credit_initial`, `credit_restant` | DecimalField(10,0) | default 100000 chacun |
| `cree_le`, `mis_a_jour` | DateTimeField | — |

Propriétés calculées : `credit_utilise`, `pourcentage_utilise`. Méthodes : `get_or_create_for_year()`, `deduire(montant)`.

### `MenuJour`
Table : `restauration_menujour` — menu du jour (`description`, `date_service`).

---

## App `accounts`

### `Profile`
Table : `accounts_profile` — extension du `User` Django natif.

| Champ | Type | Détail |
|---|---|---|
| `user` | OneToOneField → `auth.User`, CASCADE | — |
| `role` | choices, default `agent` | `admin` / `agent` / `restauration` / `technicien` / `menage` |
| `societe` | CharField(100) | default `ROXGOLD` |
| `telephone` | CharField(20) | — |

> ⚠️ Deux notions de "rôle" coexistent : `Profile.role` (5 valeurs) et `Personnel.profil` (10 valeurs, plus granulaire). Le frontend lit l'un ou l'autre selon le contexte — source de confusion potentielle, voir Feature Backlog pour unification.

---

## Conventions générales observées

- **Devise** : FCFA, toujours en `DecimalField(max_digits=10, decimal_places=0)` — pas de centimes.
- **Suppression** : `on_delete=models.SET_NULL` est le choix dominant pour préserver l'historique (sauf `CASCADE` sur les relations de dépendance forte type Personnel→Voyage, Article→Consommation).
- **Historisation** : `simple_history` activé sur `Personnel` et `Batiment` uniquement — pas sur `Incident`, `Voyage`, `ArticleBoutique`. Si l'audit complet est requis sur ces tables, il manque la `HistoricalRecords()`.
- **Photos** : stockées en base64 directement dans la table (pas de stockage fichier externe / S3) — fonctionne mais alourdit la DB à l'échelle (voir Feature Backlog).
