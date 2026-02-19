/**
 * appleMusicService - Wrapper for MusicKit JS interactions.
 * References environment variables for developer identity and application metadata.
 */
export const appleMusicService = {
  /**
   * configure - Initializes MusicKit with developer settings.
   */
  configure: () => {
    console.log("Configuring MusicKit...");
    
    // Developer placeholders (to be populated from .env)
    const developerToken = process.env.VITE_APPLE_DEVELOPER_TOKEN; // Pre-signed JWT
    const appName = process.env.VITE_APPLE_APP_NAME || 'GetReady';
    const appBuild = process.env.VITE_APPLE_BUILD || '1.0.0';

    if (typeof window !== 'undefined' && (window as any).MusicKit) {
      try {
        (window as any).MusicKit.configure({
          developerToken: developerToken || '',
          app: {
            name: appName,
            build: appBuild,
          },
        });
        console.log("MusicKit configured successfully.");
      } catch (e) {
        console.error("MusicKit configuration failed:", e);
      }
    }
  },

  /**
   * login - Initiates the Apple Music authorization flow.
   */
  login: async () => {
    if (typeof window !== 'undefined' && (window as any).MusicKit) {
      const music = (window as any).MusicKit.getInstance();
      if (music) {
        return music.authorize();
      }
    }
    throw new Error("MusicKit not initialized");
  }
};