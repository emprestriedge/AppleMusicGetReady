import React, { useState, useEffect } from 'react';
import { RuleSettings } from '../types';
import { Haptics } from '../services/haptics';
import { toastService } from '../services/toastService';

interface PodcastShow {
  id: string;
  name: string;
  publisher: string;
  imageUrl: string;
  podcastUrl: string; // apple podcasts URL
}

interface iTunesResult {
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl100: string;
  collectionViewUrl: string;
}

interface PodcastManagerViewProps {
  rules: RuleSettings;
  setRules: React.Dispatch<React.SetStateAction<RuleSettings>>;
  onBack: () => void;
}

const STORAGE_KEY = 'getready_podcasts';

export const getPodcastShows = (): PodcastShow[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
};

const savePodcastShows = (shows: PodcastShow[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shows));
};

const PodcastManagerView: React.FC<PodcastManagerViewProps> = ({ onBack }) => {
  const [shows, setShows] = useState<PodcastShow[]>(getPodcastShows);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [candidates, setCandidates] = useState<iTunesResult[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<iTunesResult | null>(null);

  useEffect(() => {
    const scroller = document.getElementById('main-content-scroller');
    if (scroller) scroller.scrollTop = 0;
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    Haptics.impact();
    setIsSearching(true);
    setCandidates([]);

    try {
      const encoded = encodeURIComponent(searchQuery.trim());
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encoded}&media=podcast&entity=podcast&limit=10`
      );
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        setCandidates(data.results);
        setShowPicker(true);
        Haptics.success();
      } else {
        Haptics.error();
        toastService.show('No podcasts found — try a different name', 'warning');
      }
    } catch (e) {
      Haptics.error();
      toastService.show('Search failed — check your connection', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedCandidate) return;

    // Check for duplicate
    const isDupe = shows.some(s => s.id === String(selectedCandidate.collectionId));
    if (isDupe) {
      toastService.show('That show is already in your list', 'warning');
      return;
    }

    const newShow: PodcastShow = {
      id: String(selectedCandidate.collectionId),
      name: selectedCandidate.collectionName,
      publisher: selectedCandidate.artistName,
      imageUrl: selectedCandidate.artworkUrl100.replace('100x100', '512x512'),
      podcastUrl: selectedCandidate.collectionViewUrl,
    };

    const updated = [...shows, newShow];
    setShows(updated);
    savePodcastShows(updated);
    Haptics.success();
    toastService.show(`"${newShow.name}" added!`, 'success');
    setShowPicker(false);
    setSelectedCandidate(null);
    setSearchQuery('');
    setCandidates([]);
  };

  const handleRemove = (id: string) => {
    Haptics.medium();
    const updated = shows.filter(s => s.id !== id);
    setShows(updated);
    savePodcastShows(updated);
    toastService.show('Show removed', 'info');
  };

  return (
    <div className="pt-24 px-4 animate-in slide-in-from-right duration-300 pb-40">
      <header className="mb-8 flex flex-col gap-2 px-2">
        <button onClick={onBack} className="text-palette-pink flex items-center gap-1 font-black text-xs uppercase tracking-widest active:opacity-50">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Settings</span>
        </button>
        <h1 className="text-6xl font-mango header-ombre leading-none mt-2">Podcast Manager</h1>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mt-2 ml-1">Your favorite shows</p>
      </header>

      {/* Search */}
      <div className="glass-panel-gold rounded-[32px] p-6 mb-6 flex flex-col gap-4">
        <h2 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">Add a Show</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search podcast name..."
            className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-[#D1F2EB] font-medium outline-none focus:border-palette-pink transition-all"
            style={{ fontFamily: '"Avenir Next Condensed", "Avenir Next", "Avenir", sans-serif' }}
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="bg-palette-pink text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 shrink-0"
          >
            {isSearching ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Saved Shows */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">
          Your Shows ({shows.length})
        </h2>
        {shows.length === 0 ? (
          <div className="glass-panel-gold rounded-[32px] p-8 text-center">
            <p className="text-zinc-600 text-sm" style={{ fontFamily: '"Avenir Next Condensed", "Avenir Next", "Avenir", sans-serif' }}>
              No shows yet — search above to add your favorites
            </p>
          </div>
        ) : (
          shows.map(show => (
            <div key={show.id} className="glass-panel-gold rounded-[28px] p-4 flex items-center gap-4">
              <img
                src={show.imageUrl}
                alt={show.name}
                className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-white/10"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[#A9E8DF] font-semibold text-[17px] truncate"
                  style={{ fontFamily: '"Avenir Next Condensed", "Avenir Next", "Avenir", sans-serif' }}>
                  {show.name}
                </p>
                <p className="text-zinc-500 text-[11px] truncate"
                  style={{ fontFamily: '"Avenir Next Condensed", "Avenir Next", "Avenir", sans-serif' }}>
                  {show.publisher}
                </p>
              </div>
              <button
                onClick={() => handleRemove(show.id)}
                className="text-zinc-600 active:text-palette-pink transition-colors shrink-0 p-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Search Results Picker */}
      {showPicker && (
        <div
          className="fixed inset-0 z-[10001] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in duration-300"
          onClick={() => { setShowPicker(false); setSelectedCandidate(null); }}
        >
          <div
            className="bg-zinc-900 border border-white/10 rounded-[40px] w-full max-w-md h-[85vh] flex flex-col shadow-2xl animate-in zoom-in duration-300 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <header className="p-8 pb-4 shrink-0 border-b border-white/5 flex justify-between items-start">
              <div>
                <h3 className="text-4xl font-mango text-[#A9E8DF] leading-none">Select Show</h3>
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mt-2">Tap to select</p>
              </div>
              <button onClick={() => { setShowPicker(false); setSelectedCandidate(null); }} className="text-zinc-500 active:text-white">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
              {candidates.map(c => (
                <button
                  key={c.collectionId}
                  onClick={() => setSelectedCandidate(c)}
                  className={`w-full text-left rounded-3xl p-4 flex items-center gap-4 transition-all border ${
                    selectedCandidate?.collectionId === c.collectionId
                      ? 'border-palette-teal bg-palette-teal/10'
                      : 'border-white/5 bg-white/5 active:bg-white/10'
                  }`}
                >
                  <img src={c.artworkUrl100} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0 border border-white/10" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[15px] font-semibold truncate ${selectedCandidate?.collectionId === c.collectionId ? 'text-palette-teal' : 'text-[#D1F2EB]'}`}
                      style={{ fontFamily: '"Avenir Next Condensed", "Avenir Next", "Avenir", sans-serif' }}>
                      {c.collectionName}
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate"
                      style={{ fontFamily: '"Avenir Next Condensed", "Avenir Next", "Avenir", sans-serif' }}>
                      {c.artistName}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <footer className="p-6 shrink-0 border-t border-white/5 flex flex-col gap-3">
              <button
                onClick={handleConfirm}
                disabled={!selectedCandidate}
                className="w-full bg-palette-pink text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs active:scale-95 transition-all disabled:opacity-40"
              >
                Add to My Shows
              </button>
              <button
                onClick={() => { setShowPicker(false); setSelectedCandidate(null); }}
                className="w-full py-2 text-zinc-600 font-black uppercase tracking-widest text-[10px]"
              >
                Cancel
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default PodcastManagerView;
