import React, { useState, useEffect } from 'react';
import { RumpnOption, RuleSettings, SmartMixPlan, VibeType, RunOptionType } from '../types';
import { SMART_MIX_MODES, MUSIC_BUTTONS, PODCAST_OPTIONS, MOOD_ZONES, DISCOVERY_ZONES } from '../constants';
import { getSmartMixPlan, getMixInsight } from '../services/geminiService';
import { Haptics } from '../services/haptics';

interface HomeViewProps {
  onSelect: (option: RunOption) => void;
  rules: RuleSettings;
  setRules: React.Dispatch<React.SetStateAction<RuleSettings>>;
}

type HomeViewMode = 'root' | 'music' | 'podcast';

// ── Animated mood label that updates as the slider moves ──
const AnimatedMoodLabel: React.FC<{ value: number }> = ({ value }) => {
  const label = value < MOOD_ZONES.ZEN_MAX
    ? 'Zen'
    : value < MOOD_ZONES.FOCUS_MAX
    ? 'Focus'
    : 'Chaos';

  const color = value < MOOD_ZONES.ZEN_MAX
    ? 'text-[#C5A04D]'
    : value < MOOD_ZONES.FOCUS_MAX
    ? 'text-[#2DB9B1]'
    : 'text-[#FF007A]';

  return (
    <span className={`text-[10px] font-black uppercase tracking-widest transition-colors duration-300 ${color}`}>
      {label} · {Math.round(value * 100)}%
    </span>
  );
};

// ── Discovery label ──
const DiscoveryLabel: React.FC<{ value: number }> = ({ value }) => {
  const label = value <= DISCOVERY_ZONES.ZERO_CUTOFF
    ? 'Pure Favorites'
    : value <= DISCOVERY_ZONES.FAMILIAR_MAX
    ? `${Math.round(value * 100)}% Familiar`
    : `${Math.round(value * 100)}% Exploring`;

  return (
    <span className="text-[10px] font-black text-palette-pink uppercase tracking-widest">
      {label}
    </span>
  );
};

const VIBE_STYLES: Record<VibeType, { gradient: string; shadow: string; activeRing: string; label: string }> = {
  Chaos: {
    gradient: 'from-[#FF007A] to-[#FF4D9F]',
    shadow: 'rgba(255, 0, 122, 0.6)',
    activeRing: 'ring-[#FF007A]',
    label: 'CHAOS',
  },
  Zen: {
    gradient: 'from-[#C5A04D] to-[#E5C16D]',
    shadow: 'rgba(197, 160, 77, 0.6)',
    activeRing: 'ring-[#C5A04D]',
    label: 'ZEN',
  },
  Focus: {
    gradient: 'from-[#2DB9B1] to-[#40D9D0]',
    shadow: 'rgba(45, 185, 177, 0.6)',
    activeRing: 'ring-[#2DB9B1]',
    label: 'FOCUS',
  },
  LighteningMix: {
    gradient: 'from-[#6D28D9] to-[#8B5CF6]',
    shadow: 'rgba(109, 40, 217, 0.6)',
    activeRing: 'ring-[#6D28D9]',
    label: 'LIGHTNING',
  },
};

// ── Category card component ──
const CategoryCard: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  shadowColor: string;
  onClick: () => void;
}> = ({ title, description, icon, gradient, shadowColor, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full relative overflow-hidden bg-gradient-to-br ${gradient} p-5 rounded-[32px] flex items-center gap-4 active:scale-[0.98] transition-all border border-white/15`}
    style={{ boxShadow: `0 8px 24px -4px ${shadowColor}` }}
  >
    <div className="absolute top-1 left-2 w-[90%] h-[40%] bg-gradient-to-b from-white/30 to-transparent rounded-full blur-[1px] pointer-events-none" />
    <div className="relative z-10 w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
      {icon}
    </div>
    <div className="relative z-10 text-left">
      <div className="text-white font-black text-lg leading-none">{title}</div>
      <div className="text-white/70 text-xs mt-1 font-medium">{description}</div>
    </div>
    <div className="relative z-10 ml-auto">
      <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  </button>
);

// ── Source button component ──
const SourceButton: React.FC<{ option: RunOption; onSelect: (o: RunOption) => void }> = ({ option, onSelect }) => (
  <button
    onClick={() => { Haptics.impact(); onSelect(option); }}
    className="w-full bg-zinc-900/60 border border-white/8 rounded-[24px] p-4 flex items-center gap-3 active:scale-[0.98] transition-all text-left"
  >
    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-palette-pink/20 to-palette-teal/20 border border-white/10 flex items-center justify-center flex-shrink-0">
      <svg className="w-5 h-5 text-palette-pink" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
      </svg>
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-white font-black text-sm truncate">{option.name}</div>
      <div className="text-zinc-500 text-[11px] mt-0.5 truncate">{option.description}</div>
    </div>
    <svg className="w-4 h-4 text-zinc-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
    </svg>
  </button>
);

const HomeView: React.FC<HomeViewProps> = ({ onSelect, rules, setRules }) => {
  const [viewMode, setViewMode] = useState<HomeViewMode>('root');

  // Derive initial vibe from current moodLevel
  const [vibe, setVibe] = useState<VibeType>(() => {
    if (rules.moodLevel <= MOOD_ZONES.ZEN_MAX) return 'Zen';
    if (rules.moodLevel >= 0.9) return 'LighteningMix';
    if (rules.discoverLevel >= 0.7) return 'Chaos';
    return 'Focus';
  });

  const [loading, setLoading] = useState(false);
  const [smartPlan, setSmartPlan] = useState<SmartMixPlan | null>(() => {
    try {
      const saved = localStorage.getItem('getready_smart_plan');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    const scroller = document.getElementById('main-content-scroller');
    if (scroller) scroller.scrollTop = 0;
  }, [viewMode]);

  useEffect(() => {
    if (smartPlan) {
      localStorage.setItem('getready_smart_plan', JSON.stringify(smartPlan));
    }
  }, [smartPlan]);

  /**
   * setVibeProfile — when user taps a vibe button, snap the mood slider
   * to a sensible default position for that vibe and update discovery too.
   */
  const setVibeProfile = (v: VibeType) => {
    Haptics.impact();
    setVibe(v);

    let mood = 0.5;
    let discovery = 0.25;

    switch (v) {
      case 'Zen':          mood = 0.1;  discovery = 0.15; break;
      case 'Focus':        mood = 0.4;  discovery = 0.25; break;
      case 'Chaos':        mood = 0.8;  discovery = 0.6;  break;
      case 'LighteningMix': mood = Math.random(); discovery = Math.random() * 0.7; break;
    }

    setRules(prev => ({ ...prev, moodLevel: mood, discoverLevel: discovery }));
  };

  const handleGenerateSmartMix = async () => {
    Haptics.medium();
    setLoading(true);
    try {
      const plan = await getSmartMixPlan(
        vibe,
        rules.discoverLevel,
        rules.moodLevel,
        rules.playlistLength
      );
      setSmartPlan(plan);

      const vibeToOptionId: Record<VibeType, string> = {
        Chaos: 'chaos_mix',
        Zen: 'zen_mix',
        Focus: 'focus_mix',
        LighteningMix: 'lightning_mix',
      };

      const option = SMART_MIX_MODES.find(o => o.id === vibeToOptionId[vibe]);
      if (option) {
        Haptics.success();
        setTimeout(() => { onSelect(option); setLoading(false); }, 800);
      } else {
        setLoading(false);
      }
    } catch (e) {
      Haptics.error();
      setLoading(false);
    }
  };

  const navigateTo = (mode: HomeViewMode) => {
    Haptics.light();
    setViewMode(mode);
  };

  const LightningIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );

  // ── Root view ──
  const renderRoot = () => (
    <div className="flex flex-col gap-4 px-4 pt-24 pb-40 w-full max-w-[100vw] overflow-x-hidden">
      <header className="mb-6 pl-8 stagger-entry stagger-1">
        <h1 className="text-7xl font-mango header-ombre leading-none tracking-tighter">Library</h1>
        <p className="ios-caption text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-5 ml-1">Daily Catalog</p>
      </header>

      <div className="flex flex-col gap-4 mb-6 stagger-entry stagger-2 w-full">
        <CategoryCard
          title="Music"
          description="Custom mixes from your top tracks."
          icon={<svg className="w-10 h-10 text-white opacity-100" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>}
          gradient="from-[#FF007A] via-[#FF1A8B] to-[#FF4D9F]"
          shadowColor="rgba(255, 0, 122, 0.4)"
          onClick={() => navigateTo('music')}
        />
        <CategoryCard
          title="Podcasts"
          description="Open your favorite shows."
          icon={<svg className="w-10 h-10 text-white opacity-100" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" /><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" /></svg>}
          gradient="from-[#19A28E] via-[#2DB9B1] to-[#40D9D0]"
          shadowColor="rgba(25, 162, 142, 0.4)"
          onClick={() => navigateTo('podcast')}
        />
      </div>

      {/* ── Smart Mix Card ── */}
      <div className="glass-panel-gold rounded-[40px] p-4 sm:p-6 border-white/10 relative overflow-hidden group stagger-entry stagger-3 w-full">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <svg className="w-12 h-12 text-palette-pink" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" />
          </svg>
        </div>

        <h2 className="text-[11px] font-black text-palette-pink uppercase tracking-[0.3em] mb-6">SMART MIX</h2>

        <div className="flex flex-col gap-8">

          {/* Step 1 — Vibe preset buttons */}
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">1. Select Vibe</span>
            <div className="grid grid-cols-4 gap-3 px-5">
              {(['Chaos', 'Zen', 'Focus', 'LighteningMix'] as VibeType[]).map(v => {
                const style = VIBE_STYLES[v];
                const isActive = vibe === v;
                return (
                  <div key={v} className="flex items-center justify-center">
                    <button
                      onClick={() => setVibeProfile(v)}
                      className={`relative w-full aspect-square rounded-[20px] transition-all duration-300 active:scale-95 flex items-center justify-center ${isActive ? 'scale-110' : 'opacity-40 grayscale-[0.6] scale-100'}`}
                    >
                      {isActive && (
                        <div
                          className="absolute inset-[-4px] rounded-[24px] blur-xl opacity-80 transition-all duration-300"
                          style={{ backgroundColor: style.shadow.replace('0.6', '0.4') }}
                        />
                      )}
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${style.gradient} rounded-[20px] transition-all duration-300 ${isActive ? `ring-[3px] ${style.activeRing} ring-offset-2 ring-offset-black` : 'border border-white/5'}`}
                        style={{ boxShadow: isActive ? `0 12px 28px -4px ${style.shadow}, inset 0 6px 16px rgba(255,255,255,0.5)` : 'none' }}
                      >
                        <div className="absolute top-1 left-2 w-[85%] h-[40%] bg-gradient-to-b from-white/40 to-transparent rounded-[10px] blur-[0.6px] pointer-events-none" />
                      </div>
                      <div className="relative z-10 w-full h-full flex items-center justify-center overflow-visible p-1">
                        {v === 'LighteningMix' ? (
                          <LightningIcon className={`w-8 h-8 transition-colors ${isActive ? 'text-white' : 'text-zinc-300'} drop-shadow-md`} />
                        ) : (
                          <span className={`text-[10px] font-black uppercase tracking-tighter italic transform scale-x-[0.95] leading-none text-center px-0.5 transition-colors ${isActive ? 'text-white' : 'text-zinc-300'}`}>
                            {style.label}
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2 — Fine tuning sliders */}
          <div className="flex flex-col gap-4">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">2. Fine Tune</span>
            <div className="flex flex-col gap-5">

              {/* Mood Slider */}
              <div className="bg-zinc-900/40 px-2 py-5 rounded-[28px] border border-palette-teal/20 relative overflow-hidden">
                <div className="flex flex-col gap-2 relative z-10">
                  <div className="flex justify-between items-center px-4">
                    <span className="text-[9px] font-black text-palette-teal/60 uppercase tracking-widest">Mood</span>
                    <AnimatedMoodLabel value={rules.moodLevel} />
                  </div>
                  <div className="px-2 py-8 -my-8 flex items-center relative touch-pan-y">
                    <div className="absolute left-2 right-2 h-1.5 bg-zinc-800 rounded-full pointer-events-none" />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={rules.moodLevel}
                      onChange={e => {
                        Haptics.light();
                        setRules(prev => ({ ...prev, moodLevel: parseFloat(e.target.value) }));
                      }}
                      className="w-full h-16 appearance-none bg-transparent cursor-pointer accent-palette-teal relative z-10 outline-none"
                    />
                  </div>
                  <div className="flex justify-between px-4 mt-1 text-[8px] font-black text-zinc-700 uppercase tracking-tighter">
                    <span>Zen</span>
                    <span>Focus</span>
                    <span>Chaos</span>
                  </div>
                </div>
              </div>

              {/* Discovery Slider */}
              <div className="bg-zinc-900/40 px-2 py-5 rounded-[28px] border border-palette-pink/20 relative overflow-hidden">
                <div className="flex flex-col gap-2 relative z-10">
                  <div className="flex justify-between items-center px-4">
                    <span className="text-[9px] font-black text-palette-pink/60 uppercase tracking-widest">Exploration</span>
                    <DiscoveryLabel value={rules.discoverLevel} />
                  </div>
                  <div className="px-2 py-8 -my-8 flex items-center relative touch-pan-y">
                    <div className="absolute left-2 right-2 h-1.5 bg-zinc-800 rounded-full pointer-events-none" />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={rules.discoverLevel}
                      onChange={e => setRules(prev => ({ ...prev, discoverLevel: parseFloat(e.target.value) }))}
                      className="w-full h-16 appearance-none bg-transparent cursor-pointer accent-palette-pink relative z-10 outline-none"
                    />
                  </div>
                  <div className="flex justify-between px-4 mt-1 text-[8px] font-black text-zinc-700 uppercase tracking-tighter">
                    <span>Favorites</span>
                    <span>Familiar</span>
                    <span>Explore</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Smart Plan Preview */}
          {smartPlan && (
            <div className="bg-zinc-900/30 border border-white/5 rounded-[20px] px-4 py-3">
              <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">{smartPlan.preset}</div>
              <div className="text-[11px] font-garet text-zinc-400">{smartPlan.summary}</div>
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerateSmartMix}
            disabled={loading}
            className="w-full relative overflow-hidden bg-gradient-to-br from-[#FF007A] via-[#FF1A8B] to-[#FF4D9F] py-5 rounded-[26px] flex items-center justify-center gap-3 active:scale-[0.98] transition-all border border-white/15 shadow-xl shadow-palette-pink/30"
          >
            <div className="absolute top-1 left-2 w-[90%] h-[40%] bg-gradient-to-b from-white/40 to-transparent rounded-full blur-[1px] animate-jelly-shimmer pointer-events-none" />
            <div className="relative z-10 flex items-center gap-3">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              )}
              <span className="text-white font-black text-sm uppercase tracking-widest">
                {loading ? 'Building Mix...' : 'Generate Smart Mix'}
              </span>
            </div>
          </button>

        </div>
      </div>
    </div>
  );

  // ── Music source list view ──
  const renderMusic = () => (
    <div className="flex flex-col gap-3 px-4 pt-24 pb-40">
      <header className="mb-4 pl-4">
        <button
          onClick={() => navigateTo('root')}
          className="text-palette-pink flex items-center gap-1 font-black text-xs uppercase tracking-widest active:opacity-50 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="text-5xl font-mango header-ombre leading-none tracking-tighter">Music</h1>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-3">Source Stations</p>
      </header>
      {MUSIC_BUTTONS.map(option => (
        <SourceButton key={option.id} option={option} onSelect={onSelect} />
      ))}
    </div>
  );

  // ── Podcast list view ──
  const renderPodcast = () => (
    <div className="flex flex-col gap-3 px-4 pt-24 pb-40">
      <header className="mb-4 pl-4">
        <button
          onClick={() => navigateTo('root')}
          className="text-palette-pink flex items-center gap-1 font-black text-xs uppercase tracking-widest active:opacity-50 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="text-5xl font-mango header-ombre leading-none tracking-tighter">Podcasts</h1>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-3">Opens in Apple Podcasts</p>
      </header>
      {PODCAST_OPTIONS.map(option => (
        <SourceButton key={option.id} option={option} onSelect={onSelect} />
      ))}
    </div>
  );

  return (
    <div className="w-full min-h-full">
      {viewMode === 'root' && renderRoot()}
      {viewMode === 'music' && renderMusic()}
      {viewMode === 'podcast' && renderPodcast()}
    </div>
  );
};

export default HomeView;
