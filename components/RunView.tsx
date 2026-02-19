**
 * RunView.tsx — Apple Music Edition
 *
 * This is the screen you see when a mix is generating and playing.
 * It replaced the Spotify-based RunView with Apple Music support.
 *
 * KEY CHANGES FROM SPOTIFY VERSION:
 * ─────────────────────────────────
 * - Uses AppleMusicPlaybackEngine instead of SpotifyPlaybackEngine
 * - Play button triggers MusicKit playback directly (no device picker needed)
 * - "Save to Spotify" replaced with "Save to Vault" only (Apple Music handles its own library)
 * - Playback state polling uses MusicKit events instead of Spotify polling API
 * - Deep link opens Apple Music app instead of Spotify
 * - Gems/liked status still works for local track marking
 * - Podcasts deep-link to Apple Podcasts app
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  RunOption, RuleSettings, RunResult, RunOptionType, Track, PodcastShowCandidate
} from '../types';
import { RuleOverrideStore } from '../services/ruleOverrideStore';
import { getEffectiveRules } from '../utils/ruleUtils';
import { applePlaybackEngine } from '../services/playbackEngine';
import { musicProvider } from '../services/musicProvider';
import { AppleMusicProvider } from '../services/appleMusicProvider';
import { BlockStore } from '../services/blockStore';
import { apiLogger } from '../services/apiLogger';
import { Haptics, ImpactFeedbackStyle } from '../services/haptics';
import { toastService } from '../services/toastService';
import { USE_MOCK_DATA } from '../constants';

// Singleton so we reuse the same MusicKit instance across calls
const appleLibrary = new AppleMusicProvider();

interface RunViewProps {
  option: RunOption;
  rules: RuleSettings;
  onClose: () => void;
  onComplete: (result: RunResult) => void;
  initialResult?: RunResult;
  onResultUpdate?: (result: RunResult) => void;
  onPlayTriggered?: () => void;
  onPreviewStarted?: () => void;
  isQueueMode?: boolean;
  onRegenerate?: () => void;
}

type GenStatus = 'IDLE' | 'RUNNING' | 'DONE' | 'ERROR';
type ViewMode = 'PREVIEW' | 'QUEUE';

// ─────────────────────────────────────────────
//  TrackRow — individual track in the list
// ─────────────────────────────────────────────

const TrackRow: React.FC<{
  track: Track;
  isActive: boolean;
  index: number;
  onPlay: (t: Track, i: number) => void;
  onStatusToggle: (t: Track) => void;
  onBlock: (t: Track) => void;
  onHaptic: () => void;
}> = ({ track, isActive, index, onPlay, onStatusToggle, onBlock, onHaptic }) => {
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const lastTapTime = useRef<number>(0);
  const timerRef = useRef<any>(null);
  const isLongPress = useRef(false);

  const SWIPE_LIMIT = -100;
  const LONG_PRESS_DURATION = 500;
  const MOVEMENT_THRESHOLD = 12;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsPressed(true);
    isLongPress.current = false;

    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      onHaptic();
      onBlock(track);
    }, LONG_PRESS_DURATION);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;

    if (Math.abs(deltaX) > MOVEMENT_THRESHOLD) {
      clearTimeout(timerRef.current);
    }

    if (deltaX < 0) {
      setIsSwiping(true);
      setSwipeX(Math.max(SWIPE_LIMIT, deltaX));
    }
  };

  const handleTouchEnd = () => {
    clearTimeout(timerRef.current);
    setIsPressed(false);

    if (!isLongPress.current) {
      if (swipeX <= SWIPE_LIMIT / 2) {
        const now = Date.now();
        if (now - lastTapTime.current < 300) {
          onStatusToggle(track);
        } else {
          onHaptic();
          onBlock(track);
        }
        lastTapTime.current = now;
      } else if (!isSwiping) {
        onPlay(track, index);
      }
    }

    setSwipeX(0);
    setIsSwiping(false);
    touchStartX.current = null;
  };

  const gemColor = track.status === 'gem'
    ? 'text-[#C5A04D]'
    : track.status === 'liked'
    ? 'text-palette-teal'
    : 'text-zinc-700';

  return (
    <div className="relative overflow-hidden">
      {/* Swipe-to-block action revealed underneath */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-red-500/20 px-4 transition-opacity"
        style={{ opacity: Math.abs(swipeX) / 80, width: 80 }}
      >
        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => onPlay(track, index)}
        style={{ transform: `translateX(${swipeX}px)`, transition: isSwiping ? 'none' : 'transform 0.3s ease' }}
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors select-none
          ${isActive ? 'bg-palette-teal/10' : isPressed ? 'bg-white/5' : 'bg-transparent'}`}
      >
        {/* Album art */}
        <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-900">
          {track.imageUrl ? (
            <img src={track.imageUrl} alt={track.album} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-5 h-5 text-zinc-700" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          )}
        </div>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <div className={`font-black text-[13px] truncate leading-tight ${isActive ? 'text-palette-teal' : 'text-white'}`}>
            {track.title}
          </div>
          <div className="text-zinc-500 text-[11px] truncate font-medium">{track.artist}</div>
        </div>

        {/* New badge */}
        {track.isNew && (
          <span className="text-[8px] font-black uppercase tracking-widest text-palette-pink border border-palette-pink/30 rounded px-1.5 py-0.5 flex-shrink-0">
            New
          </span>
        )}

        {/* Playing indicator / gem status */}
        {isActive ? (
          <div className="flex gap-[3px] items-end h-4 flex-shrink-0">
            {[1, 2, 3].map(b => (
              <div key={b} className="w-[3px] bg-palette-teal rounded-full animate-bounce"
                style={{ height: `${b * 4}px`, animationDelay: `${b * 0.15}s` }} />
            ))}
          </div>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); onStatusToggle(track); }}
            className={`flex-shrink-0 transition-colors active:scale-125 ${gemColor}`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
//  Main RunView
// ─────────────────────────────────────────────

const RunView: React.FC<RunViewProps> = ({
  option, rules, onClose, onComplete, initialResult,
  onResultUpdate, onPlayTriggered, onPreviewStarted, isQueueMode, onRegenerate
}) => {
  const [genStatus, setGenStatus] = useState<GenStatus>(initialResult ? 'DONE' : 'IDLE');
  const [viewMode, setViewMode] = useState<ViewMode>(isQueueMode ? 'QUEUE' : 'PREVIEW');
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const [namingPrompt, setNamingPrompt] = useState<'vault' | 'apple' | null>(null);
  const [saveName, setSaveName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [currentPlayingUri, setCurrentPlayingUri] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(initialResult || null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const generationRequestId = useRef(0);
  const effectiveRules = getEffectiveRules(rules, RuleOverrideStore.getForOption(option.id));

  const fireHaptic = () => {
    const el = document.getElementById('local-haptic-trigger');
    if (el) (el as HTMLInputElement).click();
  };

  // ── Generate mix on mount ──────────────────

  useEffect(() => {
    if (initialResult) {
      setResult(initialResult);
      setGenStatus('DONE');
      return;
    }
    if (genStatus === 'IDLE') startRun();

    // Poll MusicKit playback state every 2s to highlight active track
    const poll = setInterval(async () => {
      try {
        const state = await musicProvider.getPlaybackStatus();
        if (state?.currentTrack?.uri) {
          setCurrentPlayingUri(state.currentTrack.uri);
          setIsPlaying(state.isPlaying);
        }
      } catch { /* silent */ }
    }, 2000);

    return () => clearInterval(poll);
  }, [option, rules, initialResult]);

  useEffect(() => {
    if (viewMode !== 'QUEUE') onPreviewStarted?.();
  }, [viewMode]);

  // ── Mix generation ─────────────────────────

  const startRun = async () => {
    generationRequestId.current++;
    const reqId = generationRequestId.current;

    setGenStatus('RUNNING');
    setError(null);
    Haptics.medium();

    try {
      const runResult = await applePlaybackEngine.generateRunResult(option, effectiveRules);
      if (reqId !== generationRequestId.current) return;

      setResult(runResult);
      setGenStatus('DONE');
      onResultUpdate?.(runResult);
      Haptics.success();
    } catch (err: any) {
      if (reqId === generationRequestId.current) {
        setError(err.message || 'Composition failed');
        setGenStatus('ERROR');
        Haptics.error();
      }
    }
  };

  // ── Playback ───────────────────────────────

  /**
   * handlePlayAll — sends the full track list to Apple Music and starts playing.
   * No device picker needed — MusicKit plays on the current device automatically.
   */
  const handlePlayAll = async () => {
    if (!result?.tracks || result.tracks.length === 0) return;
    Haptics.heavy();

    try {
      // For podcasts, deep-link to Apple Podcasts app instead
      if (option.type === RunOptionType.PODCAST) {
        const podcastUrl = `podcasts://`;
        window.location.href = podcastUrl;
        return;
      }

      const uris = result.tracks.map(t => t.uri);
      await musicProvider.play(uris, 0);
      setViewMode('QUEUE');
      setIsPlaying(true);
      onPlayTriggered?.();
      toastService.show('Mix loaded into Apple Music', 'success');
    } catch (err: any) {
      toastService.show(err.message || 'Playback failed', 'error');
      Haptics.error();
    }
  };

  /**
   * handlePlayTrack — tapping a specific track in the list starts from that position.
   */
  const handlePlayTrack = async (track: Track, index: number) => {
    if (!result?.tracks) return;
    try {
      const uris = result.tracks.map(t => t.uri);
      await musicProvider.play(uris, index);
      setCurrentPlayingUri(track.uri);
      setIsPlaying(true);
      onPlayTriggered?.();
      Haptics.light();
    } catch (err: any) {
      toastService.show(err.message || 'Playback failed', 'error');
    }
  };

  // ── Track actions ──────────────────────────

  /**
   * handleToggleStatus — marks a track as a Gem (★) or removes the mark.
   *
   * Adding a gem: saves the track to the "GetReady Gems ⭐" Apple Music playlist.
   * Removing a gem: updates the app UI only — Apple Music web API doesn't support
   * removing individual tracks from playlists, so the user would need to do that
   * manually in the Apple Music app if they want it gone from there too.
   */
  const handleToggleStatus = async (track: Track) => {
    if (!result?.tracks) return;
    const isGem = track.status === 'gem';
    const newStatus = isGem ? 'none' : 'gem';

    // Optimistic UI update — show the change immediately
    const originalTracks = [...result.tracks];
    const updatedTracks = result.tracks.map(t =>
      t.id === track.id ? { ...t, status: newStatus as 'gem' | 'none' | 'liked' } : t
    );
    const updatedResult = { ...result, tracks: updatedTracks };
    setResult(updatedResult);
    onResultUpdate?.(updatedResult);

    if (!isGem) {
      // Adding to Gems — write to Apple Music library
      Haptics.success();
      try {
        if (!USE_MOCK_DATA) {
          await appleLibrary.addTrackToGems(track.id);
        }
        toastService.show('Added to GetReady Gems ⭐', 'success');
      } catch (err: any) {
        // Revert UI if the API call failed
        setResult({ ...result, tracks: originalTracks });
        onResultUpdate?.({ ...result, tracks: originalTracks });
        toastService.show(`Couldn't save to Apple Music: ${err.message}`, 'error');
      }
    } else {
      // Removing gem — UI only (Apple Music limitation)
      Haptics.medium();
      await appleLibrary.removeTrackFromGems(track.id);
      toastService.show('Gem removed (remove from Apple Music playlist manually if needed)', 'info');
    }
  };

  /**
   * handleBlockTrack — hides a track from all future mixes permanently.
   */
  const handleBlockTrack = (track: Track) => {
    if (!result?.tracks) return;
    Haptics.heavy();
    BlockStore.addBlocked(track);
    const updatedTracks = result.tracks.filter(t => t.id !== track.id);
    const updatedResult = { ...result, tracks: updatedTracks };
    setResult(updatedResult);
    onResultUpdate?.(updatedResult);
    toastService.show('Track hidden from future mixes', 'info');
  };

  // ── Save to Vault ──────────────────────────

  const handleSaveToVaultPrompt = () => {
    setSaveName(`${option.name} Mix — ${new Date().toLocaleDateString()}`);
    setNamingPrompt('vault');
    setShowSaveOptions(false);
  };

  const handleSaveToAppleMusicPrompt = () => {
    setSaveName(`${option.name} Mix — ${new Date().toLocaleDateString()}`);
    setNamingPrompt('apple');
    setShowSaveOptions(false);
  };

  const handleConfirmSave = async () => {
    if (!saveName.trim() || !result) return;
    Haptics.impact();

    if (namingPrompt === 'vault') {
      // Save to in-app Vault history
      const updatedResult = { ...result, playlistName: saveName.trim() };
      onComplete(updatedResult);
      toastService.show(`Archived as "${saveName.trim()}"`, 'success');
      setNamingPrompt(null);

    } else if (namingPrompt === 'apple') {
      // Create a real playlist in the user's Apple Music library
      setIsSaving(true);
      try {
        const trackIds = (result.tracks || []).map(t => t.id);
        const playlist = await appleLibrary.createContainer(saveName.trim(), `Generated by GetReady • ${option.name}`);
        await appleLibrary.addTracksToPlaylist(playlist.id, trackIds);
        Haptics.success();
        toastService.show(`"${saveName.trim()}" saved to Apple Music ✓`, 'success');
        setNamingPrompt(null);
      } catch (err: any) {
        toastService.show(`Apple Music save failed: ${err.message}`, 'error');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleRegenerate = () => {
    Haptics.medium();
    onRegenerate?.();
    startRun();
  };

  // ── Derived values ─────────────────────────

  const totalDurationStr = useMemo(() => {
    if (!result?.tracks) return null;
    const mins = Math.floor(
      result.tracks.reduce((acc, t) => acc + (t.durationMs || 0), 0) / 60000
    );
    return mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} mins`;
  }, [result]);

  // ── Loading state ──────────────────────────

  if (genStatus === 'RUNNING') {
    return (
      <div className="fixed inset-0 z-[1000] bg-black/95 flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
        <div className="w-20 h-20 border-4 border-palette-pink border-t-transparent rounded-full animate-spin mb-8" />
        <h2 className="text-4xl font-mango text-[#D1F2EB] mb-2">Composing Mix</h2>
        <p className="text-zinc-500 font-garet text-center max-w-xs uppercase tracking-widest text-[10px]">
          Building your {option.name} mix from Apple Music...
        </p>
      </div>
    );
  }

  // ── Error state ────────────────────────────

  if (genStatus === 'ERROR') {
    return (
      <div className="fixed inset-0 z-[1000] bg-black/95 flex flex-col items-center justify-center p-8 gap-6">
        <div className="text-5xl">⚠️</div>
        <h2 className="text-3xl font-mango text-palette-pink">Mix Failed</h2>
        <p className="text-zinc-500 text-center text-sm max-w-xs">{error}</p>
        <button
          onClick={startRun}
          className="bg-palette-pink text-white font-black uppercase tracking-widest text-sm px-8 py-4 rounded-2xl active:scale-95 transition-all"
        >
          Try Again
        </button>
        <button onClick={onClose} className="text-zinc-600 font-black uppercase tracking-widest text-xs">
          Back
        </button>
      </div>
    );
  }

  // ── Main view ──────────────────────────────

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col animate-in slide-in-from-bottom duration-500 pb-[85px]">

      {/* Header */}
      <header className="px-6 pb-4 flex items-center justify-between border-b border-white/5 bg-black/30 shrink-0 pt-16">
        <button
          onClick={() => { Haptics.impactAsync(ImpactFeedbackStyle.Light); onClose(); }}
          className="text-palette-pink text-[14px] font-black uppercase tracking-[0.2em] active:opacity-50"
        >
          Back
        </button>

        <div className="flex flex-col items-center">
          <span className="font-black text-[10px] uppercase tracking-[0.5em] text-zinc-600 leading-none">
            {viewMode === 'QUEUE' ? 'Now Playing' : 'Preview Mix'}
          </span>
          <span className="font-mango text-white text-xl mt-0.5 leading-none">{option.name}</span>
          {result?.sourceSummary && (
            <span className="text-[9px] text-zinc-600 font-medium mt-1 uppercase tracking-widest truncate max-w-[200px]">
              {result.sourceSummary}
            </span>
          )}
        </div>

        {/* Play All / Source button */}
        <button
          onClick={viewMode === 'PREVIEW' ? handlePlayAll : () => setViewMode('PREVIEW')}
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all active:scale-95 ${
            viewMode === 'PREVIEW'
              ? 'bg-palette-pink shadow-[0_0_16px_rgba(255,0,122,0.4)]'
              : 'bg-zinc-900 border border-white/10'
          }`}
        >
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            {viewMode === 'PREVIEW' ? (
              <path d="M8 5v14l11-7z" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
            )}
          </svg>
          <span className="font-black text-[9px] uppercase tracking-wider text-white leading-none">
            {viewMode === 'PREVIEW' ? 'Play' : 'List'}
          </span>
        </button>
      </header>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto ios-scroller">
        <div className="px-4 py-4 flex flex-col gap-2">

          {/* Duration summary */}
          {totalDurationStr && result?.tracks && (
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                {result.tracks.length} tracks
              </span>
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                {totalDurationStr}
              </span>
            </div>
          )}

          <div className="bg-[#0a0a0a]/60 backdrop-blur-3xl rounded-[32px] overflow-hidden border border-white/10 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9)]">
            <div className="divide-y divide-white/5">
              {result?.tracks?.map((track, i) => (
                <TrackRow
                  key={track.uri + i}
                  track={track}
                  isActive={currentPlayingUri === track.uri}
                  index={i}
                  onPlay={handlePlayTrack}
                  onStatusToggle={handleToggleStatus}
                  onBlock={handleBlockTrack}
                  onHaptic={fireHaptic}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom action bar — Preview mode */}
      {viewMode === 'PREVIEW' && (
        <div
          className="fixed left-0 right-0 px-6 pt-10 pb-3 bg-gradient-to-t from-black via-black/95 to-transparent z-[100]"
          style={{ bottom: '85px' }}
        >
          <div className="flex items-center gap-4">
            {/* Regenerate */}
            <button
              onClick={handleRegenerate}
              className="w-14 h-14 rounded-[24px] bg-zinc-900 border border-white/10 flex items-center justify-center text-palette-gold active:scale-95 transition-all shadow-xl"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Save to Vault */}
            <button
              onClick={() => { Haptics.heavy(); setShowSaveOptions(true); }}
              className="flex-1 relative overflow-hidden bg-zinc-900 border border-white/10 py-4 rounded-[24px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-xl"
            >
              <svg className="w-5 h-5 text-palette-gold" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z" />
              </svg>
              <span className="text-white font-black text-sm uppercase tracking-widest">Save</span>
            </button>

            {/* Play All */}
            <button
              onClick={handlePlayAll}
              className="flex-1 relative overflow-hidden bg-gradient-to-br from-[#FF007A] via-[#FF1A8B] to-[#FF4D9F] py-4 rounded-[24px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-xl shadow-palette-pink/30"
            >
              <div className="absolute top-1 left-2 w-[90%] h-[40%] bg-gradient-to-b from-white/30 to-transparent rounded-full blur-[1px] pointer-events-none" />
              <svg className="w-5 h-5 text-white relative z-10" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span className="text-white font-black text-sm uppercase tracking-widest relative z-10">Play</span>
            </button>
          </div>
        </div>
      )}

      {/* Save options sheet */}
      {showSaveOptions && (
        <div className="fixed inset-0 z-[10000] flex items-end" onClick={() => setShowSaveOptions(false)}>
          <div className="w-full bg-zinc-950 border-t border-white/10 rounded-t-[32px] p-6 pb-12 flex flex-col gap-3"
            onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-2" />
            <h3 className="text-white font-black text-lg text-center mb-2">Save Mix</h3>

            {/* Save to Apple Music */}
            <button
              onClick={handleSaveToAppleMusicPrompt}
              className="w-full bg-zinc-900 border border-white/10 rounded-2xl py-4 flex items-center gap-3 px-5 active:bg-zinc-800"
            >
              <span className="text-2xl">🎵</span>
              <div className="text-left">
                <div className="text-white font-black text-sm">Save to Apple Music</div>
                <div className="text-zinc-500 text-xs">Creates a playlist in your Apple Music library</div>
              </div>
            </button>

            {/* Save to Vault */}
            <button
              onClick={handleSaveToVaultPrompt}
              className="w-full bg-zinc-900 border border-white/10 rounded-2xl py-4 flex items-center gap-3 px-5 active:bg-zinc-800"
            >
              <span className="text-2xl">📚</span>
              <div className="text-left">
                <div className="text-white font-black text-sm">Save to Vault</div>
                <div className="text-zinc-500 text-xs">Archive this mix in your in-app history</div>
              </div>
            </button>

            <button
              onClick={() => setShowSaveOptions(false)}
              className="w-full py-3 text-zinc-600 font-black uppercase tracking-widest text-[10px] active:text-zinc-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Naming prompt */}
      {namingPrompt && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/80 px-6">
          <div className="w-full max-w-sm bg-zinc-950 border border-white/10 rounded-[28px] p-6 flex flex-col gap-4">
            <h3 className="text-white font-black text-lg">
              {namingPrompt === 'apple' ? 'Name Apple Music Playlist' : 'Name This Mix'}
            </h3>
            <input
              type="text"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white font-medium text-sm outline-none focus:border-palette-pink/50"
              autoFocus
            />
            <button
              onClick={handleConfirmSave}
              disabled={isSaving}
              className="w-full bg-palette-pink text-white font-black uppercase tracking-widest text-sm py-3 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setNamingPrompt(null)}
              className="w-full py-2 text-zinc-600 font-black uppercase tracking-widest text-[10px] active:text-zinc-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <input
        type="checkbox"
        id="local-haptic-trigger"
        style={{ opacity: 0, position: 'absolute', pointerEvents: 'none', zIndex: -1 }}
      />
    </div>
  );
};

export default RunView;
