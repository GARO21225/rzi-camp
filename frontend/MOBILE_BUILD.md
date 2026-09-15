# RZI Camp — Build mobile (App Store / Play Store)

## Ce qui est déjà fait dans ce commit

- Projet Capacitor initialisé (`capacitor.config.ts`), réutilisant l'application
  web React existante à 100% — aucune réécriture.
- Projets natifs générés : `android/` (prêt pour Android Studio) et
  `ios/` (prêt pour Xcode).
- Icônes et écrans de démarrage générés pour les deux plateformes,
  à partir du logo existant (`public/logo512.png`).
- Build dédié mobile (`npm run build:mobile`) qui fixe l'URL de l'API
  explicitement — indispensable, car une app native n'a pas de "même
  origine" comme un navigateur.
- ⚠️ Exception réseau temporaire pour le certificat auto-signé actuel
  (voir `android/app/src/main/res/xml/network_security_config.xml`).

## Ce qui nécessite une machine que je n'ai pas dans cet environnement

### 1. Un vrai certificat SSL — À FAIRE EN PREMIER, bloquant pour tout le reste
Le serveur actuel (204.168.229.74) a un certificat auto-signé. Une app
native refuse ça par défaut (contrairement à un navigateur qui affiche
juste un avertissement). Il faut :
- Un vrai nom de domaine pointant vers le serveur (pas une IP nue —
  Let's Encrypt n'émet pas de certificat pour une IP)
- Un certificat Let's Encrypt (gratuit) via `certbot`
- Une fois fait : supprimer `network_security_config.xml` et sa référence
  dans `AndroidManifest.xml`, et mettre à jour `.env.mobile` avec le
  vrai domaine.

### 2. Build Android — nécessite Android Studio (Windows/Mac/Linux, gratuit)
```bash
npm run build:mobile
npx cap open android
```
Puis dans Android Studio : Build → Generate Signed Bundle/APK. Nécessite
un compte développeur Google Play (25$, paiement unique).

### 3. Build iOS — nécessite un Mac avec Xcode (contrainte Apple, aucun
   moyen de la contourner avec un autre outil)
```bash
npm run build:mobile
npx cap open ios
```
Puis dans Xcode : Product → Archive, puis soumission via
App Store Connect. Nécessite un compte développeur Apple (99$/an).

## Prochaine fois qu'on modifie l'app web

Après tout changement dans `frontend/src/`, avant de rebuilder mobile :
```bash
npm run build:mobile
```
Ça reconstruit le web ET resynchronise les deux projets natifs
automatiquement (`vite build --mode mobile && npx cap sync`).
