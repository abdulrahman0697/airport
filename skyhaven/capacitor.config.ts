import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.skyhaven.tycoon',
  appName: 'SkyHaven Tycoon',
  webDir: 'app/dist',
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      backgroundColor: '#0B1120',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0B1120',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'native',
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
};

export default config;
