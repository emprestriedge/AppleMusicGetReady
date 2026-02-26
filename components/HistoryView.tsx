import React, { useState, useRef, useEffect } from 'react';
import { RunRecord, RunOption, RunOptionType } from '../types';
import RunView from './RunView';
import { SMART_MIX_MODES, MUSIC_BUTTONS, PODCAST_OPTIONS, MOOD_ZONES } from '../constants';
import { Haptics } from '../services/haptics';
import { musicProvider } from '../services/musicProvider';
import { AppleMusicProvider } from '../services/appleMusicProvider';
import { toastService } from '../services/toastService';

const appleLibrary = new AppleMusicProvider();

interface HistoryViewProps {
  history: RunRecord[];
  onPreviewStarted?: () => void;
  onPlayTriggered?: () => void;
}

const Badge: React.FC<{ label: string; colorClass?: string }> = ({
  label,
  colorClass = 'text-palette-pink border-palette-pink/20 bg-palette-pink/10',
}) => (
  <span className={`${colorClass} text-[9px] font-black uppercase tracking-[0.15em] px-3 py-1.5 rounded-xl border font-garet`}>
    {label}
  </span>
);

const VaultRecordRow: React.FC<{
  record: RunRecord;
  onOpen: (r: RunRecord) => void;
  onDelete: (id: string) => void;
  onPlay: (r: RunRecord) => void;
  onSaveToApple: (r: RunRecord) => void;
}> = ({ record, onOpen, onDelete, onPlay, onSaveToApple }) => {
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const SWIPE_LIMIT = -160;
  const DELETE_THRESHOLD = -120;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    if (deltaX < 0) {
      setIsSwiping(true);
      setSwipeX(Math.max(deltaX, SWIPE_LIMIT));
    }
  };

  const handleTouchEnd = () => {
    if (swipeX <= DELETE_THRESHOLD) {
      Haptics.heavy();
      onDelete(record.id);
    }
    setSwipeX(0);
    setIsSwiping(false);
    touchStartX.current = null;
  };

  const deleteOpacity = Math.min(1, Math.abs(swipeX) / 80);
  const moodVal = (record.rulesSnapshot as any).moodLevel ?? 0.5;
  const moodLabel = moodVal < MOOD_ZONES.ZEN_MAX ? 'Zen' : moodVal < MOOD_ZONES.FOCUS_MAX ? 'Focus' : 'Chaos';

  return (
    <div className="relative overflow-hidden rounded-[32px] mb-4">
      <div
        className="absolute inset-0 bg-red-600 flex items-center justify-end px-10 pointer-events-none"
        style={{ opacity: deleteOpacity }}
      >
        <div className="flex flex-col items-center gap-1">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="text-white font-black text-[10px] uppercase tracking-widest">Delete</span>
        </div>
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
        }}
        className="relative z-10"
      >
        <button
          onClick={() => onOpen(record)}
          className="w-full text-left glass-panel-gold p-6 rounded-[32px] flex flex-col gap-5 transition-all active:scale-[0.98] relative overflow-hidden group border border-white/5 shadow-2xl bg-[#0a0a0a]/40 backdrop-blur-3xl"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

          <div className="flex justify-between items-start z-10 relative">
            <div className="flex flex-col flex-1 min-w-0 pr-4">
              <span className="font-gurmukhi text-[22px] text-[#A9E8DF] leading-tight group-active:text-palette-pink transition-colors truncate">
                {record.result.playlistName || record.optionName}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mt-1 font-garet">
                {record.timestamp}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={e => { e.stopPropagation(); Haptics.medium(); onPlay(record); }}
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-palette-pink active:scale-90 transition-transform"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>

              {record.result.tracks && record.result.tracks.length > 0 && (
                <button
                  onClick={e => { e.stopPropagation(); Haptics.medium(); onSaveToApple(record); }}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-palette-teal active:scale-90 transition-transform"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 3H7c-1.1 0-2 .9-2 2v14l7-3 7 3V5c0-1.1-.9-2-2-2z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 z-10 relative">
            <Badge
              label={record.result.runType === RunOptionType.MUSIC
                ? `${record.result.tracks?.length ?? record.rulesSnapshot.playlistLength} tracks`
                : 'Show'}
              colorClass="text-palette-gold border-palette-gold/20 bg-palette-gold/10"
            />
            <Badge label={moodLabel} colorClass="text-palette-teal border-palette-teal/20 bg-palette-teal/10" />
            <Badge
              label={record.rulesSnapshot.allowExplicit ? 'Uncensored' : 'Filtered'}
              colorClass={record.rulesSnapshot.allowExplicit ? "text-[#8B5CF6] border-[#6D28D9]/40 bg-[#6D28D9]/10" : "text-zinc-500 border-zinc-700 bg-zinc-900"}
            />
            {record.rulesSnapshot.avoidRepeats && (
              <Badge label="No Dupes" colorClass="text-palette-copper border-palette-copper/20 bg-palette-copper/10" />
            )}
          </div>
        </button>
      </div>
    </div>
  );
};

const HistoryView: React.FC<HistoryViewProps> = ({ history: initialHistory, onPreviewStarted, onPlayTriggered }) => {
  const [history, setHistory] = useState<RunRecord[]>(initialHistory);
  const [viewingRecord, setViewingRecord] = useState<RunRecord | null>(null);
  const [applePromptRecord, setApplePromptRecord] = useState<RunRecord | null>(null);
  const [playlistName, setPlaylistName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setHistory(initialHistory); }, [initialHistory]);

  const handleOpenDetail = (record: RunRecord) => {
    Haptics.light();
    onPreviewStarted?.();
    setViewingRecord(record);
  };

  const handleDeleteRecord = (id: string) => {
    Haptics.heavy();
    setHistory(prev => {
      const filtered = prev.filter(r => r.id !== id);
      localStorage.setItem('spotify_buddy_history', JSON.stringify(filtered));
      return filtered;
    });
    toastService.show('Record deleted', 'info');
  };

  const handlePlayRecord = async (record: RunRecord) => {
    Haptics.medium();
    try {
      const uris = record.result.runType === RunOptionType.MUSIC
        ? record.result.tracks?.map(t => t.uri) ?? []
        : [record.result.episode?.uri].filter(Boolean) as string[];

      if (uris.length === 0) {
        toastService.show('No tracks to play', 'warning');
        return;
      }

      await musicProvider.play(uris, 0);
      onPlayTriggered?.();
      Haptics.success();
      toastService.show('Playback started', 'success');
    } catch (e: any) {
      Haptics.error();
      toastService.show(e.message || 'Playback failed', 'error');
    }
  };

  const handleSaveToAppleMusic = async () => {
    if (!applePromptRecord || !playlistName.trim()) return;
    const record = applePromptRecord;
    setSaving(true);
    Haptics.impact();

    try {
      const trackIds = record.result.tracks?.map(t => t.id) ?? [];
      const moodVal = (record.rulesSnapshot as any).moodLevel ?? 0.5;
      const moodLabel = moodVal < MOOD_ZONES.ZEN_MAX ? 'Zen' : moodVal < MOOD_ZONES.FOCUS_MAX ? 'Focus' : 'Chaos';
      const description = `Mode: ${record.optionName} | Mood: ${moodLabel} | From Vault: ${record.timestamp}`;

      const playlist = await appleLibrary.createContainer(playlistName.trim(), description);
      await appleLibrary.addTracksToPlaylist(playlist.id, trackIds);

      Haptics.success();
      toastService.show(`"${playlistName.trim()}" saved to Apple Music`, 'success');
      setApplePromptRecord(null);
    } catch (e: any) {
      toastService.show(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (viewingRecord) {
    const allOptions = [...SMART_MIX_MODES, ...MUSIC_BUTTONS, ...PODCAST_OPTIONS];
    const option = allOptions.find(o => o.name === viewingRecord.optionName) || {
      id: 'unknown',
      name: viewingRecord.optionName,
      type: viewingRecord.result.runType,
      description: 'Historical run.',
    } as RunOption;

    return (
      <RunView
        option={option}
        rules={viewingRecord.rulesSnapshot}
        onClose={() => setViewingRecord(null)}
        onComplete={() => {}}
        initialResult={viewingRecord.result}
        onPreviewStarted={onPreviewStarted}
        onPlayTriggered={onPlayTriggered}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto pt-24 pb-40 px-4 animate-in fade-in duration-500 w-full max-w-[100vw] overflow-x-hidden ios-scroller z-0 relative">

      <header className="mb-10 pl-6 pr-4 stagger-entry stagger-1">
        <h1 className="text-7xl font-mango header-ombre leading-none tracking-tighter">The Vault</h1>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-5 ml-1">Saved Mixes</p>
      </header>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-600 text-center gap-6 stagger-entry stagger-2">
          <div className="w-32 h-32 bg-zinc-900/50 rounded-full flex items-center justify-center mb-2 border border-white/5 shadow-inner">
            <svg className="w-16 h-16 opacity-20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 12l10 10 10-10L12 2z" />
            </svg>
          </div>
          <div className="flex flex-col gap-2 items-center px-6">
            <p className="text-4xl text-[#A9E8DF] drop-shadow-sm" style={{ fontFamily: '"Avenir Next Condensed", "Avenir Next", "Avenir", sans-serif' }}>The Vault is empty</p>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-700 mt-2 px-8 leading-relaxed">
              your saved generated mixes will appear here
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 stagger-entry stagger-2">
          {history.map(record => (
            <VaultRecordRow
              key={record.id}
              record={record}
              onOpen={handleOpenDetail}
              onDelete={handleDeleteRecord}
              onPlay={handlePlayRecord}
              onSaveToApple={r => {
                setPlaylistName(`${r.optionName} Mix - ${new Date(r.timestamp).toLocaleDateString()}`);
                setApplePromptRecord(r);
              }}
            />
          ))}
        </div>
      )}

      {applePromptRecord && (
        <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div
            className="bg-zinc-900 border border-white/10 rounded-[40px] p-8 w-full max-w-md flex flex-col gap-6 animate-in zoom-in duration-300 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <header>
              <h2 className="text-4xl font-mango text-palette-teal leading-none">Save to Apple Music</h2>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-2">
                Creates a playlist in your Apple Music library
              </p>
            </header>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">Playlist Name</label>
              <input
                type="text"
                value={playlistName}
                onChange={e => setPlaylistName(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-[#D1F2EB] font-garet font-bold outline-none focus:border-palette-pink transition-all"
              />
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleSaveToAppleMusic}
                disabled={saving || !playlistName.trim()}
                className="w-full bg-gradient-to-br from-palette-teal to-[#40D9D0] text-white font-black py-5 rounded-[24px] active:scale-95 transition-all uppercase tracking-widest text-xs shadow-xl disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save to Apple Music'}
              </button>
              <button
                onClick={() => setApplePromptRecord(null)}
                disabled={saving}
                className="w-full py-4 text-zinc-600 font-black uppercase tracking-widest text-[10px] active:text-zinc-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default HistoryView;
