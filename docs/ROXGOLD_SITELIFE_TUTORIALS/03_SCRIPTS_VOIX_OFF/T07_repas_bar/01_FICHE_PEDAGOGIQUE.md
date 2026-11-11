# T07 : Repas et bar, mon QR, le menu, mon bon (fiche pédagogique)

| Élément | Contenu |
|---|---|
| Série | 1 : Espace résident |
| Modules | Repas (`pages/Restauration.jsx`, vue « Mon QR »), Mon bar (`pages/BarClient.jsx`) |
| Public | Tout résident qui n'est ni équipe restauration, ni gérant du bar, ni administrateur (ceux-là ont d'autres écrans : T17 à T20) |
| Support filmé | Mobile (iPhone 13), navigateur en français |
| Durée | 1 min 42 (catalogue : 1 min 30) |
| Difficulté | Facile |
| Statut fonctionnel | ✅ Opérationnel. Menu du jour, carte du bar et bon de caisse créés le 11/11/2026 par la vraie API (administrateur de démo) ; consommations ajoutées selon la logique de la caisse (voir `06_PROJETS_HYPERFRAMES/T07_repas_bar/seed_demo_t07.py`). |

## Objectif pédagogique
1. Ouvrir l'onglet **Repas** et présenter son **QR restaurant** à l'entrée.
2. Lire le **menu du jour** (petit-déjeuner, déjeuner, dîner) et les **horaires des repas**.
3. Ouvrir **Plus › Bar** : lire son **bon de caisse** de l'année, la **carte du bar** (prix, disponible / épuisé, filtre par catégorie) et **ses consommations**.

## Problématique (avant)
- Pointage des repas sur liste papier ; au bar, on ne sait pas ce que l'on a consommé ni ce qu'il reste sur son bon.

## Solution (vérifiée dans le code)
| Besoin | Réponse |
|---|---|
| Être compté au restaurant | QR personnel à son nom (`Personnel.qr_code_data`), signé par le serveur (HMAC) : impossible à recopier à la main. L'équipe restauration le scanne depuis sa propre vue de la page Repas. |
| Savoir ce qui est servi | Menu du jour en lecture seule (plats disponibles uniquement), groupé par repas, avec photo si l'équipe en a ajouté une. |
| Savoir quand | Horaires des repas, issus du Paramétrage (valeurs par défaut du code sinon). |
| Suivre son bon | « Mon bon de caisse » de l'année : restant sur le montant de départ, jauge (rouge sous 20 %). |
| Savoir ce qu'il y a au bar | Carte : prix, « Disponible » / « Épuisé » (stock à zéro), recherche et filtre par catégorie. |
| Savoir ce que l'on a consommé | « Mes consommations » : article, quantité, date, heure, mode de paiement, montant ; total du mois. |

Le résident ne vend rien et ne voit ni la caisse, ni les ventes des autres, ni le stock : l'API applique la même règle (`_profil_bar` dans `restauration/views.py`).

## Points relevés pendant le tournage
- **Mode de paiement affiché en code brut** dans « Mes consommations » pour Mobile Money et crédit : `om`, `wave`, `mtn`, `moov`, `credit` au lieu de « Orange Money », « Wave »… (`BarClient.jsx` ne traduit que « bon » et « espèces »). Les consommations de la démo sont en bon de caisse et en espèces, le défaut n'apparaît donc pas à l'écran. Non corrigé : à arbitrer.
- La caisse du bar (`ConsommationBoutiqueViewSet.create`) écrit en SQL propre à PostgreSQL (`NOW()`, `GREATEST`) : elle fonctionne en production (PostgreSQL) mais pas sur la base SQLite de démonstration. Les consommations de la démo sont donc créées par l'ORM, avec la même logique (montant, stock, débit du bon).

## Ce que la vidéo ne dit pas
- Elle ne montre pas le scan côté restaurant ni l'encaissement au bar (tutoriels équipes T17 et T18).
- Plats, articles et prix sont **fictifs** ; les horaires affichés sont ceux de la base de démonstration.
