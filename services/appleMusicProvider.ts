import { IMusicProvider } from '../types/provider';
import { appleMusicService } from './appleMusicService';
import { SpotifyUser, SpotifyDevice, SpotifyTrack } from '../types';

// Helper to get MusicKit instance
const mk = () => (window as any).MusicKit?.getInstance();

// Helper to fetch all songs from a library playlist by name
async function fetchPlaylistTracks(music: any, playlistName: string): Promise<SpotifyTrack[]> {
  try {
    const response = await music.api.music('/v1/me/library/playlists?limit=100');
    const playlists = response?.data?.data || [];
    const match = playlists.find((p: any) =>
      p.attributes?.name?.toLowerCase() === playlistName.toLowerCase()
    );
    if (!match) {
      console.warn(`Playlist not found: ${playlistName}`);
      return [];
    }
    return await fetchTracksFromPlaylistId(music, match.id);
  } catch (err) {
    console.warn(`Error fetching playlist "${playlistName}":`, err);
    return [];
  }
}

// Helper to fetch all tracks from a playlist by its ID (handles pagination)
async function fetchTracksFromPlaylistId(music: any, playlistId: string): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = [];
  let url = `/v1/me/library/playlists/${playlistId}/tracks`;
  let offset = 0;
  const limit = 100;

  while (true) {
    try {
      const response = await music.api.music(`${url}?limit=${limit}&offset=${offset}`);
      const items = response?.data?.data || [];
      for (const item of items) {
        const attr = item.attributes || {};
        tracks.push({
          id: item.id,
          uri: item.id,
          name: attr.name || 'Unknown',
          artist: attr.artistName || 'Unknown Artist',
          artistName: attr.artistName || 'Unknown Artist',
          album: attr.albumName || '',
          albumName: attr.albumName || '',
          duration_ms: attr.durationInMillis || 0,
          explicit: attr.contentRating === 'explicit',
          imageUrl: attr.artwork
            ? attr.artwork.url.replace('{w}', '300').replace('{h}', '300')
            : undefined,
          playParams: attr.playParams || null,
        });
      }
      if (items.length < limit) break;
      offset += limit;
    } catch (err) {
      console.warn('Error paginating tracks:', err);
      break;
    }
  }
  return tracks;
}

// Helper to fetch from multiple playlists and combine
async function fetchFromMultiplePlaylists(music: any, names: string[]): Promise<SpotifyTrack[]> {
  const results = await Promise.all(names.map(name => fetchPlaylistTracks(music, name)));
  const combined = results.flat();
  // Deduplicate by track id
  const seen = new Set<string>();
  return combined.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

// Helper to fetch entire Apple Music library
async function fetchLibraryTracks(music: any): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    try {
      const response = await music.api.music(`/v1/me/library/songs?limit=${limit}&offset=${offset}`);
      const items = response?.data?.data || [];
      for (const item of items) {
        const attr = item.attributes || {};
        tracks.push({
          id: item.id,
          uri: item.id,
          name: attr.name || 'Unknown',
          artist: attr.artistName || 'Unknown Artist',
          artistName: attr.artistName || 'Unknown Artist',
          album: attr.albumName || '',
          albumName: attr.albumName || '',
          duration_ms: attr.durationInMillis || 0,
          explicit: attr.contentRating === 'explicit',
          imageUrl: attr.artwork
            ? attr.artwork.url.replace('{w}', '300').replace('{h}', '300')
            : undefined,
          playParams: attr.playParams || null,
        });
      }
      if (items.length < limit) break;
      offset += limit;
    } catch (err) {
      console.warn('Error fetching library songs:', err);
      break;
    }
  }
  return tracks;
}

// Helper to search Apple Music CATALOG by artist names (includes songs not in library)
async function fetchTracksByArtistsCatalog(music: any, artistNames: string[], storefront: string = 'us', limitPerArtist: number = 12): Promise<SpotifyTrack[]> {
  // Process in batches of 5 with a delay to avoid Apple's 429 rate limit
  const BATCH_SIZE = 5;
  const BATCH_DELAY_MS = 300;
  const allResults: SpotifyTrack[][] = [];

  for (let i = 0; i < artistNames.length; i += BATCH_SIZE) {
    const batch = artistNames.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(async (artist) => {
      try {
        const encodedArtist = encodeURIComponent(artist);
        const response = await fetch(
          `https://api.music.apple.com/v1/catalog/${storefront}/search?term=${encodedArtist}&types=songs&limit=${limitPerArtist}`,
          {
            headers: {
              'Authorization': `Bearer ${music.developerToken}`,
              'Music-User-Token': music.musicUserToken,
            },
          }
        );
        if (!response.ok) {
          console.warn(`Catalog search failed for "${artist}": ${response.status}`);
          return [];
        }
        const json = await response.json();
        const items = json?.results?.songs?.data || [];

        const artistLower = artist.toLowerCase();
        return items
          .filter((item: any) => {
            const songArtist = item.attributes?.artistName?.toLowerCase() || '';
            return songArtist.includes(artistLower) || artistLower.includes(songArtist.split('&')[0].trim());
          })
          .map((item: any) => {
            const attr = item.attributes || {};
            return {
              id: item.id,
              uri: item.id,
              name: attr.name || 'Unknown',
              artist: attr.artistName || 'Unknown Artist',
              artistName: attr.artistName || 'Unknown Artist',
              album: attr.albumName || '',
              albumName: attr.albumName || '',
              duration_ms: attr.durationInMillis || 0,
              explicit: attr.contentRating === 'explicit',
              imageUrl: attr.artwork
                ? attr.artwork.url.replace('{w}', '300').replace('{h}', '300')
                : undefined,
            };
          });
      } catch (err) {
        console.warn(`Error searching catalog for artist "${artist}":`, err);
        return [];
      }
    }));
    allResults.push(...batchResults);
    if (i + BATCH_SIZE < artistNames.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  const results = allResults;

  const combined = results.flat();
  const seen = new Set<string>();
  return combined.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

export class AppleMusicProvider implements IMusicProvider {

  constructor() {
    // configure is now called from App.tsx — no need to call it here
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
    const music = mk();
    if (!music || !music.isAuthorized) return null;
    return {
      display_name: 'Apple Music Subscriber',
      id: 'apple_subscriber',
      images: [],
      country: music.storefrontId || 'US',
    };
  }

  async play(uris: string[], index: number = 0): Promise<void> {
    const music = mk();
    if (!music) return;

    const descriptors = uris.map(id => ({
      id,
      kind: 'song',
      isLibrary: true,
    }));

    // setQueue always starts at position 0 internally.
    // To start at a specific index, we set the queue then skip to the right position.
    await music.setQueue({ items: descriptors });

    if (index > 0) {
      // skipToItem by index is more reliable than startPosition
      await music.changeToMediaAtIndex(index);
    }

    await music.play();
  }

  async setPlaybackState(state: 'play' | 'pause' | 'next' | 'previous'): Promise<void> {
    const music = mk();
    if (!music) return;
    switch (state) {
      case 'play':     await music.play(); break;
      case 'pause':    await music.pause(); break;
      case 'next':     await music.skipToNextItem(); break;
      case 'previous': await music.skipToPreviousItem(); break;
    }
  }

  async getPlaybackStatus(): Promise<any> {
    const music = mk();
    if (!music) return null;
    const nowPlaying = music.nowPlayingItem;
    return {
      isPlaying: music.isPlaying,
      currentTrack: nowPlaying ? {
        id: nowPlaying.id,
        uri: nowPlaying.id,
        name: nowPlaying.title,
        artistName: nowPlaying.artistName,
        albumName: nowPlaying.albumName,
        imageUrl: nowPlaying.artwork
          ? nowPlaying.artwork.url.replace('{w}', '300').replace('{h}', '300')
          : undefined,
      } : null,
    };
  }

  async getTracks(sourceId: string, limit: number = 50): Promise<SpotifyTrack[]> {
    const music = mk();
    if (!music || !music.isAuthorized) {
      console.warn('MusicKit not authorized');
      return [];
    }

    console.log(`[AppleMusicProvider] getTracks for: ${sourceId}`);

    let tracks: SpotifyTrack[] = [];

    switch (sourceId) {

      // ── Liked Songs → full Apple Music library ──
      case 'liked_songs':
        tracks = await fetchLibraryTracks(music);
        break;

      // ── Shazam History ──
      case 'shazam_tracks':
        tracks = await fetchPlaylistTracks(music, 'My Shazam Tracks');
        break;

      // ── 90s Alt Rock ──
      case 'acoustic_rock':
        tracks = await fetchFromMultiplePlaylists(music, [
          '90s Acoustic Alternative Rock',
          '90s AlterAcoustic',
        ]);
        break;

      // ── OG Rap & Hip-Hop ──
      case 'rap_hiphop':
        tracks = await fetchFromMultiplePlaylists(music, [
          'Best Rap & Hip-Hop 90s/00s',
          'I Love My 90s Hip-Hop',
          "80's & 90's Hip Hop / Rap",
          '2Pac - Greatest Hits',
          'Eminem All Songs',
        ]);
        break;

      // ── A7X Radio — A7X deep catalog + similar artists ──
      case 'a7x_deep': {
        const storefront = music.storefrontId || 'us';

        // A7X gets a much larger pull (40 tracks) to surface deep cuts
        // alongside the popular stuff — the whole catalog, not just hits
        const a7xTracks = await fetchTracksByArtistsCatalog(music,
          ['Avenged Sevenfold'], storefront, 40
        );

        // Similar artists get a standard pull (10 tracks each)
        const similarTracks = await fetchTracksByArtistsCatalog(music, [
          'Trivium',
          'Shinedown',
          'Seether',
          'Rage Against the Machine',
          'Spiritbox',
          'Atreyu',
          'Linkin Park',
          'Limp Bizkit',
          'Deftones',
          'Incubus',
          'Staind',
          'Sevendust',
          'Red Hot Chili Peppers',
          'Rob Zombie',
          'Stone Temple Pilots',
          'Bad Wolves',
          'System of a Down',
          'Breaking Benjamin',
          'Korn',
          'Five Finger Death Punch',
          'Bullet for My Valentine',
          'Disturbed',
          'Slipknot',
          'Volbeat',
          'Godsmack',
          'Three Days Grace',
          'Tool',
          'Alice in Chains',
          'Chevelle',
        ], storefront, 10);

        // Blend: roughly 40% A7X, 60% similar artists
        tracks = [...a7xTracks, ...similarTracks];
        break;
      }

      default:
        console.warn(`[AppleMusicProvider] Unknown sourceId: ${sourceId}`);
        tracks = [];
    }

    // Shuffle and limit
    const shuffled = tracks.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(limit * 3, shuffled.length));
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
    const music = mk();
    if (!music) throw new Error('MusicKit not initialized');
    if (!music.isAuthorized) throw new Error('Not authorized with Apple Music');

    // Use direct fetch — music.api.music() doesn't reliably support POST bodies
    const response = await fetch('https://api.music.apple.com/v1/me/library/playlists', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${music.developerToken}`,
        'Music-User-Token': music.musicUserToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        attributes: { name, description },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Playlist creation failed (${response.status}): ${text}`);
    }

    const json = await response.json();
    const playlist = json?.data?.[0];
    if (!playlist?.id) throw new Error('Playlist creation returned no ID');
    return { id: playlist.id, name };
  }

  async addTracksToPlaylist(playlistId: string, trackIds: string[]): Promise<void> {
    const music = mk();
    if (!music) throw new Error('MusicKit not initialized');

    const chunkSize = 100;
    for (let i = 0; i < trackIds.length; i += chunkSize) {
      const chunk = trackIds.slice(i, i + chunkSize).map(id => ({
        id,
        type: 'library-songs',
      }));

      const response = await fetch(`https://api.music.apple.com/v1/me/library/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${music.developerToken}`,
          'Music-User-Token': music.musicUserToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: chunk }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Add tracks failed (${response.status}): ${text}`);
      }
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
    console.log(`Track ${trackId} un-gemmed. Remove manually in Apple Music if needed.`);
  }

  async toggleFavorite(id: string, state: boolean): Promise<void> {
    const music = mk();
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
// This is a placeholder - we need to replace the a7x section
