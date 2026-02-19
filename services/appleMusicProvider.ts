import { IMusicProvider } from '../types/provider';
import { appleMusicService } from './appleMusicService';
import { SpotifyUser, SpotifyDevice, SpotifyTrack } from '../types';

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

/**
 * getMusicKit - Safe accessor for the MusicKit instance.
 * Returns null instead of throwing if MusicKit isn't ready yet.
 */
const getMusicKit = (): any | null => {
  if (typeof window !== 'undefined' && (window as any).MusicKit) {
    return (window as any).MusicKit.getInstance();
  }
  return null;
};

/**
 * artworkUrl - Converts an Apple Music artwork URL template to a real URL.
 * Apple returns URLs like: https://…/{w}x{h}bb.jpg — we fill in the size.
 */
const artworkUrl = (url: string | undefined, size = 300): string => {
  if (!url) return '';
  return url.replace('{w}', String(size)).replace('{h}', String(size));
};

/**
 * appleSongToSpotifyTrack - Maps an Apple Music song object to the app's
 * internal SpotifyTrack shape so the rest of the UI needs zero changes.
 *
 * Think of this like a "translator" between two languages —
 * Apple calls things "songs", the app calls them "tracks".
 */
const appleSongToSpotifyTrack = (song: any): SpotifyTrack => {
  const attr = song.attributes || {};
  return {
    id: song.id,
    name: attr.name || 'Unknown Title',
    // We use the Apple catalog ID as the URI — the playback engine will
    // pass these IDs straight to MusicKit's setQueue({ songs: [...] })
    uri: song.id,
    artists: [{ name: attr.artistName || 'Unknown Artist', id: attr.artistName || '' }],
    album: {
      name: attr.albumName || '',
      id: attr.albumName || '',
      images: [{ url: artworkUrl(attr.artwork?.url) }],
      release_date: attr.releaseDate,
    },
    duration_ms: attr.durationInMillis,
    is_playable: attr.playParams !== undefined,
  };
};

// ─────────────────────────────────────────────
//  Apple Music REST API helper
//  MusicKit JS exposes music.api for catalogue requests.
//  For library requests (user's own songs/playlists) we
//  use music.api.library which requires the user token.
// ─────────────────────────────────────────────

/**
 * appleApiRequest - Makes a paginated request to the Apple Music API
 * through MusicKit's built-in api object (handles auth headers for us).
 *
 * @param path     - API path e.g. '/v1/me/library/playlists'
 * @param params   - Query params e.g. { limit: 100 }
 * @param paginate - If true, keeps fetching until all pages are retrieved
 */
const appleApiRequest = async (
  path: string,
  params: Record<string, any> = {},
  paginate = false
): Promise<any[]> => {
  const music = getMusicKit();
  if (!music) throw new Error('MusicKit not initialized');

  const results: any[] = [];
  let nextUrl: string | null = path;

  do {
    // MusicKit's api.music() handles auth tokens automatically
    const response = await music.api.music(nextUrl, params);
    const data = response?.data;

    if (data?.data) {
      results.push(...data.data);
    }

    // Apple paginates via a "next" cursor in the response
    nextUrl = paginate && data?.next ? data.next : null;
    // After first request, params are baked into the next URL already
    params = {};
  } while (nextUrl);

  return results;
};

// ─────────────────────────────────────────────
//  AppleMusicProvider
// ─────────────────────────────────────────────

export class AppleMusicProvider implements IMusicProvider {

  constructor() {
    appleMusicService.configure();
  }

  // ── Auth ──────────────────────────────────

  async authorize(): Promise<void> {
    await appleMusicService.login();
  }

  unauthorize(): void {
    getMusicKit()?.unauthorize();
  }

  async getAccountDetails(): Promise<SpotifyUser | null> {
    const music = getMusicKit();
    if (!music?.isAuthorized) return null;

    // MusicKit v3 doesn't expose a full profile endpoint via JS,
    // so we return a consistent shape the rest of the app expects.
    return {
      display_name: 'Apple Music',
      id: 'apple_subscriber',
      images: [],
      country: music.storefrontId || 'US',
    };
  }

  // ── Playback ──────────────────────────────

  /**
   * play - Loads a list of Apple Music catalog IDs into the queue and starts playback.
   * Apple uses catalog song IDs (e.g. "1234567890") — not URIs like Spotify.
   */
  async play(uris: string[], index: number = 0): Promise<void> {
    const music = getMusicKit();
    if (!music) throw new Error('MusicKit not initialized');

    await music.setQueue({ songs: uris, startPosition: index });
    await music.play();
  }

  async setPlaybackState(state: 'play' | 'pause' | 'next' | 'previous'): Promise<void> {
    const music = getMusicKit();
    if (!music) return;

    switch (state) {
      case 'play':     await music.play(); break;
      case 'pause':    await music.pause(); break;
      case 'next':     await music.skipToNextItem(); break;
      case 'previous': await music.skipToPreviousItem(); break;
    }
  }

  /**
   * getPlaybackStatus - Returns the current playback state in the same shape
   * the NowPlayingStrip component already knows how to read.
   * We map Apple's property names → Spotify-shaped object so the UI stays untouched.
   */
  async getPlaybackStatus(): Promise<any> {
    const music = getMusicKit();
    if (!music) return null;

    const item = music.nowPlayingItem;

    return {
      is_playing: music.isPlaying,
      progress_ms: (music.currentPlaybackTime || 0) * 1000,
      currently_playing_type: 'track',
      item: item
        ? {
            id: item.id,
            name: item.title,
            uri: item.id,
            duration_ms: item.playbackDuration * 1000,
            artists: [{ name: item.artistName }],
            album: {
              name: item.albumName,
              images: [{ url: artworkUrl(item.artworkURL) }],
            },
          }
        : null,
      device: { name: 'Apple Music', is_active: true },
    };
  }

  // ── Track Fetching ────────────────────────

  /**
   * getTracks - The main data-fetching method.
   * This replaces all the Spotify playlist/library calls.
   *
   * sourceId can be:
   *   'liked_songs'          → user's full Apple Music library (Recently Added + all songs)
   *   'shazam_tracks'        → the special Shazam auto-playlist Apple syncs for you
   *   'artist_radio:<id>'    → generates an artist station (used for A7X Radio)
   *   any Apple playlist ID  → fetches tracks from that specific library playlist
   */
  async getTracks(sourceId: string, limit: number = 100): Promise<SpotifyTrack[]> {
    try {

      // ── 1. Liked Songs = full Apple Music Library ──
      if (sourceId === 'liked_songs') {
        return await this._getLibrarySongs(limit);
      }

      // ── 2. Shazam Playlist ──
      // Apple syncs your Shazam history as a real library playlist automatically.
      // We search your library playlists for the one named "Shazam Discoveries".
      if (sourceId === 'shazam_tracks') {
        return await this._getShazamTracks(limit);
      }

      // ── 3. Artist Radio / Station ──
      // Format: 'artist_radio:ARTIST_ID'
      // Used for A7X Radio — generates a station seeded by the artist.
      if (sourceId.startsWith('artist_radio:')) {
        const artistId = sourceId.replace('artist_radio:', '');
        return await this._getArtistRadioTracks(artistId, limit);
      }

      // ── 4. Library Playlist by ID ──
      // For 90sAltRock, OGRap&HipHop, etc. — point these at
      // your Apple Music library playlist IDs (set in Settings).
      return await this._getLibraryPlaylistTracks(sourceId, limit);

    } catch (err: any) {
      console.error(`[AppleMusicProvider] getTracks failed for "${sourceId}":`, err.message);
      return [];
    }
  }

  // ── Private Fetch Helpers ─────────────────

  /** Fetches the user's full song library (equivalent to Spotify "Liked Songs") */
  private async _getLibrarySongs(limit: number): Promise<SpotifyTrack[]> {
    const songs = await appleApiRequest(
      '/v1/me/library/songs',
      { limit: Math.min(limit, 100) }, // Apple max per page is 100
      true // paginate to get all
    );
    return songs.map(appleSongToSpotifyTrack);
  }

  /**
   * Finds the Shazam playlist in the user's library.
   * Apple automatically creates and syncs a playlist called "Shazam Discoveries"
   * when you have Shazam linked to Apple Music — no manual setup needed.
   */
  private async _getShazamTracks(limit: number): Promise<SpotifyTrack[]> {
    // Fetch all user library playlists and find the Shazam one
    const playlists = await appleApiRequest(
      '/v1/me/library/playlists',
      { limit: 100 },
      true
    );

    const shazamPlaylist = playlists.find(
      (p: any) =>
        p.attributes?.name?.toLowerCase().includes('shazam') ||
        p.attributes?.name?.toLowerCase().includes('shazam discoveries')
    );

    if (!shazamPlaylist) {
      console.warn('[AppleMusicProvider] Shazam playlist not found in library.');
      return [];
    }

    return await this._getLibraryPlaylistTracks(shazamPlaylist.id, limit);
  }

  /** Fetches tracks from a specific library playlist by its Apple Music ID */
  private async _getLibraryPlaylistTracks(playlistId: string, limit: number): Promise<SpotifyTrack[]> {
    const tracks = await appleApiRequest(
      `/v1/me/library/playlists/${playlistId}/tracks`,
      { limit: Math.min(limit, 100) },
      true
    );
    return tracks.map(appleSongToSpotifyTrack);
  }

  /**
   * Generates an artist radio station and returns its tracks.
   * This is the Apple Music equivalent of Spotify's artist radio —
   * it returns a mix of the artist's songs plus similar artists.
   */
  private async _getArtistRadioTracks(artistId: string, limit: number): Promise<SpotifyTrack[]> {
    try {
      // Apple Music artist stations use this catalog endpoint
      const music = getMusicKit();
      if (!music) return [];

      const storefront = music.storefrontId || 'us';

      // Get the artist's top songs first as the core of the station
      const topSongs = await appleApiRequest(
        `/v1/catalog/${storefront}/artists/${artistId}/view/top-songs`,
        { limit: Math.min(limit, 30) }
      );

      // Then get Apple Music's "similar artists" to round out the mix
      const similarArtists = await appleApiRequest(
        `/v1/catalog/${storefront}/artists/${artistId}/view/similar-artists`,
        { limit: 5 }
      );

      // Pull top songs from each similar artist
      const similarSongs: any[] = [];
      for (const artist of similarArtists.slice(0, 3)) {
        try {
          const songs = await appleApiRequest(
            `/v1/catalog/${storefront}/artists/${artist.id}/view/top-songs`,
            { limit: 10 }
          );
          similarSongs.push(...songs);
        } catch {
          // Skip if a similar artist lookup fails — not critical
        }
      }

      // Combine: mostly artist songs, sprinkled with similar artists
      const combined = [...topSongs, ...similarSongs].slice(0, limit);
      return combined.map(appleSongToSpotifyTrack);

    } catch (err: any) {
      console.error('[AppleMusicProvider] Artist radio fetch failed:', err.message);
      return [];
    }
  }

  // ── Library Management ────────────────────

  /**
   * createContainer - Creates a new playlist in the user's Apple Music library.
   * This replaces Spotify's createPlaylist functionality.
   */
  async createContainer(name: string, description?: string): Promise<any> {
    const music = getMusicKit();
    if (!music) throw new Error('MusicKit not initialized');

    const response = await music.api.music('/v1/me/library/playlists', {}, {
      fetchOptions: {
        method: 'POST',
        body: JSON.stringify({
          attributes: {
            name,
            description: description || 'Created by GetReady',
          },
        }),
      },
    });

    const playlist = response?.data?.data?.[0];
    if (!playlist) throw new Error('Failed to create Apple Music playlist');

    return { id: playlist.id, name };
  }

  /**
   * toggleFavorite - Adds or removes a song from the user's Apple Music library.
   * In Apple Music, "liking" a song means adding it to your library.
   * The equivalent of Spotify's heart/like.
   */
  async toggleFavorite(id: string, state: boolean): Promise<void> {
    const music = getMusicKit();
    if (!music) return;

    if (state) {
      // Add to library
      await music.api.music(
        '/v1/me/library',
        { 'ids[songs]': id },
        { fetchOptions: { method: 'POST' } }
      );
    } else {
      // Apple Music API does not support removing individual songs from library
      // via MusicKit JS (it's a known limitation). We log and skip gracefully.
      console.warn(
        '[AppleMusicProvider] Removing songs from Apple Music library is not supported via MusicKit JS.'
      );
    }
  }

  // ── Devices ───────────────────────────────

  /**
   * getOutputDevices - Apple Music handles audio routing through the OS
   * (AirPlay, Bluetooth, etc.) — not through the web API.
   * We return a single "current device" entry so the UI doesn't break.
   */
  async getOutputDevices(): Promise<SpotifyDevice[]> {
    return [
      {
        id: 'apple_local',
        is_active: true,
        name: 'Apple Music',
        type: 'Computer',
        volume_percent: 100,
        is_private_session: false,
        is_restricted: false,
      },
    ];
  }

  /**
   * transfer - Device transfer is handled by the OS via AirPlay.
   * Not controllable through MusicKit JS, so we no-op gracefully.
   */
  async transfer(_deviceId: string): Promise<void> {
    console.info('[AppleMusicProvider] Device transfer managed by OS/AirPlay.');
  }

  // ── Utility (used by ResourceResolver equivalent) ──

  /**
   * searchCatalog - Searches Apple Music's catalog by term.
   * Used to resolve artist IDs (e.g. finding Avenged Sevenfold's Apple ID).
   * Call this from the new AppleResourceResolver when we build it.
   */
  async searchCatalog(
    term: string,
    types: string = 'artists,songs',
    limit: number = 5
  ): Promise<any> {
    const music = getMusicKit();
    if (!music) return null;

    const storefront = music.storefrontId || 'us';
    const results = await appleApiRequest(
      `/v1/catalog/${storefront}/search`,
      { term, types, limit }
    );
    return results;
  }

  /**
   * getUserLibraryPlaylists - Returns all of the user's library playlists.
   * This will power the new Settings screen where you pick your Apple Music
   * source playlists (replaces the Spotify playlist resolver).
   */
  async getUserLibraryPlaylists(): Promise<{ id: string; name: string }[]> {
    const playlists = await appleApiRequest(
      '/v1/me/library/playlists',
      { limit: 100 },
      true
    );

    return playlists.map((p: any) => ({
      id: p.id,
      name: p.attributes?.name || 'Unnamed Playlist',
    }));
  }
}