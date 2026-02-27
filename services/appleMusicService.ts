const isCapacitorNative = (): boolean => {
  return !!(window as any).Capacitor?.isNativePlatform?.();
};

const TOKEN_URL = (import.meta as any).env?.VITE_APPLE_MUSIC_TOKEN_URL || '/api/apple-music-token';

export const appleMusicService = {
  configure: async () => {
    console.log("Configuring MusicKit...");
    const native = isCapacitorNative();
    console.log("IS NATIVE:", native);
    let token: string;
    try {
      const response = await fetch(TOKEN_URL);
      const data = await response.json();
      if (!data.token) throw new Error("No token in response");
      token = data.token;
    } catch (e) {
      console.error("Token fetch failed:", e);
      throw new Error("Unable to obtain Apple Music developer token. Check Netlify environment variables.");
    }
    (window as any)._musicDeveloperToken = token;
    if (typeof window !== 'undefined' && (window as any).MusicKit) {
      (window as any).MusicKit.configure({
        developerToken: token,
        app: { name: 'GetReady', build: '1.0.0' },
      });
      console.log("MusicKit configured successfully.");
    }
  },

  login: async () => {
    const native = isCapacitorNative();

    if (native) {
      const developerToken = (window as any)._musicDeveloperToken;
      if (!developerToken) {
        throw new Error('Developer token not loaded. Check network connection and try again.');
      }
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Authorization timed out. Please try again.'));
        }, 30000);

        window.addEventListener('musickit-native-auth', (event: any) => {
          clearTimeout(timeout);
          const { status, userToken, error } = event.detail;
          if (status === 'authorized' && userToken) {
            const music = (window as any).MusicKit?.getInstance();
            if (music) music.musicUserToken = userToken;
            resolve(userToken);
          } else {
            reject(new Error(error || `Authorization denied (${status})`));
          }
        }, { once: true });

        // Direct webkit message handler — bypasses Capacitor plugin bridge
        const wk = (window as any).webkit?.messageHandlers?.requestMusicAuth;
        if (wk) {
          wk.postMessage({ developerToken });
        } else {
          clearTimeout(timeout);
          reject(new Error('Native bridge unavailable — are you running on a real iOS device?'));
        }
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