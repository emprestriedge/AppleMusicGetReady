import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.erinmarie.getreadyav',
  appName: 'GetReadyAV',
  webDir: 'dist',
  server: {
    url: 'https://appmusgetready.netlify.app',
    cleartext: true
  },
  ios: {
    allowsLinkPreview: false,
    scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: true,
    scheme: 'getreadyav'
  }
};

export default config;
