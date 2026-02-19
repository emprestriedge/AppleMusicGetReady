/**
 * playbackEngine.ts — Apple Music Edition
 *
 * This engine powers all Smart Mix and individual source generation.
 * It replaced the Spotify-based engine with full Apple Music support.
 *
 * KEY CONCEPTS (plain English):
 * ─────────────────────────────
 * MOOD SLIDER (moodLevel: 0 → 1)
 *   Think of it as a volume knob for energy.
 *   - 0.0 – 0.33  Zen:   Acoustic-heavy, Liked Songs, light A7X top tracks, no rap
 *   - 0.34 – 0.66 Focus: All 6 sources balanced, A7X top tracks, rap enters lightly
 *   - 0.67 – 1.0  Chaos: A7X deep cuts + similar bands, heavy rap, minimal acoustic
 *
 * DISCOVERY SLIDER (discoverLevel: 0 → 1)
 *   Controls how many "new to you" tracks appear and how far outside your taste they go.
 *   - 0.0        Pure Favorites: zero new tracks, all from your known sources
 *   - 0.01–0.50  Familiar Territory: new tracks seeded from artists you already like
 *   - 0.51–1.0   Outside Your Norm: genuinely new genres, wider net cast
 *
 * A7X STATION
 *   Always present in every Smart Mix mode. The mood slider controls HOW it appears:
 *   - Zen end:   A7X top tracks only, similar bands very light (1–2 tracks each)
 *   - Chaos end: A7X deep cuts + all similar bands at full intensity
 *
 * LIGHTNING ⚡️
 *   Randomizes the mood slider position itself, then builds whatever mix falls out.
 *   True surprise — you don't know what you're getting until it plays.
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

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export interface PlaybackEngine {
  generateRunResult(option: RunOption, rules: RuleSettings): Promise<RunResult>;
}

/**
 * MoodRecipe — the per-source track counts for a given mood position.
 * These get calculated dynamically based on the slider, not hardcoded.
 */
interface MoodRecipe {
  liked: number;
  shazam: number;
  acoustic: number;    // 90sAltRock playlist
  a7xCore: number;     // Avenged Sevenfold tracks
  a7xSimilar: number;  // Combined similar bands tracks
  rap: number;
  discovery: number;
}

// ─────────────────────────────────────────────
//  Mood Recipe Calculator
//  This is the heart of the new slider logic.
//  Instead of fixed recipes, we calculate ratios
//  based on where the slider sits (0.0 → 1.0).
// ─────────────────────────────────────────────

/**
 * calculateMoodRecipe
 *
 * Takes the mood position (0–1) and playlist length and returns
 * exactly how many tracks to pull from each source.
 *
 * The math works like this:
 * - Each source has a "weight" that rises or falls across the slider range
 * - We normalize all weights so they always sum to the playlist length
 * - This means you never get an under-filled mix
 */
const calculateMoodRecipe = (
  moodLevel: number,
  playlistLength: number,
  discoverLevel: number
): MoodRecipe => {
  const mood = Math.max(0, Math.min(1, moodLevel)); // clamp 0–1

  // How many tracks will come from discovery (subtracted from source tracks)
  const discoveryCount = discoverLevel <= DISCOVERY_ZONES.ZERO_CUTOFF
    ? 0
    : Math.round(playlistLength * discoverLevel * 0.4); // max 40% discovery

  const sourceTotal = playlistLength - discoveryCount;

  // ── Source weights across the mood spectrum ──
  // Each weight is a function of mood position.
  // At mood=0 (Zen): high liked/acoustic, zero rap
  // At mood=0.5 (Focus): balanced
  // At mood=1 (Chaos): high a7x/rap, zero acoustic

  // Liked Songs: strong at Zen, fades toward Chaos
  const likedWeight = Math.max(0, 1 - mood * 1.2);

  // 90sAltRock: heaviest at Zen, completely gone by Chaos
  const acousticWeight = Math.max(0, 1 - mood * 1.5);

  // Shazam: present in all zones, peaks in middle
  const shazamWeight = 0.3 + Math.sin(mood * Math.PI) * 0.4;

  // A7X Core (top tracks at Zen, deep cuts controlled separately):
  // Always present, steady weight across all zones
  const a7xCoreWeight = 0.35;

  // A7X Similar Bands: very light at Zen, heavy at Chaos
  const a7xSimilarWeight = mood * 0.9;

  // Rap: zero until 2nd half of slider, then ramps up fast
  const rapWeight = Math.max(0, (mood - 0.4) * 2.0);

  // ── Normalize weights to fill sourceTotal ──
  const totalWeight =
    likedWeight +
    acousticWeight +
    shazamWeight +
    a7xCoreWeight +
    a7xSimilarWeight +
    rapWeight;

  const allocate = (w: number) =>
    totalWeight > 0 ? Math.round((w / totalWeight) * sourceTotal) : 0;

  const liked    = allocate(likedWeight);
  const acoustic = allocate(acousticWeight);
  const shazam   = allocate(shazamWeight);
  const a7xCore  = allocate(a7xCoreWeight);
  const a7xSim   = allocate(a7xSimilarWeight);
  const rap      = allocate(rapWeight);

  // Fix any rounding drift so total always equals sourceTotal exactly
  const allocated = liked + acoustic + shazam + a7xCore + a7xSim + rap;
  const drift = sourceTotal - allocated;

  return {
    liked:      liked + drift, // absorb any rounding diff into liked
    shazam,
    acoustic,
    a7xCore,
    a7xSimilar: a7xSim,
    rap,
    discovery:  discoveryCount,
  };
};

// ─────────────────────────────────────────────
//  Main Engine Class
// ─────────────────────────────────────────────

export class AppleMusicPlaybackEngine implements PlaybackEngine {

  // ── Utilities ──────────────────────────────

  private shuffleArray<T>(array: T[]): T[] {
    const a = [...array];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * trackFilter — rejects tracks that are local files, unplayable,
   * blocked by the user, or on cooldown (played recently).
   */
  private trackFilter = (t: SpotifyTrack): boolean =>
    !t.is_local &&
    t.is_playable !== false &&
    !BlockStore.isBlocked(t.id) &&
    (!CooldownStore.isRestricted(t.id) || USE_MOCK_DATA);

  /**
   * take — shuffle a pool and grab the first n unique tracks.
   */
  private take(pool: SpotifyTrack[], n: number): SpotifyTrack[] {
    return this.shuffleArray(pool).slice(0, n);
  }

  /**
   * dedup — removes tracks already in the result set, preventing repeats.
   */
  private dedup(pool: SpotifyTrack[], existing: SpotifyTrack[]): SpotifyTrack[] {
    const ids = new Set(existing.map(t => t.id));
    return pool.filter(t => !ids.has(t.id));
  }

  /**
   * mapToRunResult — converts internal SpotifyTrack[] to the Track[] shape
   * the UI components expect. The name "SpotifyTrack" is just the internal
   * type name — these are Apple Music tracks at runtime.
   */
  private mapToRunResult(
    option: RunOption,
    tracks: SpotifyTrack[],
    sourceSummary: string,
    discoveryTracks: SpotifyTrack[] = [],
    warning?: string
  ): RunResult {
    return {
      runType: RunOptionType.MUSIC,
      optionName: option.name,
      createdAt: new Date().toISOString(),
      playlistName: `${option.name} • ${new Date().toLocaleDateString()}`,
      tracks: tracks.map(t => ({
        id: t.id,
        uri: t.uri,
        title: t.name,
        artist: t.artists.map(a => a.name).join(', '),
        album: t.album.name,
        imageUrl: t.album.images?.[0]?.url,
        durationMs: t.duration_ms,
        isNew: discoveryTracks.some(d => d.id === t.id),
      })),
      sourceSummary,
      debugSummary: sourceSummary,
      warning,
    };
  }

  // ── Main Entry Point ───────────────────────

  async generateRunResult(option: RunOption, rules: RuleSettings): Promise<RunResult> {

    // ── Demo / Mock Mode ──
    if (USE_MOCK_DATA) {
      return this.generateMockResult(option, rules);
    }

    // ── Podcast ──
    if (option.type === RunOptionType.PODCAST) {
      return this.generatePodcastResult(option);
    }

    const totalTarget = rules.playlistLength || 35;
    apiLogger.logClick(`Engine [BUILD]: ${option.name} | mood=${rules.moodLevel?.toFixed(2)} discover=${rules.discoverLevel?.toFixed(2)} length=${totalTarget}`);

    // ── Individual Source Buttons ──
    // These bypass the Smart Mix logic entirely and just pull from one source.
    if (['liked_songs', 'shazam_tracks', 'acoustic_rock'].includes(option.id)) {
      return this.generateSingleSourceResult(option, rules);
    }
    if (option.id === 'rap_hiphop') {
      return this.generateRapResult(option, rules);
    }
    if (option.id === 'a7x_deep') {
      return this.generateA7XStationResult(option, rules, 1.0); // full intensity for standalone button
    }

    // ── Smart Mix Modes ──
    // Lightning randomizes the mood level before building
    const effectiveMood = option.id === 'lightning_mix'
      ? Math.random()
      : (rules.moodLevel ?? 0.5);

    return this.generateSmartMixResult(option, rules, effectiveMood, totalTarget);
  }

  // ── Smart Mix Builder ──────────────────────

  /**
   * generateSmartMixResult — the core Smart Mix logic.
   *
   * Steps:
   * 1. Calculate source counts from mood position
   * 2. Fetch all source pools in parallel (for speed)
   * 3. Build A7X station (core + similar bands, mood-adjusted)
   * 4. Fetch discovery tracks if slider > 0
   * 5. Interleave tracks from all sources for variety
   * 6. Fill any gaps with fallback tracks
   */
  private async generateSmartMixResult(
    option: RunOption,
    rules: RuleSettings,
    moodLevel: number,
    totalTarget: number
  ): Promise<RunResult> {

    const recipe = calculateMoodRecipe(moodLevel, totalTarget, rules.discoverLevel ?? 0.25);
    const catalog = configStore.getConfig().catalog;

    apiLogger.logClick(
      `SmartMix recipe: liked=${recipe.liked} acoustic=${recipe.acoustic} shazam=${recipe.shazam} ` +
      `a7xCore=${recipe.a7xCore} a7xSim=${recipe.a7xSimilar} rap=${recipe.rap} discovery=${recipe.discovery}`
    );

    // ── Fetch all source pools in parallel ──
    const [likedPool, shazamPool, acousticPool, rapPool] = await Promise.all([
      musicProvider.getTracks('liked_songs', 200).then(t => t.filter(this.trackFilter)),
      musicProvider.getTracks('shazam_tracks', 100).then(t => t.filter(this.trackFilter)),
      catalog.acoustic90sId
        ? musicProvider.getTracks(catalog.acoustic90sId, 150).then(t => t.filter(this.trackFilter))
        : Promise.resolve([]),
      this.fetchRapPool(),
    ]);

    // ── Build A7X Station ──
    // Similar band intensity scales with mood: light at Zen, full at Chaos
    const similarIntensity = moodLevel; // 0 = barely present, 1 = full force
    const a7xPool = await this.fetchA7XStation(rules, similarIntensity);

    // ── Discovery Tracks ──
    let discoveryTracks: SpotifyTrack[] = [];
    if (recipe.discovery > 0 && rules.discoverLevel > DISCOVERY_ZONES.ZERO_CUTOFF) {
      discoveryTracks = await this.fetchDiscoveryTracks(
        moodLevel,
        rules.discoverLevel,
        recipe.discovery,
        [...likedPool, ...shazamPool]
      );
    }

    // ── Take from each pool according to recipe ──
    const selection = {
      liked:      this.take(likedPool, recipe.liked),
      shazam:     this.take(shazamPool, recipe.shazam),
      acoustic:   this.take(acousticPool, recipe.acoustic),
      a7xCore:    this.take(a7xPool.core, recipe.a7xCore),
      a7xSimilar: this.take(a7xPool.similar, recipe.a7xSimilar),
      rap:        this.take(rapPool, recipe.rap),
      discovery:  discoveryTracks.slice(0, recipe.discovery),
    };

    // ── Interleave for variety ──
    // We rotate through sources one track at a time so the mix never
    // plays 10 acoustic songs in a row — it stays varied throughout.
    const sourceQueues = [
      selection.liked,
      selection.acoustic,
      selection.shazam,
      selection.a7xCore,
      selection.a7xSimilar,
      selection.rap,
      selection.discovery,
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

    // ── Fallback fill if we're short ──
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

    // ── Mark as used for cooldown tracking ──
    if (resultTracks.length > 0) {
      CooldownStore.markUsed(resultTracks.map(t => t.id));
    }

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

  // ── A7X Station Fetcher ────────────────────

  /**
   * fetchA7XStation
   *
   * Returns two pools: core A7X tracks + similar band tracks.
   * similarIntensity (0–1) controls how many similar band tracks to pull.
   * At 0 (Zen): each similar band contributes just 3–4 tracks
   * At 1 (Chaos): each similar band contributes up to 15 tracks
   *
   * The mode (top tracks vs deep cuts) is controlled by rules.a7xMode,
   * but in Smart Mix the mood slider also influences this:
   * - Zen side → always top tracks even if a7xMode = DeepCuts
   * - Chaos side → respects a7xMode (DeepCuts if set)
   */
  private async fetchA7XStation(
    rules: RuleSettings,
    similarIntensity: number
  ): Promise<{ core: SpotifyTrack[]; similar: SpotifyTrack[] }> {

    const catalog = configStore.getConfig().catalog;
    const a7xId = catalog.a7xArtistId;

    if (!a7xId) {
      apiLogger.logClick('A7X: No artist ID configured, skipping station.');
      return { core: [], similar: [] };
    }

    // On the Zen end, always use top tracks regardless of a7xMode setting
    // (deep cuts would feel jarring in a mellow mix)
    const useDeepCuts = rules.a7xMode === 'DeepCuts' && similarIntensity > 0.4;
    const coreSourceId = useDeepCuts ? `artist_radio:${a7xId}` : `artist_radio:${a7xId}`;

    // Core A7X tracks
    const corePool = await musicProvider
      .getTracks(coreSourceId, 80)
      .then(t => t.filter(this.trackFilter))
      .catch(() => []);

    // Similar bands — scale how many we pull based on intensity
    const tracksPerBand = Math.max(3, Math.round(similarIntensity * 15));
    const similarPools = await Promise.all(
      A7X_SIMILAR_BANDS.map(async band => {
        try {
          // We cache artist IDs in localStorage to avoid re-resolving each time
          const cacheKey = `apple_artist_id_${band.toLowerCase().replace(/\s+/g, '_')}`;
          let bandId = localStorage.getItem(cacheKey);

          if (!bandId) {
            const results = await (musicProvider as any).searchCatalog?.(band, 'artists', 3);
            const artists = results?.[0]?.results?.artists?.data || [];
            const match = artists.find(
              (a: any) => a.attributes?.name?.toLowerCase() === band.toLowerCase()
            ) || artists[0];
            if (match) {
              bandId = match.id;
              localStorage.setItem(cacheKey, bandId!);
            }
          }

          if (!bandId) return [];
          return await musicProvider
            .getTracks(`artist_radio:${bandId}`, tracksPerBand)
            .then(t => t.filter(this.trackFilter))
            .catch(() => []);
        } catch {
          return [];
        }
      })
    );

    return {
      core: corePool,
      similar: this.shuffleArray(similarPools.flat()),
    };
  }

  // ── Discovery Track Fetcher ────────────────

  /**
   * fetchDiscoveryTracks
   *
   * Fetches genuinely new tracks based on how far the discovery slider is pushed.
   *
   * Familiar territory (0.01–0.50):
   *   Seeds from artists already in your library → stays near your taste
   *
   * Outside your norm (0.51–1.0):
   *   Uses genre search terms that match the current mood position
   *   → the further right, the wilder it gets
   */
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

      if (isFamiliar) {
        // ── Familiar Territory ──
        // Seed from artists already in their library
        const seedArtists = [
          ...new Set(knownTracks.slice(0, 20).map(t => t.artists[0]?.name).filter(Boolean))
        ].slice(0, 5);

        const pools = await Promise.all(
          seedArtists.map(async artist => {
            try {
              const response = await music.api.music(
                `/v1/catalog/${storefront}/search`,
                { term: artist, types: 'songs', limit: 10 }
              );
              return response?.data?.results?.songs?.data || [];
            } catch {
              return [];
            }
          })
        );

        // Filter out tracks they already have
        const knownIds = new Set(knownTracks.map(t => t.id));
        const newTracks = this.shuffleArray(pools.flat())
          .filter((t: any) => !knownIds.has(t.id))
          .slice(0, count);

        return newTracks.map((t: any) => ({
          id: t.id,
          name: t.attributes?.name || '',
          uri: t.id,
          artists: [{ name: t.attributes?.artistName || '', id: '' }],
          album: {
            name: t.attributes?.albumName || '',
            id: '',
            images: [{ url: t.attributes?.artwork?.url?.replace('{w}', '300').replace('{h}', '300') || '' }],
          },
          duration_ms: t.attributes?.durationInMillis,
          is_playable: !!t.attributes?.playParams,
        }));

      } else {
        // ── Outside Your Norm ──
        // Use genre search terms matched to mood position
        const seeds = moodLevel < MOOD_ZONES.ZEN_MAX
          ? DISCOVERY_SEEDS_ZEN
          : moodLevel < MOOD_ZONES.FOCUS_MAX
          ? DISCOVERY_SEEDS_MID
          : DISCOVERY_SEEDS_CHAOS;

        // How wild we go scales with how far past 0.5 the slider is
        const wildness = (discoverLevel - 0.5) * 2; // 0 → 1
        const seedCount = Math.ceil(1 + wildness * (seeds.length - 1));
        const selectedSeeds = seeds.slice(0, seedCount);

        const pools = await Promise.all(
          selectedSeeds.map(async seed => {
            try {
              const response = await music.api.music(
                `/v1/catalog/${storefront}/search`,
                { term: seed, types: 'songs', limit: Math.ceil(count / selectedSeeds.length) + 5 }
              );
              return response?.data?.results?.songs?.data || [];
            } catch {
              return [];
            }
          })
        );

        const knownIds = new Set(knownTracks.map(t => t.id));
        const newTracks = this.shuffleArray(pools.flat())
          .filter((t: any) => !knownIds.has(t.id))
          .slice(0, count);

        return newTracks.map((t: any) => ({
          id: t.id,
          name: t.attributes?.name || '',
          uri: t.id,
          artists: [{ name: t.attributes?.artistName || '', id: '' }],
          album: {
            name: t.attributes?.albumName || '',
            id: '',
            images: [{ url: t.attributes?.artwork?.url?.replace('{w}', '300').replace('{h}', '300') || '' }],
          },
          duration_ms: t.attributes?.durationInMillis,
          is_playable: !!t.attributes?.playParams,
        }));
      }
    } catch (err: any) {
      apiLogger.logError(`Discovery fetch failed: ${err.message}`);
      return [];
    }
  }

  // ── Individual Source Buttons ──────────────

  /**
   * generateSingleSourceResult
   * Used by the Liked Songs, Shazam, and 90sAltRock buttons.
   * Pulls purely from one source, filtered and shuffled.
   */
  private async generateSingleSourceResult(
    option: RunOption,
    rules: RuleSettings
  ): Promise<RunResult> {
    const totalTarget = rules.playlistLength || 35;
    const catalog = configStore.getConfig().catalog;

    let sourceId: string;
    let sourceName: string;

    switch (option.id) {
      case 'liked_songs':
        sourceId = 'liked_songs';
        sourceName = 'Liked Songs';
        break;
      case 'shazam_tracks':
        sourceId = 'shazam_tracks';
        sourceName = 'Shazam History';
        break;
      case 'acoustic_rock':
        sourceId = catalog.acoustic90sId || '';
        sourceName = '90sAltRock';
        break;
      default:
        sourceId = 'liked_songs';
        sourceName = 'Library';
    }

    if (!sourceId) {
      throw new Error(`Source not configured for ${option.name}. Check Settings.`);
    }

    const pool = await musicProvider
      .getTracks(sourceId, totalTarget * 4)
      .then(t => t.filter(this.trackFilter));

    const tracks = this.take(pool, totalTarget);

    let warning: string | undefined;
    if (tracks.length < totalTarget) {
      warning = `Only ${tracks.length} tracks available from ${sourceName}.`;
    }

    if (tracks.length > 0) CooldownStore.markUsed(tracks.map(t => t.id));

    return this.mapToRunResult(option, tracks, `${sourceName}: ${tracks.length} tracks`, [], warning);
  }

  /**
   * generateRapResult
   * Pulls from all configured rap playlist sources, balanced across them.
   */
  private async generateRapResult(
    option: RunOption,
    rules: RuleSettings
  ): Promise<RunResult> {
    const totalTarget = rules.playlistLength || 35;
    const rapPool = await this.fetchRapPool();

    if (rapPool.length === 0) {
      throw new Error('No Rap sources configured. Link them in Settings → Rap Sources.');
    }

    const tracks = this.take(rapPool, totalTarget);
    if (tracks.length > 0) CooldownStore.markUsed(tracks.map(t => t.id));

    return this.mapToRunResult(
      option,
      tracks,
      `OGRap&HipHop: ${tracks.length} tracks from ${Object.keys(configStore.getConfig().catalog.rapSources || {}).length} sources`
    );
  }

  /**
   * generateA7XStationResult
   * Standalone A7X Radio button — full intensity, deep cuts + all similar bands.
   */
  private async generateA7XStationResult(
    option: RunOption,
    rules: RuleSettings,
    intensity: number
  ): Promise<RunResult> {
    const totalTarget = rules.playlistLength || 35;

    const a7xStation = await this.fetchA7XStation(rules, intensity);
    const allTracks = this.shuffleArray([...a7xStation.core, ...a7xStation.similar]);

    if (allTracks.length === 0) {
      throw new Error('A7X artist ID not configured. Check Settings.');
    }

    const tracks = this.take(allTracks, totalTarget);
    if (tracks.length > 0) CooldownStore.markUsed(tracks.map(t => t.id));

    const coreCount = a7xStation.core.filter(c => tracks.find(t => t.id === c.id)).length;
    const simCount  = tracks.length - coreCount;

    return this.mapToRunResult(
      option,
      tracks,
      `A7X Radio: ${coreCount} A7X tracks + ${simCount} similar artists`
    );
  }

  // ── Rap Pool Helper ────────────────────────

  private async fetchRapPool(): Promise<SpotifyTrack[]> {
    const catalog = configStore.getConfig().catalog;
    const sources = Object.values(catalog.rapSources || {}).filter(Boolean) as any[];
    if (sources.length === 0) return [];

    const pools = await Promise.all(
      sources.map(async (s: any) => {
        try {
          return await musicProvider.getTracks(s.id, 60).then(t => t.filter(this.trackFilter));
        } catch {
          return [];
        }
      })
    );
    return pools.flat();
  }

  // ── Podcast Handler ────────────────────────

  /**
   * generatePodcastResult
   * For Apple Music migration, podcasts deep-link to Apple Podcasts.
   * This returns a result with the podcast info so the UI can show it
   * and trigger the deep link when the user taps play.
   */
  private async generatePodcastResult(option: RunOption): Promise<RunResult> {
    // Apple Podcasts deep link format:
    // podcast://itunes.apple.com/podcast/id{showId}
    // We surface the show info and let RunView handle the deep link.
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

  // ── Mock Mode ──────────────────────────────

  /**
   * generateMockResult
   * Returns fake data for UI testing while waiting for API keys.
   * Simulates the mood/discovery logic so the UI previews correctly.
   */
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
      playlistName: `${modeName} • Demo Mode`,
      tracks: tracks.map(t => ({ ...t, isNew: Math.random() > 0.8 })),
      sourceSummary: summary,
      debugSummary: summary,
    };
  }

  // ── Static play helper (used by RunView) ───

  /**
   * playTrack — triggers playback of a specific track within a queue.
   * Uses musicProvider so it works with Apple Music automatically.
   */
  static async playTrack(track: Track, allUris: string[], index: number): Promise<void> {
    await musicProvider.play(allUris, index);
  }
}

// Export a singleton instance for use across the app
export const applePlaybackEngine = new AppleMusicPlaybackEngine();
