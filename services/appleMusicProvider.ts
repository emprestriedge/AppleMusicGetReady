import { IMusicProvider } from '../types/provider';
import { appleMusicService } from './appleMusicService';
import { SpotifyUser, SpotifyDevice, SpotifyTrack } from '../types';

export class AppleMusicProvider implements IMusicProvider {

  constructor() {
    appleMusicService.configure();
  }

  async authorize(): Promise<void> {
    await appleMusicService.login();
  }

  unauthorize(): void {
    if (typeof window !== 'undefined' && (window as any).MusicKit) {
      (window as any).MusicKit.getInstance().unauthorize();
    }
  }

  async getAccountDetails(): Promise<SpotifyUser | null> {
    if (typeof window !== 'undefined' && (window as any).MusicKit) {
      const music = (window as any).MusicKit.getInstance();
      if (!music.isAuthorized) return null;
      return {
        display_name: 'Apple Music Subscriber',
        id: 'apple_subscriber',
        images: [],
        country: music.storefrontId || 'US',
      };
    }
    return null;
  }

  async play(uris: string[], index: number = 0): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).MusicKit) {
      const music = (window as any).MusicKit.getInstance();
      await music.setQueue({ songs: uris, startPosition: index });
      await music.play();
    }
  }

  async setPlaybackState(state: 'play' | 'pause' | 'next' | 'previous'): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).MusicKit) {
      const music = (window as any).MusicKit.getInstance();
      switch (state) {
        case 'play':     await music.play(); break;
        case 'pause':    await music.pause(); break;
        case 'next':     await music.skipToNextItem(); break;
        case 'previous': await music.skipToPreviousItem(); break;
      }
    }
  }

  async getPlaybackStatus(): Promise<any> {
    if (typeof window !== 'undefined' && (window as any).MusicKit) {
      const music = (window as any).MusicKit.getInstance();
      const nowPlaying = music.nowPlayingItem;
      return {
        isPlaying: music.isPlaying,
        currentTrack: nowPlaying ? {
          id: nowPlaying.id,
          uri: nowPlaying.id,
          name: nowPlaying.title,
          artistName: nowPlaying.artistName,
          albumName: nowPlaying.albumName,
        } : null,
      };
    }
    return null;
  }

  async getTracks(sourceId: string, limit: number = 50): Promise<SpotifyTrack[]> {
    console.log('AppleMusicProvider.getTracks called for ' + sourceId);
    return [];
  }

  async getOutputDevices(): Promise<SpotifyDevice[]> {
    return [{
      id: 'apple_local',
      is_active: true,
      name: 'Apple Music (This Device)',
      type: 'Computer',
      volume_percent: 100,
      is_private_session: false,
      is_restricted: false,
    }];
  }

  async transfer(deviceId: string): Promise<void> {
    console.log('AppleMusicProvider: Transfer handled by AirPlay.');
  }

  async createContainer(name: string, description: string = 'Created by GetReady'): Promise<{ id: string; name: string }> {
    const music = (window as any).MusicKit?.getInstance();
    if (!music) throw new Error('MusicKit not initialized');
    if (!music.isAuthorized) throw new Error('Not authorized with Apple Music');

    const response = await music.api.music('/v1/me/library/playlists', {
      method: 'POST',
      body: JSON.stringify({
        attributes: { name, description },
      }),
    });

    const playlist = response?.data?.data?.[0];
    if (!playlist?.id) throw new Error('Playlist creation returned no ID');

    return { id: playlist.id, name };
  }

  async addTracksToPlaylist(playlistId: string, trackIds: string[]): Promise<void> {
    const music = (window as any).MusicKit?.getInstance();
    if (!music) throw new Error('MusicKit not initialized');

    const chunkSize = 100;
    for (let i = 0; i < trackIds.length; i += chunkSize) {
      const chunk = trackIds.slice(i, i + chunkSize).map(id => ({ id, type: 'songs' }));
      await music.api.music('/v1/me/library/playlists/' + playlistId + '/tracks', {
        method: 'POST',
        body: JSON.stringify({ data: chunk }),
      });
    }
  }

  async addTrackToGems(trackId: string): Promise<void> {
    const CACHE_KEY = 'getready_gems_playlist_id';
    let gemsId = localStorage.getItem(CACHE_KEY);

    if (!gemsId) {
      const playlist = await this.createContainer(
        'GetReady Gems',
        'Tracks marked as Gems in the GetReady app'
      );
      gemsId = playlist.id;
      localStorage.setItem(CACHE_KEY, gemsId);
    }

    await this.addTracksToPlaylist(gemsId, [trackId]);
  }

  async removeTrackFromGems(trackId: string): Promise<void> {
    console.log('Track ' + trackId + ' un-gemmed. Remove manually in Apple Music if needed.');
  }

  async toggleFavorite(id: string, state: boolean): Promise<void> {
    const music = (window as any).MusicKit?.getInstance();
    if (!music) return;

    try {
      if (state) {
        await music.api.music('/v1/me/ratings/songs/' + id, {
          method: 'PUT',
          body: JSON.stringify({ type: 'ratings', attributes: { value: 1 } }),
        });
      } else {
        await music.api.music('/v1/me/ratings/songs/' + id, { method: 'DELETE' });
      }
    } catch (err) {
      console.warn('toggleFavorite failed:', err);
    }
  }
}
