import React, { useState, useEffect } from 'react';
import { BlockStore } from '../services/blockStore';
import { BlockedTrack } from '../types';
import { Haptics } from '../services/haptics';
import { PinkAsterisk } from './HomeView';

interface BlockedTracksViewProps {
  onBack: () => void;
}

const BlockedTracksView: React.FC<BlockedTracksViewProps> = ({ onBack }) => {
  const [blocked, setBlocked] = useState<BlockedTrack[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const scroller = document.getElementById('main-content-scroller');
    if (scroller) scroller.scrollTop = 0;
    setBlocked(BlockStore.getBlocked());
  }, []);

  const handleUnhide = (id: string) => {
    Haptics.impact();
    BlockStore.removeBlocked(id);
    setBlocked(prev => prev.filter(t => t.id !== id));
  };

  const filtered = blocked.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.artist.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="pt-24 px-4 animate-in slide-in-from-right duration-300 pb-40">
      <header className="mb-8 flex flex-col gap-2 px-2">
        {/* Item 4: back button teal */}
        <button
          onClick={onBack}
          className="text-palette-teal flex items-center gap-1 font-black text-xs uppercase tracking-widest active:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-garet">Settings</span>
        </button>
        <h1 className="text-6xl font-mango header-ombre leading-none mt-2">Hidden Tracks</h1>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mt-2 ml-1">Manage items that will never appear in mixes</p>
      </header>

      <div className="flex flex-col gap-6">
        <div className="px-2">
          <div className="relative group">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search hidden names or artists..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-12 py-4 text-[#A9E8DF] font-garet font-bold outline-none focus:border-palette-teal/50 transition-all"
            />
            <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-palette-teal transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="glass-panel-gold rounded-[40px] overflow-hidden divide-y divide-white/5 border border-white/5 shadow-2xl">
          {filtered.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center gap-4">
              <span className="text-4xl opacity-20">🚫</span>
              <p className="text-zinc-500 font-garet font-medium text-lg">No matches found.</p>
            </div>
          ) : (
            filtered.map((track) => (
              <div key={track.id} className="flex items-center p-6 group">
                {/* Item 5: asterisk — teal instead of pink */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 mr-2 sm:mr-3 mt-1" style={{ color: '#2DB9B1' }}>
                  <path d="M12 3V21M4.2 7.5L19.8 16.5M19.8 7.5L4.2 16.5" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                </svg>
                <div className="flex flex-col min-w-0 flex-1 pr-4">
                  <span className="text-[18px] font-garet font-bold text-[#D1F2EB] truncate leading-tight group-active:text-palette-teal transition-colors">
                    {track.name}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-zinc-500 font-medium truncate">{track.artist}</span>
                    <span className="text-zinc-700 font-black text-[8px]">•</span>
                    <span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">
                      {new Date(track.addedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {/* Item 5: unhide button teal */}
                <button
                  onClick={() => handleUnhide(track.id)}
                  className="shrink-0 bg-palette-teal/10 border border-palette-teal/20 text-palette-teal text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl active:bg-palette-teal active:text-white transition-all active:scale-90"
                >
                  Unhide
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockedTracksView;
