import React, { useState, useEffect } from 'react';
import { RuleSettings, AppConfig } from '../types';
import { BlockStore } from '../services/blockStore';
import PerOptionRulesView from './PerOptionRulesView';
import BlockedTracksView from './BlockedTracksView';
import PodcastManagerView from './PodcastManagerView';
import { appleMusicService } from '../services/appleMusicService';
import { Haptics } from '../services/haptics';
import { toastService } from '../services/toastService';
import { MOOD_ZONES, DISCOVERY_ZONES } from '../constants';

interface SettingsViewProps {
  config: AppConfig;
  rules: RuleSettings;
  setRules: React.Dispatch<React.SetStateAction<RuleSettings>>;
  authStatus: string;
  setAuthStatus: (s: any) => void;
}

export type SettingsMode = 'root' | 'perOption' | 'hiddenTracks' | 'podcasts';

const avenir = { fontFamily: '"Avenir Next Condensed", "Avenir Next", "Avenir", sans-serif' };

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
}> = ({ icon, label, subtext, onClick }) => (
  <button
    onClick={onClick}
    className="w-full px-6 py-5 flex items-center justify-between active:bg-white/5 transition-colors group"
  >
    <div className="flex items-center gap-4 text-left min-w-0">
      <span className="text-2xl group-active:scale-110 transition-transform shrink-0">{icon}</span>
      <div className="flex flex-col min-w-0">
        <span className="text-[20px] font-semibold transition-colors truncate text-[#A9E8DF]" style={avenir}>
          {label}
        </span>
        <span className="text-[10px] text-zinc-600 font-medium truncate" style={avenir}>{subtext}</span>
      </div>
    </div>
    <svg className="w-5 h-5 text-zinc-700 group-active:translate-x-1 transition-transform shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
    </svg>
  </button>
);

const SettingsView: React.FC<SettingsViewProps> = ({
  config, rules, setRules, authStatus, setAuthStatus
}) => {
  const [mode, setMode] = useState<SettingsMode>('root');
  const [blockedCount, setBlockedCount] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
    const scroller = document.getElementById('main-content-scroller');
    if (scroller) scroller.scrollTop = 0;
  }, [mode]);

  useEffect(() => {
    setBlockedCount(BlockStore.getBlocked().length);
  }, [mode]);

  const toggle = (key: keyof RuleSettings) => {
    Haptics.medium();
    setRules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleConnect = async () => {
    Haptics.impact();
    setAuthStatus('waiting');
    try {
      await appleMusicService.login();
    } catch (e: any) {
      setAuthStatus('error');
      Haptics.error();
      toastService.show(e.message, 'error');
    }
  };

  const handleDisconnect = () => {
    Haptics.impact();
    if (confirm('Disconnect Apple Music? You will need to reconnect to use the app.')) {
      appleMusicService.logout();
      window.location.reload();
    }
  };

  if (mode === 'perOption')    return <PerOptionRulesView onBack={() => setMode('root')} />;
  if (mode === 'hiddenTracks') return <BlockedTracksView onBack={() => setMode('root')} />;
  if (mode === 'podcasts')     return <PodcastManagerView onBack={() => setMode('root')} rules={rules} setRules={setRules} />;

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

  return (
    <div className="flex flex-col gap-8 px-4 pt-24 pb-40 w-full">
      <header className="pl-4 stagger-entry stagger-1">
        <h1 className="text-7xl font-mango header-ombre leading-none tracking-tighter">Settings</h1>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-5 ml-1">Global Configuration</p>
      </header>

      {/* Account */}
      <section className="w-full stagger-entry stagger-2">
        <h2 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-5 mb-3">Account</h2>
        <div className="glass-panel-gold rounded-3xl overflow-hidden divide-y divide-white/5">
          <div className="px-6 py-5 flex items-center justify-between gap-4">
            <div className="flex flex-col min-w-0">
              <span className="text-[20px] font-medium text-[#A9E8DF] truncate" style={avenir}>
                Apple Music
              </span>
              <span className="text-[11px] text-zinc-500 font-medium truncate" style={avenir}>
                {authStatus === 'authorized'
                  ? 'Connected'
                  : authStatus === 'waiting'
                  ? 'Connecting...'
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

      {/* Library */}
      <section className="w-full stagger-entry stagger-3">
        <h2 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-5 mb-3">Library</h2>
        <div className="glass-panel-gold rounded-3xl overflow-hidden divide-y divide-white/5">
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
        </div>
      </section>

      {/* Global Mix Logic */}
      <section className="w-full stagger-entry stagger-4">
        <h2 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-5 mb-3">Global Mix Logic</h2>
        <div className="glass-panel-gold rounded-3xl overflow-hidden divide-y divide-white/5">

          {/* Playlist Length */}
          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[20px] font-medium text-[#A9E8DF]" style={avenir}>Playlist Length</span>
              <span className="text-palette-pink font-black text-2xl tabular-nums" style={avenir}>{rules.playlistLength}</span>
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
              <span className="text-[20px] font-medium text-[#A9E8DF]" style={avenir}>Default Mood</span>
              <span className="text-palette-teal font-black text-lg" style={avenir}>{moodLabel}</span>
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
              <span className="text-[20px] font-medium text-[#A9E8DF]" style={avenir}>Default Exploration</span>
              <span className="text-palette-pink font-black text-sm" style={avenir}>{discoveryLabel}</span>
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
            <span className="text-[20px] font-medium text-[#A9E8DF]" style={avenir}>Allow Explicit</span>
            <Toggle checked={rules.allowExplicit} onToggle={() => toggle('allowExplicit')} />
          </div>

          {/* Avoid Repeats */}
          <div className="px-6 py-5 flex items-center justify-between">
            <span className="text-[20px] font-medium text-[#A9E8DF]" style={avenir}>Avoid Repeats</span>
            <Toggle checked={rules.avoidRepeats} onToggle={() => toggle('avoidRepeats')} />
          </div>

        </div>
      </section>

    </div>
  );
};

export default SettingsView;
