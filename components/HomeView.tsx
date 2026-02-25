import React, { useState, useEffect } from 'react';
import { RunOption, RuleSettings, SmartMixPlan, VibeType, RunOptionType } from '../types';
import { SMART_MIX_MODES, MUSIC_BUTTONS, MOOD_ZONES, DISCOVERY_ZONES } from '../constants';
import { getPodcastShows } from './PodcastManagerView';
import { getSmartMixPlan, getMixInsight } from '../services/geminiService';
import { Haptics } from '../services/haptics';

// Tinted pink — soft, not crispy white, not bright pink
const TINTED_PINK = '#FFD6EC';
const avenir = { fontFamily: '"Avenir Next Condensed", "Avenir Next", "Avenir", sans-serif' };

export const StatusAsterisk: React.FC<{ status?: 'liked' | 'gem' | 'none' }> = ({ status = 'none' }) => {
  const finalColor = (status === 'liked' || status === 'gem') ? '#FF007A' : '#555555';
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 mr-2 sm:mr-3 mt-1" style={{ color: finalColor }}>
      <path d="M12 3V21M4.2 7.5L19.8 16.5M19.8 7.5L4.2 16.5" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
};

export const PinkAsterisk = () => <StatusAsterisk status="liked" />;

interface HomeViewProps {
  onSelect: (option: RunOption) => void;
  rules: RuleSettings;
  setRules: React.Dispatch<React.SetStateAction<RuleSettings>>;
}

type HomeViewMode = 'root' | 'music' | 'podcast';

// Mood label: teal→pink swap (Mood word is now pink, values stay dynamic)
const AnimatedMoodLabel: React.FC<{ value: number }> = ({ value }) => {
  const label = value < MOOD_ZONES.ZEN_MAX ? 'Zen' : value < MOOD_ZONES.FOCUS_MAX ? 'Focus' : 'Chaos';
  const color = value < MOOD_ZONES.ZEN_MAX ? 'text-[#C5A04D]' : value < MOOD_ZONES.FOCUS_MAX ? 'text-[#2DB9B1]' : 'text-[#FF007A]';
  return (
    <span className={`text-[10px] font-black uppercase tracking-widest transition-colors duration-300 ${color}`}>
      {label} · {Math.round(value * 100)}%
    </span>
  );
};

// Discovery label: was pink, now teal
const DiscoveryLabel: React.FC<{ value: number }> = ({ value }) => {
  const label = value <= DISCOVERY_ZONES.ZERO_CUTOFF ? 'Pure Favorites' : value <= DISCOVERY_ZONES.FAMILIAR_MAX ? `${Math.round(value * 100)}% Familiar` : `${Math.round(value * 100)}% Exploring`;
  return <span className="text-[10px] font-black text-palette-teal uppercase tracking-widest">{label}</span>;
};

const VIBE_STYLES: Record<VibeType, { gradient: string; shadow: string; activeRing: string; label: string }> = {
  Chaos:        { gradient: 'from-[#FF007A] to-[#FF4D9F]',   shadow: 'rgba(255, 0, 122, 0.6)',   activeRing: 'ring-[#FF007A]', label: 'CHAOS' },
  Zen:          { gradient: 'from-[#C5A04D] to-[#E5C16D]',   shadow: 'rgba(197, 160, 77, 0.6)',  activeRing: 'ring-[#C5A04D]', label: 'ZEN' },
  Focus:        { gradient: 'from-[#2DB9B1] to-[#40D9D0]',   shadow: 'rgba(45, 185, 177, 0.6)',  activeRing: 'ring-[#2DB9B1]', label: 'FOCUS' },
  LighteningMix:{ gradient: 'from-[#6D28D9] to-[#8B5CF6]',   shadow: 'rgba(109, 40, 217, 0.6)', activeRing: 'ring-[#6D28D9]', label: 'LIGHTNING' },
};

// CategoryCard — Music=teal, Podcast=pink, more glassy
const CategoryCard: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  shadowColor: string;
  borderColor: string;
  onClick: () => void;
}> = ({ title, description, icon, gradient, shadowColor, borderColor, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full relative overflow-hidden p-5 rounded-[32px] flex items-center gap-4 active:scale-[0.98] transition-all`}
    style={{
      background: gradient,
      boxShadow: `0 8px 32px -4px ${shadowColor}, inset 0 1px 0 rgba(255,255,255,0.25)`,
      border: `1px solid ${borderColor}`,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    }}
  >
    {/* Glass shine */}
    <div className="absolute top-0 left-0 right-0 h-[45%] bg-gradient-to-b from-white/20 to-transparent rounded-t-[32px] pointer-events-none" />
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-[32px] pointer-events-none" />
    <div className="relative z-10 w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0 border border-white/20">
      {icon}
    </div>
    <div className="relative z-10 text-left">
      <div className="text-white font-black text-lg leading-none" style={avenir}>{title}</div>
      <div className="text-white/75 text-xs mt-1 font-medium" style={avenir}>{description}</div>
    </div>
    <div className="relative z-10 ml-auto">
      <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  </button>
);

// SourceButton — tinted pink text, teal music note icon, alternating borders
const SourceButton: React.FC<{ option: RunOption; onSelect: (o: RunOption) => void; index?: number }> = ({ option, onSelect, index = 0 }) => {
  return <button
    onClick={() => { Haptics.impact(); onSelect(option); }}
    className={`w-full bg-zinc-900/60 border ${index % 2 === 0 ? 'border-palette-pink/25' : 'border-palette-teal/25'} rounded-[24px] p-4 flex items-center gap-3 active:scale-[0.98] transition-all text-left`}
  >
    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-palette-teal/20 to-palette-pink/20 border border-white/10 flex items-center justify-center flex-shrink-0">
      <svg className="w-5 h-5 text-palette-teal" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
      </svg>
    </div>
    <div className="flex-1 min-w-0">
      <div className="font-semibold text-[20px] truncate" style={{ ...avenir, color: TINTED_PINK }}>{option.name}</div>
      <div className="text-zinc-500 text-[11px] mt-0.5 truncate" style={avenir}>{option.description}</div>
    </div>
    <svg className="w-4 h-4 text-zinc-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
    </svg>
  </button>
};

const HomeView: React.FC<HomeViewProps> = ({ onSelect, rules, setRules }) => {
  const [viewMode, setViewMode] = useState<HomeViewMode>('root');
  const [vibe, setVibe] = useState<VibeType>(() => {
    if (rules.moodLevel <= MOOD_ZONES.ZEN_MAX) return 'Zen';
    if (rules.moodLevel >= 0.9) return 'LighteningMix';
    if (rules.discoverLevel >= 0.7) return 'Chaos';
    return 'Focus';
  });
  const [loading, setLoading] = useState(false);
  const [smartPlan, setSmartPlan] = useState<SmartMixPlan | null>(() => {
    try { const saved = localStorage.getItem('getready_smart_plan'); return saved ? JSON.parse(saved) : null; }
    catch { return null; }
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    const scroller = document.getElementById('main-content-scroller');
    if (scroller) scroller.scrollTop = 0;
  }, [viewMode]);

  useEffect(() => {
    if (smartPlan) localStorage.setItem('getready_smart_plan', JSON.stringify(smartPlan));
  }, [smartPlan]);

  const setVibeProfile = (v: VibeType) => {
    Haptics.impact(); setVibe(v);
    let mood = 0.5, discovery = 0.25;
    switch (v) {
      case 'Zen':           mood = 0.1;           discovery = 0.15; break;
      case 'Focus':         mood = 0.4;           discovery = 0.25; break;
      case 'Chaos':         mood = 0.8;           discovery = 0.6;  break;
      case 'LighteningMix': mood = Math.random(); discovery = Math.random() * 0.7; break;
    }
    setRules(prev => ({ ...prev, moodLevel: mood, discoverLevel: discovery }));
  };

  const handleGenerateSmartMix = async () => {
    Haptics.medium(); setLoading(true);
    try {
      const plan = await getSmartMixPlan(vibe, rules.discoverLevel, rules.moodLevel, rules.playlistLength);
      setSmartPlan(plan);
      const vibeToOptionId: Record<VibeType, string> = { Chaos: 'chaos_mix', Zen: 'zen_mix', Focus: 'focus_mix', LighteningMix: 'lightning_mix' };
      const option = SMART_MIX_MODES.find(o => o.id === vibeToOptionId[vibe]);
      if (option) { Haptics.success(); setTimeout(() => { onSelect(option); setLoading(false); }, 800); }
      else { setLoading(false); }
    } catch (e) { Haptics.error(); setLoading(false); }
  };

  const navigateTo = (mode: HomeViewMode) => { Haptics.light(); setViewMode(mode); };
  const LightningIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
  );

  // Carved flower/asterisk for Smart Mix corner decoration
  const FlowerDecor = () => (
    <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'rgba(255,255,255,0.08)', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
      <path d="M12 2C10.5 2 9.5 3.5 9.5 5c0 .8.3 1.5.7 2C9.2 6.7 8.2 6.5 7.5 7c-1.3.9-1.3 2.7 0 3.5.7.5 1.7.5 2.5.2-.2.7-.2 1.5 0 2.2-.8-.3-1.8-.3-2.5.2-1.3.8-1.3 2.6 0 3.5.7.5 1.7.3 2.2-.3-.4.5-.7 1.2-.7 2 0 1.5 1 3 2.5 3s2.5-1.5 2.5-3c0-.8-.3-1.5-.7-2 .5.6 1.5.8 2.2.3 1.3-.9 1.3-2.7 0-3.5-.7-.5-1.7-.5-2.5-.2.2-.7.2-1.5 0-2.2.8.3 1.8.3 2.5-.2 1.3-.8 1.3-2.6 0-3.5-.7-.5-1.7-.3-2.5 0 .4-.5.7-1.2.7-2C14.5 3.5 13.5 2 12 2z"/>
    </svg>
  );

  const renderRoot = () => (
    <div className="flex flex-col gap-4 px-4 pt-24 pb-40 w-full max-w-[100vw] overflow-x-hidden">
      <header className="mb-6 pl-8 stagger-entry stagger-1">
        <h1 className="text-7xl font-mango header-ombre leading-none tracking-tighter">Library</h1>
        <p className="ios-caption text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-5 ml-1">Daily Catalog</p>
      </header>

      {/* Category Cards — Music=teal, Podcast=pink, glassy */}
      <div className="flex flex-col gap-4 mb-6 stagger-entry stagger-2 w-full">
        <CategoryCard
          title="Music"
          description="Custom mixes from your top tracks."
          icon={<svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>}
          gradient="linear-gradient(135deg, rgba(45,185,177,0.45) 0%, rgba(25,162,142,0.35) 100%)"
          shadowColor="rgba(45, 185, 177, 0.3)"
          borderColor="rgba(45,185,177,0.35)"
          onClick={() => navigateTo('music')}
        />
        <CategoryCard
          title="Podcasts"
          description="Open your favorite shows."
          icon={<svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" /><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" /></svg>}
          gradient="linear-gradient(135deg, rgba(255,0,122,0.4) 0%, rgba(255,77,159,0.3) 100%)"
          shadowColor="rgba(255, 0, 122, 0.25)"
          borderColor="rgba(255,0,122,0.3)"
          onClick={() => navigateTo('podcast')}
        />
      </div>

      {/* Smart Mix Card */}
      <div className="glass-panel-gold rounded-[40px] p-4 sm:p-6 border-white/10 relative overflow-hidden group stagger-entry stagger-3 w-full">
        {/* Corner flower decoration */}
        <div className="absolute top-0 right-0 p-3 pointer-events-none">
          <FlowerDecor />
        </div>

        {/* SMART MIX label — teal */}
        <h2 className="text-[11px] font-black text-palette-teal uppercase tracking-[0.3em] mb-6">SMART MIX</h2>

        <div className="flex flex-col gap-8">
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
                      {isActive && <div className="absolute inset-[-4px] rounded-[24px] blur-xl opacity-80 transition-all duration-300" style={{ backgroundColor: style.shadow.replace('0.6', '0.4') }} />}
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

          <div className="flex flex-col gap-4">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">2. Fine Tune</span>
            <div className="flex flex-col gap-5">
              {/* Mood slider — border pink, "Mood" label pink */}
              <div className="bg-zinc-900/40 px-2 py-5 rounded-[28px] border border-palette-pink/20 relative overflow-hidden">
                <div className="flex flex-col gap-2 relative z-10">
                  <div className="flex justify-between items-center px-4">
                    <span className="text-[9px] font-black text-palette-pink/60 uppercase tracking-widest">Mood</span>
                    <AnimatedMoodLabel value={rules.moodLevel} />
                  </div>
                  <div className="px-2 py-8 -my-8 flex items-center relative touch-pan-y">
                    <div className="absolute left-2 right-2 h-1.5 bg-zinc-800 rounded-full pointer-events-none" />
                    <input type="range" min="0" max="1" step="0.01" value={rules.moodLevel}
                      onChange={e => { Haptics.light(); setRules(prev => ({ ...prev, moodLevel: parseFloat(e.target.value) })); }}
                      className="w-full h-16 appearance-none bg-transparent cursor-pointer accent-palette-pink relative z-10 outline-none"
                    />
                  </div>
                  <div className="flex justify-between px-4 mt-1 text-[8px] font-black text-zinc-700 uppercase tracking-tighter">
                    <span>Zen</span><span>Focus</span><span>Chaos</span>
                  </div>
                </div>
              </div>

              {/* Exploration slider — border teal, "Exploration" label teal */}
              <div className="bg-zinc-900/40 px-2 py-5 rounded-[28px] border border-palette-teal/20 relative overflow-hidden">
                <div className="flex flex-col gap-2 relative z-10">
                  <div className="flex justify-between items-center px-4">
                    <span className="text-[9px] font-black text-palette-teal/60 uppercase tracking-widest">Exploration</span>
                    <DiscoveryLabel value={rules.discoverLevel} />
                  </div>
                  <div className="px-2 py-8 -my-8 flex items-center relative touch-pan-y">
                    <div className="absolute left-2 right-2 h-1.5 bg-zinc-800 rounded-full pointer-events-none" />
                    <input type="range" min="0" max="1" step="0.05" value={rules.discoverLevel}
                      onChange={e => setRules(prev => ({ ...prev, discoverLevel: parseFloat(e.target.value) }))}
                      className="w-full h-16 appearance-none bg-transparent cursor-pointer accent-palette-teal relative z-10 outline-none"
                    />
                  </div>
                  <div className="flex justify-between px-4 mt-1 text-[8px] font-black text-zinc-700 uppercase tracking-tighter">
                    <span>Favorites</span><span>Familiar</span><span>Explore</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {smartPlan && (
            <div className="bg-zinc-900/30 border border-white/5 rounded-[20px] px-4 py-3">
              <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">{smartPlan.preset}</div>
              <div className="text-[11px] font-garet text-zinc-400">{smartPlan.summary}</div>
            </div>
          )}

          {/* Generate Smart Mix button — teal */}
          <button
            onClick={handleGenerateSmartMix}
            disabled={loading}
            className="w-full relative overflow-hidden bg-gradient-to-br from-[#2DB9B1] via-[#26a8a1] to-[#19A28E] py-5 rounded-[26px] flex items-center justify-center gap-3 active:scale-[0.98] transition-all border border-white/15 shadow-xl shadow-palette-teal/30"
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

  const renderMusic = () => (
    <div className="flex flex-col gap-3 px-4 pt-24 pb-40">
      <header className="mb-4 pl-4">
        {/* Back button — teal */}
        <button onClick={() => navigateTo('root')} className="text-palette-teal flex items-center gap-1 font-black text-xs uppercase tracking-widest active:opacity-50 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        {/* Music header — ombre pink */}
        <h1 className="text-7xl font-mango header-ombre leading-none tracking-tighter">Music</h1>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-3">Source Stations</p>
      </header>
      {MUSIC_BUTTONS.map((option, i) => (
        <SourceButton key={option.id} option={option} onSelect={onSelect} index={i} />
      ))}
    </div>
  );

  const renderPodcast = () => {
    const podcastShows = getPodcastShows();
    return (
      <div className="flex flex-col gap-3 px-4 pt-24 pb-40">
        <header className="mb-4 pl-4">
          {/* Back button — teal */}
          <button onClick={() => navigateTo('root')} className="text-palette-teal flex items-center gap-1 font-black text-xs uppercase tracking-widest active:opacity-50 mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          {/* Podcasts header — ombre pink */}
          <h1 className="text-7xl font-mango header-ombre leading-none tracking-tighter">Podcasts</h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-3">Opens in Apple Podcasts</p>
        </header>
        {podcastShows.length === 0 ? (
          <div className="glass-panel-gold rounded-[32px] p-10 text-center mt-4">
            <p className="text-[15px] mb-2" style={{ ...avenir, color: TINTED_PINK }}>No shows added yet</p>
            <p className="text-zinc-600 text-[12px]" style={avenir}>Go to Settings → Podcast Manager to add your favorite shows</p>
          </div>
        ) : (
          podcastShows.map((show, i) => (
            <button
              key={show.id}
              onClick={() => { Haptics.impact(); window.open(show.podcastUrl, '_blank'); }}
              className={`w-full bg-zinc-900/60 border ${i % 2 === 0 ? 'border-palette-pink/25' : 'border-palette-teal/25'} rounded-[24px] p-4 flex items-center gap-3 active:scale-[0.98] transition-all text-left`}
            >
              <img src={show.imageUrl} alt={show.name} className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-white/10" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[20px] truncate" style={{ ...avenir, color: TINTED_PINK }}>{show.name}</p>
                <p className="text-zinc-500 text-[11px] truncate mt-0.5" style={avenir}>{show.publisher}</p>
              </div>
              <svg className="w-4 h-4 text-zinc-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))
        )}
      </div>
    );
  };

  return (
    <div className="w-full min-h-full">
      {viewMode === 'root' && renderRoot()}
      {viewMode === 'music' && renderMusic()}
      {viewMode === 'podcast' && renderPodcast()}
    </div>
  );
};

export default HomeView;
