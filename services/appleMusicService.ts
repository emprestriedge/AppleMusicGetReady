const HARDCODED_DEV_TOKEN = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjZNNlZWUTRSQjQifQ.eyJpc3MiOiJYODlaVVo0QjI2IiwiaWF0IjoxNzcyMTYxMzkzLCJleHAiOjE3ODc5MzgzOTN9.pgmrS6V4QATA8AE07dPnuTMPJ2m6keQ9T3YEMbUabtrb4QNPSEkbBsw-KLx6wsqZ89pcbRRdpjb3s4E3UX3t3g";

const isCapacitorNative = (): boolean => {
  return !!(window as any).Capacitor?.isNativePlatform?.();
};

export const appleMusicService = {
  configure: async () => {
    console.log("Configuring MusicKit...");
    const native = isCapacitorNative();
    console.log("IS NATIVE:", native);
    let token = HARDCODED_DEV_TOKEN;
    if (!native) {
      try {
        const response = await fetch('/api/apple-music-token');
        const data = await response.json();
        if (data.token) token = data.token;
      } catch (e) {
        console.error("Token fetch failed, using hardcoded token");
      }
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