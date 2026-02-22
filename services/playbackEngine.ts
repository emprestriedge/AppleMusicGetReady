/**
 * playbackEngine.ts — Apple Music Edition
 */

import {
  RunOption,
  RuleSettings,
  RunResult,
  Track,
  RunOptionType,
  SpotifyTrack,
} from '../types';
import { musicProvider } from './musicProvider';
import { configStore } from './configStore';
import { BlockStore } from './blockStore';
import { CooldownStore } from './cooldownStore';
import { apiLogger } from './apiLogger';
import {
  USE_MOCK_DATA,
  MOCK_TRACKS,
  A7X_CORE_ARTIST,
  A7X_SIMILAR_BANDS,
  MOOD_ZONES,
  DISCOVERY_ZONES,
  DISCOVERY_SEEDS_ZEN,
  DISCOVERY_SEEDS_MID,
  DISCOVERY_SEEDS_CHAOS,
} from '../constants';

export interface PlaybackEngine {
  generateRunResult(option: RunOption, rules: RuleSettings): Promise<RunResult>;
}

interface MoodRecipe {
  liked: number;
  shazam: number;
  acoustic: number;
  a7xCore: number;
  a7xSimilar: number;
  rap: number;
  discovery: number;
}

const calculateMoodRecipe = (
  moodLevel: number,
  playlistLength: number,
  discoverLevel: number
): MoodRecipe => {
  const mood = Math.max(0, Math.min(1, moodLevel));
  const discoveryCount = discoverLevel <= DISCOVERY_ZONES.ZERO_CUTOFF
    ? 0
    : Math.round(playlistLength * discoverLevel * 0.4);
  const sourceTotal = playlistLength - discoveryCount;

  const likedWeight     = Math.max(0, 1 - mood * 1.2);
  const acousticWeight  = Math.max(0, 1 - mood * 1.5);
  const shazamWeight    = 0.3 + Math.sin(mood * Math.PI) * 0.4;
  const a7xCoreWeight   = 0.35;
  const a7xSimilarWeight = mood * 0.9;
  const rapWeight       = Math.max(0, (mood - 0.4) * 2.0);

  const totalWeight = likedWeight + acousticWeight + shazamWeight + a7xCoreWeight + a7xSimilarWeight + rapWeight;
  const allocate = (w: number) => totalWeight > 0 ? Math.round((w / totalWeight) * sourceTotal) : 0;

  const liked    = allocate(likedWeight);
  const acoustic = allocate(acousticWeight);
  const shazam   = allocate(shazamWeight);
  const a7xCore  = allocate(a7xCoreWeight);
  const a7xSim   = allocate(a7xSimilarWeight);
  const rap      = allocate(rapWeight);
  const allocated = liked + acoustic + shazam + a7xCore + a7xSim + rap;
  const drift = sourceTotal - allocated;

  return { liked: liked + drift, shazam, acoustic, a7xCore, a7xSimilar: a7xSim, rap, discovery: discoveryCount };
};

// ─────────────────────────────────────────────
//  Track shape normalizer
//  Apple Music tracks come back flat (artistName, albumName, imageUrl)
//  Spotify tracks have nested objects (artists[], album.name, album.images[])
//  This handles both so the UI never crashes.
// ─────────────────────────────────────────────
const normalizeTrack = (t: SpotifyTrack, isNew = false): Track => ({
  id: t.id,
  uri: t.uri || t.id,
  title: (t as any).title || t.name || 'Unknown',
  artist: t.artists
    ? t.artists.map((a: any) => a.name).join(', ')
    : (t as any).artist || (t as any).artistName || 'Unknown Artist',
  album: t.album?.name || (t as any).album || (t as any).albumName || '',
  imageUrl: t.album?.images?.[0]?.url || (t as any).imageUrl || '',
  durationMs: t.duration_ms || (t as any).durationMs || 0,
  isNew,
});

export class AppleMusicPlaybackEngine implements PlaybackEngine {

  private shuffleArray<T>(array: T[]): T[] {
    const a = [...array];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private trackFilter = (t: SpotifyTrack): boolean =>
    !t.is_local &&
    t.is_playable !== false &&
    !BlockStore.isBlocked(t.id) &&
    (!CooldownStore.isRestricted(t.id) || USE_MOCK_DATA);

  private take(pool: SpotifyTrack[], n: number): SpotifyTrack[] {
    return this.shuffleArray(pool).slice(0, n);
  }

  private dedup(pool: SpotifyTrack[], existing: SpotifyTrack[]): SpotifyTrack[] {
    const ids = new Set(existing.map(t => t.id));
    return pool.filter(t => !ids.has(t.id));
  }

  private mapToRunResult(
    option: RunOption,
    tracks: SpotifyTrack[],
    sourceSummary: string,
    discoveryTracks: SpotifyTrack[] = [],
    warning?: string
  ): RunResult {
    const discoveryIds = new Set(discoveryTracks.map(d => d.id));
    return {
      runType: RunOptionType.MUSIC,
      optionName: option.name,
      createdAt: new Date().toISOString(),
      playlistName: option.name + " • " + new Date().toLocaleDateString(),
      tracks: tracks.map(t => normalizeTrack(t, discoveryIds.has(t.id))),
      sourceSummary,
      debugSummary: sourceSummary,
      warning,
    };
  }

  async generateRunResult(option: RunOption, rules: RuleSettings): Promise<RunResult> {
    if (USE_MOCK_DATA) return this.generateMockResult(option, rules);
    if (option.type === RunOptionType.PODCAST) return this.generatePodcastResult(option);

    const totalTarget = rules.playlistLength || 35;
    apiLogger.logClick(`Engine [BUILD]: ${option.name} | mood=${rules.moodLevel?.toFixed(2)} discover=${rules.discoverLevel?.toFixed(2)} length=${totalTarget}`);

    // ── Individual Source Buttons ──
    // These go directly to getTracks — no Smart Mix logic needed
    if (['liked_songs', 'shazam_tracks', 'acoustic_rock', 'rap_hiphop'].includes(option.id)) {
      return this.generateSingleSourceResult(option, rules);
    }
    if (option.id === 'a7x_deep') {
      return this.generateA7XStationResult(option, rules, 1.0);
    }

    // ── Smart Mix Modes ──
    const effectiveMood = option.id === 'lightning_mix' ? Math.random() : (rules.moodLevel ?? 0.5);
    return this.generateSmartMixResult(option, rules, effectiveMood, totalTarget);
  }

  private async generateSmartMixResult(
    option: RunOption,
    rules: RuleSettings,
    moodLevel: number,
    totalTarget: number
  ): Promise<RunResult> {
    const recipe = calculateMoodRecipe(moodLevel, totalTarget, rules.discoverLevel ?? 0.25);

    apiLogger.logClick(
      `SmartMix recipe: liked=${recipe.liked} acoustic=${recipe.acoustic} shazam=${recipe.shazam} ` +
      `a7xCore=${recipe.a7xCore} a7xSim=${recipe.a7xSimilar} rap=${recipe.rap} discovery=${recipe.discovery}`
    );

    const [likedPool, shazamPool, acousticPool, rapPool] = await Promise.all([
      musicProvider.getTracks('liked_songs', 200).then(t => t.filter(this.trackFilter)),
      musicProvider.getTracks('shazam_tracks', 100).then(t => t.filter(this.trackFilter)),
      musicProvider.getTracks('acoustic_rock', 150).then(t => t.filter(this.trackFilter)),
      musicProvider.getTracks('rap_hiphop', 200).then(t => t.filter(this.trackFilter)),
    ]);

    const similarIntensity = moodLevel;
    const a7xPool = await this.fetchA7XStation(rules, similarIntensity);

    let discoveryTracks: SpotifyTrack[] = [];
    if (recipe.discovery > 0 && rules.discoverLevel > DISCOVERY_ZONES.ZERO_CUTOFF) {
      discoveryTracks = await this.fetchDiscoveryTracks(
        moodLevel,
        rules.discoverLevel,
        recipe.discovery,
        [...likedPool, ...shazamPool]
      );
    }

    const selection = {
      liked:      this.take(likedPool, recipe.liked),
      shazam:     this.take(shazamPool, recipe.shazam),
      acoustic:   this.take(acousticPool, recipe.acoustic),
      a7xCore:    this.take(a7xPool.core, recipe.a7xCore),
      a7xSimilar: this.take(a7xPool.similar, recipe.a7xSimilar),
      rap:        this.take(rapPool, recipe.rap),
      discovery:  discoveryTracks.slice(0, recipe.discovery),
    };

    const sourceQueues = [
      selection.liked, selection.acoustic, selection.shazam,
      selection.a7xCore, selection.a7xSimilar, selection.rap, selection.discovery,
    ];

    const resultTracks: SpotifyTrack[] = [];
    let anyAdded = true;
    while (resultTracks.length < totalTarget && anyAdded) {
      anyAdded = false;
      for (const queue of sourceQueues) {
        if (queue.length === 0) continue;
        const track = queue.shift()!;
        if (!resultTracks.find(r => r.id === track.id)) {
          resultTracks.push(track);
          anyAdded = true;
        }
        if (resultTracks.length >= totalTarget) break;
      }
    }

    let warning: string | undefined;
    if (resultTracks.length < totalTarget) {
      const needed = totalTarget - resultTracks.length;
      const fallbackPool = this.dedup(
        this.shuffleArray([...likedPool, ...shazamPool, ...acousticPool, ...rapPool, ...a7xPool.core]),
        resultTracks
      );
      resultTracks.push(...fallbackPool.slice(0, needed));
      warning = `Some sources were limited. Added ${Math.min(needed, fallbackPool.length)} fallback tracks.`;
    }

    if (resultTracks.length > 0) CooldownStore.markUsed(resultTracks.map(t => t.id));

    const modeName = option.id === 'lightning_mix'
      ? `Lightning ⚡️ (Mood: ${Math.round(moodLevel * 100)}%)`
      : option.name;

    const summary =
      `Liked ${selection.liked.length} • ` +
      `90sAltRock ${selection.acoustic.length} • ` +
      `Shazam ${selection.shazam.length} • ` +
      `A7X ${selection.a7xCore.length + selection.a7xSimilar.length} • ` +
      `Rap ${selection.rap.length} • ` +
      `New ${selection.discovery.length}`;

    return this.mapToRunResult(
      { ...option, name: modeName },
      resultTracks.slice(0, totalTarget),
      summary,
      discoveryTracks,
      warning
    );
  }

  private async fetchA7XStation(
    rules: RuleSettings,
    similarIntensity: number
  ): Promise<{ core: SpotifyTrack[]; similar: SpotifyTrack[] }> {
    // Use getTracks with a7x_deep which handles catalog search
    const corePool = await musicProvider
      .getTracks('a7x_deep', 80)
      .then(t => t.filter(this.trackFilter))
      .catch(() => []);

    return { core: corePool, similar: [] };
  }

  private async fetchDiscoveryTracks(
    moodLevel: number,
    discoverLevel: number,
    count: number,
    knownTracks: SpotifyTrack[]
  ): Promise<SpotifyTrack[]> {
    try {
      const music = (window as any).MusicKit?.getInstance();
      if (!music) return [];
      const storefront = music.storefrontId || 'us';
      const isFamiliar = discoverLevel <= DISCOVERY_ZONES.FAMILIAR_MAX;

      let pools: any[][] = [];

      if (isFamiliar) {
        const seedArtists = [
          ...new Set(
            knownTracks.slice(0, 20)
              .map(t => t.artists?.[0]?.name || (t as any).artistName || (t as any).artist)
              .filter(Boolean)
          )
        ].slice(0, 5) as string[];

        pools = await Promise.all(
          seedArtists.map(async artist => {
            try {
              const encoded = encodeURIComponent(artist);
              const response = await music.api.music(
                `/v1/catalog/${storefront}/search?term=${encoded}&types=songs&limit=10`
              );
              return response?.data?.results?.songs?.data || [];
            } catch { return []; }
          })
        );
      } else {
        const seeds = moodLevel < MOOD_ZONES.ZEN_MAX
          ? DISCOVERY_SEEDS_ZEN
          : moodLevel < MOOD_ZONES.FOCUS_MAX
          ? DISCOVERY_SEEDS_MID
          : DISCOVERY_SEEDS_CHAOS;

        const wildness = (discoverLevel - 0.5) * 2;
        const seedCount = Math.ceil(1 + wildness * (seeds.length - 1));
        const selectedSeeds = seeds.slice(0, seedCount);

        pools = await Promise.all(
          selectedSeeds.map(async seed => {
            try {
              const encoded = encodeURIComponent(seed);
              const perSeed = Math.ceil(count / selectedSeeds.length) + 5;
              const response = await music.api.music(
                `/v1/catalog/${storefront}/search?term=${encoded}&types=songs&limit=${perSeed}`
              );
              return response?.data?.results?.songs?.data || [];
            } catch { return []; }
          })
        );
      }

      const knownIds = new Set(knownTracks.map(t => t.id));
      return this.shuffleArray(pools.flat())
        .filter((t: any) => !knownIds.has(t.id))
        .slice(0, count)
        .map((t: any) => ({
          id: t.id,
          name: t.attributes?.name || '',
          uri: t.id,
          artist: t.attributes?.artistName || '',
          artistName: t.attributes?.artistName || '',
          album: t.attributes?.albumName || '',
          albumName: t.attributes?.albumName || '',
          imageUrl: t.attributes?.artwork?.url?.replace('{w}', '300').replace('{h}', '300') || '',
          duration_ms: t.attributes?.durationInMillis || 0,
          is_playable: !!t.attributes?.playParams,
        }));
    } catch (err: any) {
      apiLogger.logError(`Discovery fetch failed: ${err.message}`);
      return [];
    }
  }

  // ── Individual source handler ──
  // All source buttons now go directly through getTracks using their button ID
  private async generateSingleSourceResult(
    option: RunOption,
    rules: RuleSettings
  ): Promise<RunResult> {
    const totalTarget = rules.playlistLength || 35;

    const pool = await musicProvider
      .getTracks(option.id, totalTarget * 4)
      .then(t => t.filter(this.trackFilter));

    const tracks = this.take(pool, totalTarget);

    let warning: string | undefined;
    if (tracks.length === 0) {
      throw new Error(`No tracks found for ${option.name}. Check that your playlists transferred to Apple Music.`);
    }
    if (tracks.length < totalTarget) {
      warning = `Only ${tracks.length} tracks available from ${option.name}.`;
    }

    if (tracks.length > 0) CooldownStore.markUsed(tracks.map(t => t.id));
    return this.mapToRunResult(option, tracks, `${option.name}: ${tracks.length} tracks`, [], warning);
  }

  private async generateA7XStationResult(
    option: RunOption,
    rules: RuleSettings,
    intensity: number
  ): Promise<RunResult> {
    const totalTarget = rules.playlistLength || 35;
    const pool = await musicProvider
      .getTracks('a7x_deep', totalTarget * 3)
      .then(t => t.filter(this.trackFilter));

    if (pool.length === 0) {
      throw new Error('Could not find A7X or similar artist tracks in the Apple Music catalog.');
    }

    const tracks = this.take(pool, totalTarget);
    if (tracks.length > 0) CooldownStore.markUsed(tracks.map(t => t.id));

    return this.mapToRunResult(option, tracks, `A7X Radio: ${tracks.length} tracks`);
  }

  private async fetchRapPool(): Promise<SpotifyTrack[]> {
    return musicProvider.getTracks('rap_hiphop', 300).then(t => t.filter(this.trackFilter)).catch(() => []);
  }

  private async generatePodcastResult(option: RunOption): Promise<RunResult> {
    return {
      runType: RunOptionType.PODCAST,
      optionName: option.name,
      createdAt: new Date().toISOString(),
      playlistName: option.name,
      tracks: [],
      sourceSummary: `Apple Podcasts: ${option.name}`,
      debugSummary: `Deep link to Apple Podcasts for: ${option.name}`,
    };
  }

  private generateMockResult(option: RunOption, rules: RuleSettings): RunResult {
    const totalTarget = rules.playlistLength || 35;
    const moodLevel = option.id === 'lightning_mix' ? Math.random() : (rules.moodLevel ?? 0.5);
    const recipe = calculateMoodRecipe(moodLevel, totalTarget, rules.discoverLevel ?? 0.25);

    const tracks = this.shuffleArray([...MOCK_TRACKS, ...MOCK_TRACKS, ...MOCK_TRACKS])
      .slice(0, Math.min(totalTarget, MOCK_TRACKS.length));

    const modeName = option.id === 'lightning_mix'
      ? `Lightning ⚡️ (Mood: ${Math.round(moodLevel * 100)}%)`
      : option.name;

    const summary =
      `[DEMO] Liked ~${recipe.liked} • 90sAltRock ~${recipe.acoustic} • ` +
      `Shazam ~${recipe.shazam} • A7X ~${recipe.a7xCore + recipe.a7xSimilar} • ` +
      `Rap ~${recipe.rap} • New ~${recipe.discovery}`;

    return {
      runType: RunOptionType.MUSIC,
      optionName: modeName,
      createdAt: new Date().toISOString(),
      playlistName: modeName + " • Demo Mode",
      tracks: tracks.map(t => ({ ...t, isNew: Math.random() > 0.8 })),
      sourceSummary: summary,
      debugSummary: summary,
    };
  }

  static async playTrack(track: Track, allUris: string[], index: number): Promise<void> {
    await musicProvider.play(allUris, index);
  }
}

export const applePlaybackEngine = new AppleMusicPlaybackEngine();
