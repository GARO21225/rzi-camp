# Roxgold SiteLife — Publication Play Store + App Store

Application Capacitor 8 (`com.roxgold.rzicamp`) qui charge l'API `https://app.roxgold-sitelife.com:5173`.
Textes et visuels des fiches : `store-assets/` (voir `FICHES-STORES.md`).

## 0. Prérequis communs
1. Vérifier le vrai certificat (Let's Encrypt) sur `https://app.roxgold-sitelife.com:5173` depuis un téléphone en 4G (pas de cleartext/auto-signé : l'exception réseau a été supprimée).
2. Compléter l'e-mail de contact dans `public/confidentialite.html` (repère jaune), redéployer le frontend, vérifier `https://app.roxgold-sitelife.com:5173/confidentialite.html`.
3. Créer un compte de démonstration (lecture seule si possible) pour les relecteurs Google/Apple.
4. Décision : pas de vraies notifications push natives (Web Push désactivé en natif ; notifications in-app uniquement). À implémenter plus tard avec @capacitor/push-notifications (FCM/APNs).

## 1. Android — Google Play
1. Compte Play Console (25 $ une fois). Compte organisation (D-U-N-S) = pas de test fermé 12 testeurs / 14 jours.
2. Générer la clé d'upload (une seule fois, à sauvegarder hors dépôt !) :
   `keytool -genkeypair -v -keystore rzi-upload.jks -alias rzi -keyalg RSA -keysize 2048 -validity 10000`
3. `cp android/keystore.properties.example android/keystore.properties` et renseigner storeFile / mots de passe / alias (fichier ignoré par git).
4. Incrémenter `versionCode` (et `versionName`) dans `android/app/build.gradle` à chaque envoi.
5. Build : `rm -rf dist && npm run build:mobile && cd android && ./gradlew bundleRelease`
   → `android/app/build/outputs/bundle/release/app-release.aab` (JDK 21, Android SDK 36).
6. Play Console → Créer l'application → remplir fiche (textes `FICHES-STORES.md`), visuels, politique de confidentialité, Sécurité des données, classification, accès à l'app (compte démo), pays.
7. Production/Test interne → Créer une version → téléverser le .aab (activer Play App Signing) → publier d'abord en **test interne**, valider, puis production.

## 2. iOS — App Store (Mac + Xcode obligatoires)
1. Compte Apple Developer (99 $/an). Créer l'identifiant `com.roxgold.rzicamp` et l'app dans App Store Connect.
2. `rm -rf dist && npm run build:mobile && npx cap open ios`
3. Xcode → cible App → Signing & Capabilities : choisir l'équipe, « Automatically manage signing ». Incrémenter Version (MARKETING_VERSION) / Build (CURRENT_PROJECT_VERSION) à chaque envoi.
4. Destination « Any iOS Device » → Product → Archive → Distribute App → App Store Connect (Upload).
5. App Store Connect : fiche (textes `FICHES-STORES.md`), captures iPhone 6,9" (`store-assets/ios`), App Privacy, URL confidentialité/assistance, compte démo + notes de revue.
6. TestFlight (test interne) puis « Soumettre pour examen ».
- Risque : guideline 4.2 (fonctionnalité minimale pour une app web encapsulée) → insister dans les notes sur caméra QR, GPS, usage métier réel.
- `PrivacyInfo.xcprivacy` et clés d'usage caméra/photos/localisation sont déjà en place.

## 3. Après chaque mise à jour du frontend
`npm run build:mobile` (sync Capacitor) puis rebuild/rearchive. Le contenu web étant embarqué, toute modification d'interface exige une nouvelle version publiée.
