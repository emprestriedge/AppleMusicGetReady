import { SpotifyProvider } from './spotifyProvider';
import { MockProvider } from './mockProvider';
import { AppleMusicProvider } from './appleMusicProvider';
import { IMusicProvider } from '../types/provider';
import { IS_STUDIO_MODE, MUSIC_PLATFORM } from '../constants';

/**
 * The main music provider instance for the application.
 * Dynamically selects provider based on environment and target platform.
 */
const getProvider = (): IMusicProvider => {
  if (IS_STUDIO_MODE) return new MockProvider();
  
  if (MUSIC_PLATFORM === 'apple') {
    return new AppleMusicProvider();
  }
  
  return new SpotifyProvider();
};

const providerInstance = getProvider();

// Startup diagnostic log
console.log(`[MusicProvider] Startup Mode: ${IS_STUDIO_MODE ? 'STUDIO' : 'PRODUCTION'}`);
console.log(`[MusicProvider] Active Platform: ${MUSIC_PLATFORM}`);

export const musicProvider = providerInstance;