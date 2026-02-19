import React, { useState, useEffect } from 'react';
import { RuleSettings, DataSourceType, SpotifyUser, AppConfig } from '../types';
import { BlockStore } from '../services/blockStore';
import PerOptionRulesView from './PerOptionRulesView';
import TestDataView from './TestDataView';
import BlockedTracksView from './BlockedTracksView';
import PodcastManagerView from './PodcastManagerView';
import DeveloperToolsView from './DeveloperToolsView';
import RapSourcesView from './RapSourcesView';
import { SpotifyAuth } from '../services/spotifyAuth';
import { appleMusicService } from '../services/appleMusicService';
import { Haptics } from '../services/haptics';
import { configStore } from '../services/configStore';
import { toastService } from '../services/toastService';
import { MUSIC_PLATFORM, MOOD_ZONES, DISCOVERY_ZONES } from '../constants';
import { musicProvider } from '../services/musicProvider';

interface SettingsViewProps {
  config: AppConfig;
  rules: RuleSettings;
  setRules: React.Dispatch<React.SetStateAction<RuleSettings>>;
  spotifyUser: SpotifyUser | null;
  authError: string | null;
  authStatus: string;
  setAuthStatus: (s: any) => void;
}

export type SettingsMode = 'root' | 'perOption' | 'testData' | 'hiddenTracks' | 'podcasts' | 'devTools' | 'rapSources';

// ── Small reusable components ──────────────────────────────────────────

const Toggle: React.FC<{ checked: boolean; onToggle: () => void }> = ({ checked, onToggle }) => (
  <button
    onClick={onToggle}
    className={`w-14 h-8 rounded-full transition-all relative active:scale-90 shrink-0 ${checked ? 'bg-palette-pink shadow-[0_0_12px_rgba(255,0,122,0.4)]' : 'bg-zinc-800'}`}
  >
    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-all ${checked ? 'left-7' : 'left-1'}`} />
  </button>
);

const SettingsRow: React.FC<{
  icon: string;
  label: string;
  subtext: string;
  onClick: () => void;
  highlight?: boolean;
}> = ({ icon, label, subtext, onClick, highlight }) => (
  <button
    onClick={onClick}
    className={`w-full px-6 py-5 flex items-center justify-between active:bg-white/5 transition-colors group ${highlight ? 'bg-palette-pink/5' : ''}`}
  >
    <div className="flex items-center gap-4 text-left min-w-0">
      <span className="text-2xl group-active:scale-110 transition-transform shrink-0">{icon}</span>
      <div className="flex flex-col min-w-0">
        <span className={`text-[20px] font-garet font-semibold transition-colors truncate ${highlight ? 'text-palette-pink' : 'text-[#A9E8DF]'}`}>
          {label}
        </span>
        <span className="text-[10px] text-zinc-600 font-medium truncate">{subtext}</span>
      </div>
    </div>
    <svg className="w-5 h-5 text-zinc-700 group-active:translate-x-1 transition-transform shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
    </svg>
  </button>
);

// ── Main SettingsView ──────────────────────────────────────────────────

const SettingsView: React.FC<SettingsViewProps> = ({
  config, rules, setRules, spotifyUser, authError, authStatus, setAuthStatus
}) => {
  const [mode, setMode] = useState<SettingsMode>('root');
  const [blockedCount, setBlockedCount] = useState(0);
  const [rapLinkedCount, setRapLinkedCount] = useState(0);

  const isApple = MUSIC_PLATFORM === 'apple';

  useEffect(() => {
    window.scrollTo(0, 0);
    const scroller = document.getElementById('main-content-scroller');
    if (scroller) scroller.scrollTop = 0;
  }, [mode]);

  useEffect(() => {
    setBlockedCount(BlockStore.getBlocked().length);
    const sources = config.catalog.rapSources || {};
    setRapLinkedCount(Object.values(sources).filter(s => s !== null).length);
  }, [mode, config]);

  const toggle = (key: keyof RuleSettings) => {
    Haptics.medium();
    setRules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleConnect = async () => {
    if (isApple) {
      Haptics.impact();
      setAuthStatus('waiting');
      try {
        await appleMusicService.login();
      } catch (e: any) {
        setAuthStatus('error');
        Haptics.error();
        toastService.show(e.message, 'error');
      }
      return;
    }
    if (!config.spotifyClientId) {
      toastService.show('Enter a Client ID first', 'warning');
      return;
    }
    Haptics.impact();
    setAuthStatus('waiting');
    try {
      await SpotifyAuth.login();
    } catch (e: any) {
      setAuthStatus('error');
      Haptics.error();
      toastService.show(e.message, 'error');
    }
  };

  const handleDisconnect = () => {
    Haptics.impact();
    if (confirm(`Disconnect ${isApple ? 'Apple Music' : 'Spotify'}? You'll need to reconnect to use the app.`)) {
      if (isApple) {
        appleMusicService.logout();
      } else {
        SpotifyAuth.logout();
      }
      window.location.reload();
    }
  };

  // ── Sub-view routing ──
  if (mode === 'perOption')    return <PerOptionRulesView onBack={() => setMode('root')} />;
  if (mode === 'testData')     return <TestDataView onBack={() => setMode('root')} />;
  if (mode === 'hiddenTracks') return <BlockedTracksView onBack={() => setMode('root')} />;
  if (mode === 'podcasts')     return <PodcastManagerView onBack={() => setMode('root')} rules={rules} setRules={setRules} />;
  if (mode === 'devTools')     return <DeveloperToolsView onBack={() => setMode('root')} config={config} />;
  if (mode === 'rapSources')   return <RapSourcesView onBack={() => setMode('root')} />;

  // ── Mood label helper ──
  const moodLabel = rules.moodLevel < MOOD_ZONES.ZEN_MAX
    ? 'Zen'
    : rules.moodLevel < MOOD_ZONES.FOCUS_MAX
    ? 'Focus'
    : 'Chaos';

  const discoveryLabel = rules.discoverLevel <= DISCOVERY_ZONES.ZERO_CUTOFF
    ? 'Favorites Only'
    : rules.discoverLevel <= DISCOVERY_ZONES.FAMILIAR_MAX
    ? 'Familiar Territory'
    : 'Outside Your Norm';

  // ── Root settings view ──
  return (
    <div className="flex flex-col gap-8 px-4 pt-24 pb-40 w-full">
      <header className="pl-4 stagger-entry stagger-1">
        <h1 className="text-7xl font-mango header-ombre leading-none tracking-tighter">Settings</h1>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-5 ml-1">Global Configuration</p>
      </header>

      {/* ── Account ── */}
      <section className="w-full stagger-entry stagger-2">
        <h2 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-5 mb-3">Account</h2>
        <div className="glass-panel-gold rounded-3xl overflow-hidden divide-y divide-white/5">
          <div className="px-6 py-5 flex items-center justify-between gap-4">
            <div className="flex flex-col min-w-0">
              <span className="text-[20px] font-garet font-medium text-[#A9E8DF] truncate">
                {isApple ? 'Apple Music' : 'Spotify'}
              </span>
              <span className="text-[11px] text-zinc-500 font-medium truncate">
                {authStatus === 'authorized'
                  ? (spotifyUser?.display_name || 'Connected')
                  : authStatus === 'waiting'
                  ? 'Connecting…'
                  : 'Not connected'}
              </span>
            </div>
            <button
              onClick={authStatus === 'authorized' ? handleDisconnect : handleConnect}
              className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shrink-0 ${
                authStatus === 'authorized'
                  ? 'bg-zinc-800 text-zinc-400 active:bg-zinc-700'
                  : 'bg-palette-pink text-white shadow-[0_0_12px_rgba(255,0,122,0.4)] active:scale-95'
              }`}
            >
              {authStatus === 'authorized' ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        </div>
      </section>

      {/* ── Library ── */}
      <section className="w-full stagger-entry stagger-3">
        <h2 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-5 mb-3">Library</h2>
        <div className="glass-panel-gold rounded-3xl overflow-hidden divide-y divide-white/5">
          <SettingsRow
            icon="🎙️"
            label="Rap Sources"
            subtext={`${rapLinkedCount} playlist${rapLinkedCount !== 1 ? 's' : ''} linked`}
            onClick={() => { Haptics.medium(); setMode('rapSources'); }}
          />
          <SettingsRow
            icon="🚫"
            label="Hidden Tracks"
            subtext={`${blockedCount} track${blockedCount !== 1 ? 's' : ''} blocked`}
            onClick={() => { Haptics.medium(); setMode('hiddenTracks'); }}
          />
          <SettingsRow
            icon="🎙️"
            label="Podcast Manager"
            subtext="Manage your podcast shows"
            onClick={() => { Haptics.medium(); setMode('podcasts'); }}
          />
          <SettingsRow
            icon="⚙️"
            label="Per-Source Rules"
            subtext="Fine-tune each mix independently"
            onClick={() => { Haptics.medium(); setMode('perOption'); }}
          />
          {rules.devMode && (
            <SettingsRow
              icon="🛠️"
              label="Developer Tools"
              subtext="Advanced config & diagnostics"
              onClick={() => { Haptics.medium(); setMode('devTools'); }}
              highlight
            />
          )}
        </div>
      </section>

      {/* ── Global Mix Logic ── */}
      <section className="w-full stagger-entry stagger-4">
        <h2 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-5 mb-3">Global Mix Logic</h2>
        <div className="glass-panel-gold rounded-3xl overflow-hidden divide-y divide-white/5">

          {/* Playlist Length */}
          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[20px] font-garet font-medium text-[#A9E8DF]">Playlist Length</span>
              <span className="text-palette-pink font-garet font-black text-2xl tabular-nums">{rules.playlistLength}</span>
            </div>
            <input
              type="range" min="15" max="75" step="1"
              value={rules.playlistLength}
              onChange={e => { Haptics.light(); setRules(prev => ({ ...prev, playlistLength: parseInt(e.target.value) })); }}
              className="w-full h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-palette-pink"
            />
            <div className="flex justify-between text-[8px] font-black text-zinc-700 uppercase tracking-tighter">
              <span>15</span><span>75</span>
            </div>
          </div>

          {/* Mood Slider */}
          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[20px] font-garet font-medium text-[#A9E8DF]">Default Mood</span>
              <span className="text-palette-teal font-garet font-black text-lg">{moodLabel}</span>
            </div>
            <input
              type="range" min="0" max="1" step="0.01"
              value={rules.moodLevel}
              onChange={e => { Haptics.light(); setRules(prev => ({ ...prev, moodLevel: parseFloat(e.target.value) })); }}
              className="w-full h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-palette-teal"
            />
            <div className="flex justify-between text-[8px] font-black text-zinc-700 uppercase tracking-tighter">
              <span>Zen</span><span>Focus</span><span>Chaos</span>
            </div>
          </div>

          {/* Discovery Slider */}
          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[20px] font-garet font-medium text-[#A9E8DF]">Default Exploration</span>
              <span className="text-palette-pink font-garet font-black text-sm">{discoveryLabel}</span>
            </div>
            <input
              type="range" min="0" max="1" step="0.05"
              value={rules.discoverLevel}
              onChange={e => setRules(prev => ({ ...prev, discoverLevel: parseFloat(e.target.value) }))}
              className="w-full h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-palette-pink"
            />
            <div className="flex justify-between text-[8px] font-black text-zinc-700 uppercase tracking-tighter">
              <span>Favorites</span><span>Familiar</span><span>Explore</span>
            </div>
          </div>

          {/* Allow Explicit */}
          <div className="px-6 py-5 flex items-center justify-between">
            <span className="text-[20px] font-garet font-medium text-[#A9E8DF]">Allow Explicit</span>
            <Toggle checked={rules.allowExplicit} onToggle={() => toggle('allowExplicit')} />
          </div>

          {/* Avoid Repeats */}
          <div className="px-6 py-5 flex items-center justify-between">
            <span className="text-[20px] font-garet font-medium text-[#A9E8DF]">Avoid Repeats</span>
            <Toggle checked={rules.avoidRepeats} onToggle={() => toggle('avoidRepeats')} />
          </div>

        </div>
      </section>

      {/* ── Advanced ── */}
      <section className="w-full stagger-entry stagger-5">
        <h2 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-5 mb-3">Advanced</h2>
        <div className="glass-panel-gold rounded-3xl overflow-hidden divide-y divide-white/5">
          <div className="px-6 py-5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[20px] font-garet font-medium text-[#A9E8DF]">Developer Mode</span>
              <span className="text-[10px] text-zinc-600 font-medium">Enable internal plumbing tools</span>
            </div>
            <Toggle checked={rules.devMode} onToggle={() => toggle('devMode')} />
          </div>
        </div>
      </section>

    </div>
  );
};

export default SettingsView;
