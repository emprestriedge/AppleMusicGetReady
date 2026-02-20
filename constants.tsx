import { RunOption, RunOptionType, RuleSettings, Track, RunRecord } from './types';

// ─────────────────────────────────────────────
//  Environment Flags
// ─────────────────────────────────────────────
export const USE_MOCK_DATA = true;
export const IS_STUDIO_MODE = true;
export const MUSIC_PLATFORM: 'spotify' | 'apple' = 'apple';

// ─────────────────────────────────────────────
//  A7X Station — Artist + Similar Bands
//  Add or remove band names here anytime.
//  The engine will automatically resolve their
//  Apple Music IDs and pull their tracks.
// ─────────────────────────────────────────────
export const A7X_CORE_ARTIST = 'Avenged Sevenfold';

export const A7X_SIMILAR_BANDS = [
  'Shinedown',
  'System of a Down',
  'Korn',
  'Five Finger Death Punch',
  'Rage Against the Machine',
  'Breaking Benjamin',
];

// ─────────────────────────────────────────────
//  Discovery Slider Zones
//  0.0        = Zero mode (pure favorites, no new tracks)
//  0.01 – 0.5 = Familiar territory (similar artists you'd know)
//  0.51 – 1.0 = Outside your norm (new genres, wider net)
// ─────────────────────────────────────────────
export const DISCOVERY_ZONES = {
  ZERO_CUTOFF: 0.0,
  FAMILIAR_MAX: 0.5,
  OUTSIDE_START: 0.51,
} as const;

// Genre seeds used for Apple Music catalog search when discovery is active.
// Zen slider position = mellow seeds; Chaos position = heavy seeds.
export const DISCOVERY_SEEDS_ZEN   = ['acoustic', 'singer-songwriter', 'indie folk', 'ambient'];
export const DISCOVERY_SEEDS_MID   = ['alternative rock', 'indie rock', 'alternative'];
export const DISCOVERY_SEEDS_CHAOS = ['metal', 'hard rock', 'heavy metal', 'hip-hop', 'rap'];

// ─────────────────────────────────────────────
//  Mood Slider Zones
//  0.0 – 0.33  = Zen zone   (mellow, familiar, acoustic-heavy)
//  0.34 – 0.66 = Focus zone (balanced, all sources)
//  0.67 – 1.0  = Chaos zone (heavy, A7X deep cuts, rap-heavy)
// ─────────────────────────────────────────────
export const MOOD_ZONES = {
  ZEN_MAX: 0.33,
  FOCUS_MAX: 0.66,
  CHAOS_START: 0.67,
} as const;

// ─────────────────────────────────────────────
//  Smart Mix Modes
// ─────────────────────────────────────────────
export const SMART_MIX_MODES: RunOption[] = [
  {
    id: 'zen_mix',
    name: 'Zen',
    type: RunOptionType.MUSIC,
    description: 'Mellow, familiar, and calming. Acoustic-heavy with soft A7X sprinkles.',
  },
  {
    id: 'focus_mix',
    name: 'Focus',
    type: RunOptionType.MUSIC,
    description: 'Balanced energy. All sources in play, moderate discovery.',
  },
  {
    id: 'chaos_mix',
    name: 'Chaos',
    type: RunOptionType.MUSIC,
    description: 'High energy, unpredictable. Heavy A7X deep cuts and rap.',
  },
  {
    id: 'lightning_mix',
    name: 'Lightning⚡️',
    type: RunOptionType.MUSIC,
    description: 'Surprise me — fully randomized source ratios and mood.',
  },
];

// ─────────────────────────────────────────────
//  Individual Source Buttons
// ─────────────────────────────────────────────
export const MUSIC_BUTTONS: RunOption[] = [
  {
    id: 'liked_songs',
    name: 'Liked Songs',
    type: RunOptionType.MUSIC,
    description: 'Your personal library highlights.',
  },
  {
    id: 'shazam_tracks',
    name: 'Shazam History',
    type: RunOptionType.MUSIC,
    description: 'Tracks found while out and about.',
    idKey: 'shazamPlaylistId',
  },
  {
    id: 'acoustic_rock',
    name: '90sAltRock',
    type: RunOptionType.MUSIC,
    description: 'Pure 90s grunge and alternative acoustic cuts.',
    idKey: 'acoustic90sPlaylistId',
  },
  {
    id: 'rap_hiphop',
    name: 'OGRap&HipHop',
    type: RunOptionType.MUSIC,
    description: 'Curated 90s/00s station built from your library playlists.',
    idKey: 'rapSources',
  },
  {
    id: 'a7x_deep',
    name: 'A7xRadio',
    type: RunOptionType.MUSIC,
    description: 'A7X and similar heavy hitters with a focus on deep cuts.',
    idKey: 'a7xArtistId',
  },
];

// ─────────────────────────────────────────────
//  Podcast Options
// ─────────────────────────────────────────────
export const PODCAST_OPTIONS: RunOption[] = [
  {
    id: 'ihip_news',
    name: 'IHIP News',
    type: RunOptionType.PODCAST,
    description: 'International news and current events.',
    idKey: 'ihipShowId',
  },
  {
    id: 'raging_moderates',
    name: 'Raging Moderates',
    type: RunOptionType.PODCAST,
    description: 'Balanced political discussion.',
    idKey: 'ragingModeratesShowId',
  },
  {
    id: 'jon_stewart',
    name: 'The Weekly Show with Jon Stewart',
    type: RunOptionType.PODCAST,
    description: 'Weekly roundup from Jon Stewart.',
    idKey: 'jonStewartShowId',
  },
];

// ─────────────────────────────────────────────
//  Rap Source Playlist Names (for auto-resolver)
// ─────────────────────────────────────────────
export const RAP_SOURCE_PLAYLIST_NAMES = [
  'Best Rap & Hip-Hop 90s/00s',
  'I Love My 90s Hip‑Hop',
  "80's & 90's Hip Hop / Rap💿",
  '2Pac – Greatest Hits',
  'Eminem All Songs',
];

// ─────────────────────────────────────────────
//  Default Rules
//  moodLevel:    0 = full Zen, 1 = full Chaos
//  discoverLevel: 0 = pure favorites, 1 = max exploration
// ─────────────────────────────────────────────
export const DEFAULT_RULES: RuleSettings = {
  playlistLength: 35,
  allowExplicit: true,
  avoidRepeats: true,
  avoidRepeatsWindow: 7,
  preferVariety: true,
  a7xMode: 'DeepCuts',
  moodLevel: 0.2,
  discoverLevel: 0.25,
  devMode: false,
  customPodcastOptions: PODCAST_OPTIONS,
};

// ─────────────────────────────────────────────
//  Mock Data (Demo Mode)
// ─────────────────────────────────────────────
export const MOCK_TRACKS: Track[] = [
  {
    id: '1', uri: 'apple:track:1',
    title: 'Midnight City', artist: 'M83', album: "Hurry Up, We're Dreaming",
    imageUrl: 'https://i.scdn.co/image/ab67616d0000b2737604586e92b34a1795f573c0',
    durationMs: 243000, status: 'liked',
  },
  {
    id: '2', uri: 'apple:track:2',
    title: 'Through the Fire and Flames', artist: 'DragonForce', album: 'Inhuman Rampage',
    imageUrl: 'https://i.scdn.co/image/ab67616d0000b273468962634e0689b910e5446f',
    durationMs: 441000, status: 'none',
  },
  {
    id: '3', uri: 'apple:track:3',
    title: 'Starboy (feat. Daft Punk)', artist: 'The Weeknd', album: 'Starboy',
    imageUrl: 'https://i.scdn.co/image/ab67616d0000b2734718e0df50495f2a969b7617',
    durationMs: 230000, status: 'gem',
  },
  {
    id: '4', uri: 'apple:track:4',
    title: 'Diamonds From Sierra Leone', artist: 'Kanye West', album: 'Late Registration',
    imageUrl: 'https://i.scdn.co/image/ab67616d0000b273200969d750c00030560e9095',
    durationMs: 288000, status: 'liked',
  },
  {
    id: '5', uri: 'apple:track:5',
    title: 'Everlong', artist: 'Foo Fighters', album: 'The Colour and the Shape',
    imageUrl: 'https://i.scdn.co/image/ab67616d0000b273670989f53e6b4d3202c38466',
    durationMs: 250000, status: 'none',
  },
  {
    id: '6', uri: 'apple:track:6',
    title: 'Bat Country', artist: 'Avenged Sevenfold', album: 'City of Evil',
    imageUrl: 'https://i.scdn.co/image/ab67616d0000b2737604586e92b34a1795f573c0',
    durationMs: 313000, status: 'none',
  },
  {
    id: '7', uri: 'apple:track:7',
    title: 'California Love', artist: '2Pac ft. Dr. Dre', album: 'All Eyez on Me',
    imageUrl: 'https://i.scdn.co/image/ab67616d0000b27376c79a83a0058b8559812f86',
    durationMs: 284000, status: 'none',
  },
  {
    id: '8', uri: 'apple:track:8',
    title: 'Amber', artist: '311', album: 'From Chaos',
    imageUrl: 'https://i.scdn.co/image/ab67616d0000b27393d027732a37397b9148d88e',
    durationMs: 209000, status: 'none',
  },
];

export const MOCK_HISTORY: RunRecord[] = [
  {
    id: 'demo_1',
    timestamp: new Date(Date.now() - 3600000).toLocaleString(),
    optionName: 'Zen',
    rulesSnapshot: DEFAULT_RULES,
    result: {
      runType: RunOptionType.MUSIC,
      optionName: 'Zen',
      createdAt: new Date().toISOString(),
      playlistName: 'Zen Mix — Apple Demo',
      tracks: MOCK_TRACKS.slice(0, 5),
      sourceSummary: 'Liked 2 • 90sAltRock 2 • Shazam 1 • A7X 0 • Rap 0 • New 0',
    },
  },
  {
    id: 'demo_2',
    timestamp: new Date(Date.now() - 86400000).toLocaleString(),
    optionName: 'Chaos',
    rulesSnapshot: { ...DEFAULT_RULES, moodLevel: 0.85, discoverLevel: 0.6 },
    result: {
      runType: RunOptionType.MUSIC,
      optionName: 'Chaos',
      createdAt: new Date().toISOString(),
      playlistName: 'Chaos Mix — Apple Demo',
      tracks: MOCK_TRACKS.slice(3, 8),
      sourceSummary: 'A7X 2 • Rap 2 • Shazam 1 • Liked 0 • 90sAltRock 0 • New 2',
    },
  },
];
