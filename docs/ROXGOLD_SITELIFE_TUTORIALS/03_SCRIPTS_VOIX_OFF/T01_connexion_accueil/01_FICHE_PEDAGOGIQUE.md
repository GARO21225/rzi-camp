# T01 : Se connecter et prendre en main son espace (fiche pédagogique)

| Élément | Contenu |
|---|---|
| Série | 1 : Espace résident |
| Modules | Connexion (`/login`), Accueil (`/accueil`), barre d'onglets mobile, menu « Plus », Mon compte (`/mon-compte`) |
| Public | Tout résident (rôle `agent`). Les autres profils ont la même connexion, mais un menu différent. |
| Support filmé | Mobile (iPhone 13), application web/PWA |
| Durée | 2 min 05 (catalogue : 2 min) |
| Difficulté | Facile |
| Statut fonctionnel | ✅ Opérationnel. Parcours rejoué sur l'instance de démo le 11/11/2026, y compris un vrai changement de mot de passe, suivi de la déconnexion automatique. |

## Objectif pédagogique

1. Installer l'application sur l'écran d'accueil du téléphone (invite affichée sur iPhone).
2. Se connecter avec son identifiant et son mot de passe.
3. Lire son accueil : prochain trajet (date, heure, compte à rebours J-x), raccourcis, mes demandes.
4. Naviguer : barre d'onglets, menu « Plus », Mon compte, Déconnexion.
5. Modifier son mot de passe, puis se reconnecter.

## Problématique (avant)
- Les informations personnelles (prochain trajet, statut d'une demande) sont **dispersées** : il faut demander autour de soi.
- **Aucune vue personnelle**. Identifiants communiqués à la main, rarement changés.

## Solution (vérifiée dans le code)
| Besoin | Réponse |
|---|---|
| Accès rapide sur le téléphone | PWA installable. Sur iPhone, une notice en 3 étapes apparaît dans Safari (`PWAInstall.jsx`). |
| Connexion | Identifiant et mot de passe (`custom_login`). L'onglet « Code SMS » (OTP) existe, mais son envoi dépend du fournisseur configuré : la vidéo dit « selon la configuration de votre site ». |
| Vue personnelle | Accueil : prochain trajet (en cours, sinon le prochain planifié), destination, date, heure, J-x, ligne de route, raccourcis vers les 6 premières pages du menu, compteurs « Mes demandes ». Les dernières données connues s'affichent tout de suite, même avec un réseau lent. |
| Navigation | Barre d'onglets (Accueil, Voyages, Demandes, Repas, Signaler, Plus) ; « Plus » ouvre toutes les pages du menu, Mon compte et Déconnexion. |
| Sécurité du compte | Changement de mot de passe (ancien, nouveau, confirmation, jauge de force). Déconnexion automatique 3 s après le changement. **Déconnexion après 15 min d'inactivité**, avec un avertissement à 14 min (`useInactivityLogout.js`). |

## Ce que la vidéo ne dit pas (et pourquoi)
- **« Mot de passe oublié »** et **connexion par SMS** : ils dépendent de l'envoi d'e-mails ou de SMS configuré sur le site. Ils ne sont ni montrés ni promis.
- **Langue** : le choix FR/EN est seulement mentionné, sans démonstration.
- Le menu montré est celui d'un résident (`agent`). Il est **paramétrable** par l'administrateur, donc d'autres profils voient d'autres pages.
