# T17 : Restauration, scanner les repas (flasheurs) — fiche pédagogique

Deux versions : **française** et **anglaise** (même parcours, application filmée réellement dans chaque langue grâce à son sélecteur FR / EN).

| Élément | Contenu |
|---|---|
| Série | 4 : Restauration et bar (équipes) |
| Modules | Repas (`pages/Restauration.jsx`, vue équipe restauration : scanner, compteurs, historique, avis) |
| Public | Flasheurs : personnes qui scannent les QR à l'entrée du restaurant (rôle « restauration », affectées à un restaurant par le Camp Boss) |
| Support filmé | Mobile (iPhone 13), navigateur en français puis en anglais |
| Durée | 1:38 (FR) · 1:35 (EN) — catalogue : 3 min, scan seul ici |
| Difficulté | Facile |
| Statut fonctionnel | ✅ Opérationnel. Scans **réels** : la caméra du téléphone est remplacée par une vidéo du QR de démonstration (option de Chromium), l'application décode le QR et l'API de scan valide ou refuse, exactement comme sur le terrain. |
| Périmètre | Le scan uniquement. La publication du menu (réservée à l'écran d'ordinateur) fera l'objet d'un tutoriel à part. |

## Objectif pédagogique
1. Ouvrir l'onglet **Repas** avec son compte restauration ; vérifier le restaurant et le repas en cours (petit-déjeuner, déjeuner, dîner).
2. Scanner le QR du résident : écran vert et bip = repas validé à son nom ; mini-avis facultatif du résident.
3. Reconnaître les refus : **Déjà pris** (même repas, deuxième passage) et **Non reconnu** (QR inconnu ou falsifié).
4. Suivre l'historique du jour et les compteurs.

## Solution (vérifiée dans le code)
| Besoin | Réponse |
|---|---|
| Compter juste | Un scan = un repas (`RepasLog`), au nom du résident, pour le restaurant du flasheur. Compteurs du jour par repas, actualisés après les scans. |
| Empêcher le double passage | Le serveur refuse un deuxième repas du même type le même jour : « Déjà pris ». Sur un même téléphone, le même QR encore devant la caméra est ignoré 4 s. |
| Empêcher la fraude | QR signé par le serveur (HMAC) : un QR inconnu, recopié ou modifié est refusé (« Non reconnu »). |
| Retour immédiat | Écran vert / orange / rouge et son différent pour chaque cas. |
| Scanner où il faut | Seul un superviseur affecté à un restaurant peut scanner (réglage par défaut), dans son restaurant. |

## Corrections de l'application faites pour ce tutoriel (avec accord, 15/11/2026)
- **Compteurs à 0** : plusieurs écrans calculaient l'adresse de l'API avec `import.meta?.env?.VITE_API_URL`, forme que Vite ne remplace pas au build ; ils appelaient l'adresse du site au lieu de celle de l'API. Tous utilisent désormais l'adresse unique de `api/index.js`.
- **Anglais** : onglets (Home, Requests, Meals), « Map », « Request a trip », messages du scan (« … has already had this meal today », « Invalid QR (wrong signature) »).

## Point relevé (non corrigé, à arbitrer)
- Le scan QR (`QRTokenViewSet.scan`) vérifie « déjà pris » **sans verrou**, alors que la validation par identifiant (`valider_par_personnel`) en a un (`select_for_update`). Deux flasheurs qui scannent le **même** QR à la même seconde sur deux téléphones pourraient compter deux repas. Cas rare ; correction simple (même verrou que `valider_par_personnel`).

## Ce que la vidéo ne dit pas
- Le bip n'est pas audible dans la vidéo (son de l'application non enregistré par la capture) : la voix off le mentionne.
- Résidents, flasheur, restaurant et QR sont **fictifs** (QR signés par la clé de l'instance locale : inutilisables en production).
