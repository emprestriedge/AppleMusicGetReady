
import { SpotifyProvider } from './spotifyProvider';
import { MockProvider } from './mockProvider';
import { IMusicProvider } from '../types/provider';
import { IS_STUDIO_MODE } from '../constants';

/**
 * The main music provider instance for the application.
 * Dynamically selects Spotify or Mock provider based on the environment.
 */
const providerInstance: IMusicProvider = IS_STUDIO_MODE 
  ? new MockProvider() 
  : new SpotifyProvider();

// Startup diagnostic log
console.log(`[MusicProvider] Startup Mode: ${IS_STUDIO_MODE ? 'STUDIO (MockProvider active)' : 'PRODUCTION (SpotifyProvider active)'}`);

export const musicProvider = providerInstance;
