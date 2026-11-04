import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.roxgold.rzicamp',
  appName: 'Roxgold SiteLife',
  webDir: 'dist',
  backgroundColor: '#0F2A5C',
  plugins: {
    SplashScreen: {
      // Masqué par le code (src/main.jsx) une fois la première page dessinée,
      // au plus tard après 5 s.
      launchAutoHide: false,
      launchShowDuration: 5000,
      backgroundColor: '#0F2A5C',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0F2A5C',
    },
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
