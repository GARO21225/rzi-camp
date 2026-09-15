import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.roxgold.rzicamp',
  appName: 'RZI Camp',
  webDir: 'dist',
  backgroundColor: '#0F2A5C',
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
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
