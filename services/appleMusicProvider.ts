import { IMusicProvider } from '../types/provider';
import { appleMusicService } from './appleMusicService';
import { SpotifyUser, SpotifyDevice, SpotifyTrack } from '../types';

/**
 * AppleMusicProvider — Apple Music Edition
 *
 * Bridges the app's music interface with Apple's MusicKit JS.
 *
 * WRITING TO APPLE MUSIC LIBRARY:
 * ────────────────────────────────
 * Apple Music allows apps to create playlists and add tracks to the user's
 * library via the MusicKit API at /v1/me/library/playlists
 * This requires the user to have authorized the app with music-library access.
 * MusicKit JS handles this as part of the normal authorize() flow when the
 * developer token includes the correct entitlements.
 *
 * GEMS PLAYLIST:
 * ──────────────
 * When a user marks a track as a Gem (⭐), we add it to a dedicated playlist
 * called "GetReady Gems" in their Apple Music library. We cache the playlist ID
 * in localStorage so we only create it once — ever.
 *
 * REMOVE LIMITATION:
 * ──────────────────
 * Apple Music's web API does NOT support removing individual tracks from a
 * playlist. Un-gemming a track removes the visual mark in the app but the
 * track stays in the Apple Music playlist until the user removes it manually.
 */
export class AppleMusicProvider implements IMusicProvider {

  constructor() {
    appleMusicService.configure();
  }

  // ── Auth ───────────────────────────────────

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

  // ── Playback ───────────────────────────────

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

  // ── Track Fetching ─────────────────────────

  async getTracks(sourceId: string, limit: number = 50): Promise<SpotifyTrack[]> {
    console.log(`AppleMusicProvider.getTracks called for ${sourceId} — delegated to engine`);
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
    console.log('AppleMusicProvider: Output device transfer handled by AirPlay — no direct API control.');
  }

  // ── Library Writing ────────────────────────

  /**
   * createContainer — Creates a new playlist in the user's Apple Music library.
   *
   * Apple Music API: POST /v1/me/library/playlists
   *
   * Returns { id, name } where id is the new playlist's library ID.
   * Cache this ID — don't call this more than once per playlist name.
   */
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

  /**
   * addTracksToPlaylist — Adds tracks to an existing Apple Music library playlist.
   *
   * Apple Music API: POST /v1/me/library/playlists/{id}/tracks
   *
   * Batches automatically — Apple limits 100 tracks per request.
   * trackIds should be catalog song IDs (the uri field on your Track objects).
   */
  async addTracksToPlaylist(playlistId: string, trackIds: string[]): Promise<void> {
    const music = (window as any).MusicKit?.getInstance();
    if (!music) throw new Error('MusicKit not initialized');

    const chunkSize = 100;
    for (let i = 0; i < trackIds.length; i += chunkSize) {
      const chunk = trackIds.slice(i, i + chunkSize).map(id => ({ id, type: 'songs' }));
      await music.api.music(`/v1/me/library/playlists/${playlistId}/tracks`, {
        method: 'POST',
        body: JSON.stringify({ data: chunk }),
      });
    }
  }

  /**
   * addTrackToGems — Adds a track to the user's "GetReady Gems ⭐" playlist.
   *
   * Creates the playlist automatically on first use and caches its ID in
   * localStorage under 'getready_gems_playlist_id' so we never duplicate it.
   */
  async addTrackToGems(trackId: string): Promise<void> {
    const CACHE_KEY = 'getready_gems_playlist_id';
    let gemsId = localStorage.getItem(CACHE_KEY);

    if (!gemsId) {
      const playlist = await this.createContainer(
        'GetReady Gems ⭐',
        'Tracks marked as Gems in the GetReady app'
      );
      gemsId = playlist.id;
      localStorage.setItem(CACHE_KEY, gemsId);
    }

    await this.addTracksToPlaylist(gemsId, [trackId]);
  }

  /**
   * removeTrackFromGems — Visual only. Apple Music web API does not support
   * removing individual tracks from a playlist. The gem mark is removed in the
   * app UI, but the track stays in Apple Music until manually deleted there.
   */
  async removeTrackFromGems(trackId: string): Promise<void> {
    console.log(`Track ${trackId} un-gemmed in app. Remove manually in Apple Music if needed.`);
  }

  /**
   * toggleFavorite — Marks/unmarks a track as "Loved" in Apple Music.
   *
   * Apple Music API: PUT /v1/me/ratings/songs/{id}
   * This is the native heart/love feature, separate from Gems.
   */
  async toggleFavorite(id: string, state: boolean): Promise<void> {
    const music = (window as any).MusicKit?.getInstance();
    if (!music) return;

    try {
      if (state) {
        await music.api.music(`/v1/me/ratings/songs/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ type: 'ratings', attributes: { value: 1 } }),
        });
      } else {
        await music.api.music(`/v1/me/ratings/songs/${id}`, { method: 'DELETE' });
      }
    } catch (err) {
      console.warn('toggleFavorite failed:', err);
    }
  }
}
