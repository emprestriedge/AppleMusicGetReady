const isCapacitorNative = (): boolean => {
  console.log("USER AGENT:", navigator.userAgent);
  console.log("CAPACITOR:", JSON.stringify((window as any).Capacitor));
  console.log("WEBKIT:", !!(window as any).webkit?.messageHandlers);
  return false; // temporary — just logging for now
};

export const appleMusicService = {
  configure: async () => {
    console.log("Configuring MusicKit...");

    if (isCapacitorNative()) {
      console.log("Native mode — skipping MusicKit JS configure");
      return;
    }

    try {
      const response = await fetch('/api/apple-music-token');
      const data = await response.json();
      if (!data.token) { console.error("No token returned:", data.error); return; }
      (window as any)._musicDeveloperToken = data.token;
      if (typeof window !== 'undefined' && (window as any).MusicKit) {
        (window as any).MusicKit.configure({
          developerToken: data.token,
          app: { name: 'GetReady', build: '1.0.0' },
        });
        console.log("MusicKit configured successfully.");
      }
    } catch (e) {
      console.error("MusicKit configuration failed:", e);
    }
  },

  login: async () => {
    if (isCapacitorNative()) {
      const developerToken = (window as any)._musicDeveloperToken;
      if (!developerToken) throw new Error("Developer token not ready");
      return new Promise((resolve, reject) => {
        window.addEventListener('musickit-native-auth', (event: any) => {
          const { status, userToken } = event.detail;
          if (status === 'authorized' && userToken) {
            const music = (window as any).MusicKit?.getInstance();
            if (music) music.musicUserToken = userToken;
            resolve(userToken);
          } else {
            reject(new Error(`Auth failed: ${status}`));
          }
        }, { once: true });
        (window as any).Capacitor.Plugins.MusicKitPlugin.requestAuthorization({ developerToken });
      });
    }

    if (typeof window !== 'undefined' && (window as any).MusicKit) {
      const music = (window as any).MusicKit.getInstance();
      if (music) return music.authorize();
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