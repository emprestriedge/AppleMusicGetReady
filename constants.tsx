import { RunOption, RunOptionType, RuleSettings, Track, RunRecord } from './types';

// 1. Enable Demo Mode for UI testing
export const USE_MOCK_DATA = true;

// 2. Force "Production Mode" (Never verify as Studio)
export const IS_STUDIO_MODE = false;

// 3. Platform Settings
export const MUSIC_PLATFORM: 'spotify' | 'apple' = 'apple';

// --- Configuration Constants ---

export const SMART_MIX_MODES: RunOption[] = [
  { id: 'zen_mix', name: 'Zen', type: RunOptionType.MUSIC, description: 'A calming selection of acoustic and light tracks.' },
  { id: 'focus_mix', name: 'Focus', type: RunOptionType.MUSIC, description: 'Deep concentration with minimal vocals.' },
  { id: 'chaos_mix', name: 'Chaos', type: RunOptionType.MUSIC, description: 'High energy, high discovery, unpredictable.' },
  { id: 'lightening_mix', name: 'Lightning⚡️', type: RunOptionType.MUSIC, description: 'Fast-paced, hard-hitting tracks.' },
];

export const MUSIC_BUTTONS: RunOption[] = [
  { id: 'liked_songs', name: 'Liked Songs', type: RunOptionType.MUSIC, description: 'Your personal library highlights.' },
  { id: 'shazam_tracks', name: 'Shazam History', type: RunOptionType.MUSIC, description: 'Tracks found while out and about.', idKey: 'shazamPlaylistId' },
  { id: 'acoustic_rock', name: '90sAltRock', type: RunOptionType.MUSIC, description: 'Pure 90s grunge and alternative acoustic cuts.', idKey: 'acoustic90sPlaylistId' },
  { id: 'rap_hiphop', name: 'OGRap&HipHop', type: RunOptionType.MUSIC, description: 'Curated 90s/00s station built from your library playlists.', idKey: 'rapSources' },
  { id: 'a7x_deep', name: 'A7xRadio', type: RunOptionType.MUSIC, description: 'A7X and similar heavy hitters with a focus on deep cuts.', idKey: 'a7xArtistId' },
];

export const PODCAST_OPTIONS: RunOption[] = [
  { id: 'ihip_news', name: 'IHIP News', type: RunOptionType.PODCAST, description: 'International news and current events.', idKey: 'ihipShowId' },
  { id: 'raging_moderates', name: 'Raging Moderates', type: RunOptionType.PODCAST, description: 'Balanced political discussion.', idKey: 'ragingModeratesShowId' },
  { id: 'jon_stewart', name: 'The Weekly Show with Jon Stewart', type: RunOptionType.PODCAST, description: 'Weekly roundup from Jon Stewart.', idKey: 'jonStewartShowId' },
];

export const RAP_SOURCE_PLAYLIST_NAMES = [
  "Best Rap & Hip-Hop 90s/00s",
  "I Love My 90s Hip‑Hop",
  "80's & 90's Hip Hop / Rap💿",
  "2Pac – Greatest Hits",
  "Eminem All Songs"
];

export const DEFAULT_RULES: RuleSettings = {
  playlistLength: 35,
  allowExplicit: true,
  avoidRepeats: true,
  avoidRepeatsWindow: 7,
  preferVariety: true,
  a7xMode: 'DeepCuts',
  calmHype: 0.2,
  discoverLevel: 0.3,
  devMode: false,
  customPodcastOptions: PODCAST_OPTIONS,
};

// Mock Data for Demo Mode
export const MOCK_TRACKS: Track[] = [
  { id: '1', uri: 'apple:track:1', title: 'Midnight City', artist: 'M83', album: 'Hurry Up, We\'re Dreaming', imageUrl: 'https://i.scdn.co/image/ab67616d0000b2737604586e92b34a1795f573c0', durationMs: 243000, status: 'liked' },
  { id: '2', uri: 'apple:track:2', title: 'Through the Fire and Flames', artist: 'DragonForce', album: 'Inhuman Rampage', imageUrl: 'https://i.scdn.co/image/ab67616d0000b273468962634e0689b910e5446f', durationMs: 441000, status: 'none' },
  { id: '3', uri: 'apple:track:3', title: 'Starboy (feat. Daft Punk)', artist: 'The Weeknd', album: 'Starboy', imageUrl: 'https://i.scdn.co/image/ab67616d0000b2734718e0df50495f2a969b7617', durationMs: 230000, status: 'gem' },
  { id: '4', uri: 'apple:track:4', title: 'Diamonds From Sierra Leone', artist: 'Kanye West', album: 'Late Registration', imageUrl: 'https://i.scdn.co/image/ab67616d0000b273200969d750c00030560e9095', durationMs: 288000, status: 'liked' },
  { id: '5', uri: 'apple:track:5', title: 'Everlong', artist: 'Foo Fighters', album: 'The Colour and the Shape', imageUrl: 'https://i.scdn.co/image/ab67616d0000b273670989f53e6b4d3202c38466', durationMs: 250000, status: 'none' },
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
      playlistName: 'Zen Mix - Apple Demo',
      tracks: MOCK_TRACKS.slice(0, 5),
      sourceSummary: 'Apple Music 5 • Shazam 0 • Liked 0'
    }
  }
];