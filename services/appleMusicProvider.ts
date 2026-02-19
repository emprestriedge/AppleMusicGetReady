import { IMusicProvider } from '../types/provider';
import { appleMusicService } from './appleMusicService';
import { SpotifyUser, SpotifyDevice, SpotifyTrack } from '../types';

/**
 * AppleMusicProvider - Bridges the application's music interface with Apple's MusicKit JS.
 * Handles authentication, queue management, and playback control.
 */
export class AppleMusicProvider implements IMusicProvider {
  
  constructor() {
    // Ensure MusicKit is configured on instantiation
    appleMusicService.configure();
  }

  /**
   * authorize - Triggers the Apple Music sign-in modal.
   */
  async authorize(): Promise<void> {
    await appleMusicService.login();
  }

  /**
   * unauthorize - Signs the user out of Apple Music.
   */
  unauthorize(): void {
    if (typeof window !== 'undefined' && (window as any).MusicKit) {
      (window as any).MusicKit.getInstance().unauthorize();
    }
  }

  /**
   * getAccountDetails - Returns basic user info from the MusicKit session.
   */
  async getAccountDetails(): Promise<SpotifyUser | null> {
    if (typeof window !== 'undefined' && (window as any).MusicKit) {
      const music = (window as any).MusicKit.getInstance();
      if (!music.isAuthorized) return null;

      // MusicKit v3 doesn't provide email/images directly via simple profile,
      // so we return a placeholder with the "Authorized" status.
      return {
        display_name: 'Apple Music Subscriber',
        id: 'apple_subscriber',
        images: [],
        country: music.storefrontId || 'US',
      };
    }
    return null;
  }

  /**
   * play - Sets the active queue and starts playback.
   * @param uris Apple Music Catalog IDs (Store IDs)
   * @param index Starting track index
   */
  async play(uris: string[], index: number = 0): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).MusicKit) {
      const music = (window as any).MusicKit.getInstance();
      
      // Apple MusicKit uses "songs" array for catalog IDs
      await music.setQueue({ songs: uris, startPosition: index });
      await music.play();
    }
  }

  /**
   * setPlaybackState - Standardized playback control mapping.
   */
  async setPlaybackState(state: "play" | "pause" | "next" | "previous"): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).MusicKit) {
      const music = (window as any).MusicKit.getInstance();
      switch (state) {
        case "play": 
          await music.play(); 
          break;
        case "pause": 
          await music.pause(); 
          break;
        case "next": 
          await music.skipToNextItem(); 
          break;
        case "previous": 
          await music.skipToPreviousItem(); 
          break;
      }
    }
  }

  /**
   * getPlaybackStatus - Maps MusicKit state to the application's internal format.
   */
  async getPlaybackStatus(): Promise<any> {
    if (typeof window !== 'undefined' && (window as any).MusicKit) {
      const music = (window as any).MusicKit.getInstance();
      const nowPlaying = music.nowPlayingItem;
      
      return {
        is_playing: music.isPlaying,
        progress_ms: music.playbackTime * 1000,
        currently_playing_type: 'track',
        item: nowPlaying ? {
          id: nowPlaying.id,
          name: nowPlaying.title,
          uri: nowPlaying.id, // Store ID used as URI for Apple
          duration_ms: nowPlaying.durationInMillis,
          artists: [{ name: nowPlaying.artistName }],
          album: { 
            name: nowPlaying.albumName,
            images: [{ url: nowPlaying.artworkURL?.replace('{w}', '300').replace('{h}', '300') }] 
          },
        } : null,
        device: { name: 'Apple Music Web' }
      };
    }
    return null;
  }

  /**
   * getTracks - Placeholder for catalog fetching.
   */
  async getTracks(sourceId: string, limit: number = 50): Promise<SpotifyTrack[]> {
    console.log(`Apple Music: Deep fetching not yet implemented for ${sourceId}`);
    return [];
  }

  /**
   * createContainer - Placeholder for library playlist creation.
   */
  async createContainer(name: string, description?: string): Promise<any> {
    console.warn("Apple Music: Library playlist creation requires write scopes not yet configured.");
    return { id: 'apple_placeholder_playlist', name };
  }

  /**
   * toggleFavorite - Toggles library 'Love' state.
   */
  async toggleFavorite(id: string, state: boolean): Promise<void> {
    console.log(`Apple Music: Toggling favorite/love for ${id} to ${state}`);
    // MusicKit API for ratings/favorites requires specific developer tokens with write access
  }

  /**
   * getOutputDevices - Apple Music handles output via system (AirPlay/Browser).
   */
  async getOutputDevices(): Promise<SpotifyDevice[]> {
    return [
      { 
        id: 'apple_local', 
        is_active: true, 
        name: 'Local Browser (Apple Music)', 
        type: 'Computer', 
        volume_percent: 100, 
        is_private_session: false, 
        is_restricted: false 
      }
    ];
  }

  /**
   * transfer - Not directly supported via MusicKit JS as a command.
   */
  async transfer(deviceId: string): Promise<void> {
    console.log(`Apple Music: Transfer not supported via MusicKit directly.`);
  }
}