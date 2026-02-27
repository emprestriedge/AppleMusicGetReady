import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.erinmarie.getreadyav',
  appName: 'GetReady🍎',
  webDir: 'dist',
  ios: {
    allowsLinkPreview: false,
    scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: true,
    scheme: 'getreadyav'
  }
};

export default config;