
import { IMusicProvider } from '../types/provider';
import { SpotifyUser, SpotifyDevice, SpotifyTrack } from '../types';
import { MOCK_TRACKS } from '../constants';

/**
 * MockProvider - A non-authenticated implementation of IMusicProvider
 * for use in demonstration and preview environments.
 */
export class MockProvider implements IMusicProvider {
  private isPlaying: boolean = false;
  private currentTrackIndex: number = 0;
  private progressMs: number = 45000;
  private mockSessionConnected: boolean = true;

  async authorize(): Promise<void> {
    this.mockSessionConnected = true;
    return Promise.resolve();
  }

  unauthorize(): void {
    this.mockSessionConnected = false;
  }

  async getAccountDetails(): Promise<SpotifyUser | null> {
    if (!this.mockSessionConnected) return null;
    return {
      display_name: 'Studio Guest',
      id: 'studio_demo_user',
      images: [{ 
        url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=200&h=200', 
        height: 200, 
        width: 200 
      }],
      country: 'US',
      email: 'studio@example.com'
    };
  }

  async play(uris: string[], index?: number): Promise<void> {
    this.isPlaying = true;
    this.currentTrackIndex = index ?? 0;
    this.progressMs = 0;
    return Promise.resolve();
  }

  async setPlaybackState(state: "play" | "pause" | "next" | "previous"): Promise<void> {
    switch (state) {
      case "play": this.isPlaying = true; break;
      case "pause": this.isPlaying = false; break;
      case "next": this.currentTrackIndex = (this.currentTrackIndex + 1) % MOCK_TRACKS.length; this.progressMs = 0; break;
      case "previous": this.currentTrackIndex = (this.currentTrackIndex - 1 + MOCK_TRACKS.length) % MOCK_TRACKS.length; this.progressMs = 0; break;
    }
    return Promise.resolve();
  }

  async getPlaybackStatus(): Promise<any> {
    const track = MOCK_TRACKS[this.currentTrackIndex % MOCK_TRACKS.length];
    return {
      is_playing: this.isPlaying,
      progress_ms: this.progressMs,
      currently_playing_type: 'track',
      item: {
        id: track.id,
        name: track.title,
        uri: track.uri,
        duration_ms: track.durationMs,
        artists: [{ name: track.artist }],
        album: { 
          name: track.album || 'Demo Album',
          images: [{ url: track.imageUrl || '' }] 
        },
      },
      device: { name: 'AI Studio Simulator' }
    };
  }

  async getTracks(sourceId: string, limit: number = 50): Promise<SpotifyTrack[]> {
    // Return a sliced set of mock tracks
    return MOCK_TRACKS.slice(0, limit).map(t => ({
      id: t.id,
      name: t.title,
      uri: t.uri,
      artists: [{ name: t.artist, id: 'mock_artist' }],
      album: { name: t.album || 'Demo Album', id: 'mock_album', images: [{ url: t.imageUrl || '' }] },
      duration_ms: t.durationMs
    })) as SpotifyTrack[];
  }

  async createContainer(name: string, description?: string): Promise<any> {
    return { id: 'mock_playlist_id', name };
  }

  async toggleFavorite(id: string, state: boolean): Promise<void> {
    return Promise.resolve();
  }

  async getOutputDevices(): Promise<SpotifyDevice[]> {
    return [
      { id: 'sim_iphone', is_active: true, name: 'Studio Simulator', type: 'Smartphone', volume_percent: 80, is_private_session: false, is_restricted: false }
    ];
  }

  async transfer(deviceId: string): Promise<void> {
    return Promise.resolve();
  }
}
