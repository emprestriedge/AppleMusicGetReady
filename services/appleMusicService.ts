export const appleMusicService = {
  configure: async () => {
    console.log("Configuring MusicKit...");

    try {
      // Fetch token from our Netlify function
      const response = await fetch('/api/apple-music-token');
      const data = await response.json();

      if (!data.token) {
        console.error("No token returned:", data.error);
        return;
      }

      if (typeof window !== 'undefined' && (window as any).MusicKit) {
        (window as any).MusicKit.configure({
          developerToken: data.token,
          app: {
            name: 'GetReady',
            build: '1.0.0',
          },
        });
        console.log("MusicKit configured successfully.");
      }
    } catch (e) {
      console.error("MusicKit configuration failed:", e);
    }
  },

  login: async () => {
    if (typeof window !== 'undefined' && (window as any).MusicKit) {
      const music = (window as any).MusicKit.getInstance();
      if (music) {
        return music.authorize();
      }
    }
    throw new Error("MusicKit not initialized");
  },

  logout: () => {
    if (typeof window !== 'undefined' && (window as any).MusicKit) {
      const music = (window as any).MusicKit.getInstance();
      if (music) music.unauthorize();
    }
  }
};
