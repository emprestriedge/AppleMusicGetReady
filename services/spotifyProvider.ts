
import { IMusicProvider } from '../types/provider';
import { SpotifyAuth } from './spotifyAuth';
import { SpotifyApi } from './spotifyApi';
import { spotifyPlayback } from './spotifyPlaybackService';
import { SpotifyDataService } from './spotifyDataService';
import { SpotifyUser, SpotifyDevice, SpotifyTrack } from '../types';

/**
 * SpotifyProvider - Implements IMusicProvider by wrapping the existing 
 * Spotify-specific logic/services in the application.
 */
export class SpotifyProvider implements IMusicProvider {
  
  async authorize(): Promise<void> {
    return SpotifyAuth.login();
  }

  unauthorize(): void {
    return SpotifyAuth.logout();
  }

  async getAccountDetails(): Promise<SpotifyUser | null> {
    try {
      return await SpotifyApi.getMe();
    } catch (e) {
      return null;
    }
  }

  async play(uris: string[], index?: number): Promise<void> {
    // Delegates to the retry-enabled playback service
    return spotifyPlayback.playUrisWithRetry(uris, undefined, index);
  }

  async setPlaybackState(state: "play" | "pause" | "next" | "previous"): Promise<void> {
    switch (state) {
      case "play": return spotifyPlayback.resume();
      case "pause": return spotifyPlayback.pause();
      case "next": return spotifyPlayback.next();
      case "previous": return spotifyPlayback.previous();
    }
  }

  async getPlaybackStatus(): Promise<any> {
    // Must include additional_types to ensure episodes are tracked correctly
    return SpotifyApi.request('/me/player?additional_types=track,episode');
  }

  async getTracks(sourceId: string, limit: number = 50): Promise<SpotifyTrack[]> {
    if (sourceId === 'liked_songs') {
      return SpotifyDataService.getLikedTracks(limit);
    }
    return SpotifyDataService.getPlaylistTracks(sourceId, limit);
  }

  async createContainer(name: string, description: string = "Created via GetReady"): Promise<any> {
    const user = await SpotifyApi.getMe();
    return SpotifyDataService.createPlaylist(user.id, name, description);
  }

  async toggleFavorite(id: string, state: boolean): Promise<void> {
    // Note: We use the track ID/URI to like/save the track in the user's primary library
    // This handles the standard 'Liked Songs' behavior
    return SpotifyDataService.setTrackLiked(id, state);
  }

  async getOutputDevices(): Promise<SpotifyDevice[]> {
    return SpotifyApi.getDevices();
  }

  async transfer(deviceId: string): Promise<void> {
    return spotifyPlayback.transferPlayback(deviceId, false);
  }
}
