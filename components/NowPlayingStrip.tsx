import React, { useState, useEffect, useRef } from 'react';
import { musicProvider } from '../services/musicProvider';
import { Haptics } from '../services/haptics';

interface NowPlayingStripProps {
  onStripClick?: () => void;
  onClose?: () => void;
}

const NowPlayingStrip: React.FC<NowPlayingStripProps> = ({ onStripClick, onClose }) => {
  const [playbackState, setPlaybackState] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isManuallyDismissed, setIsManuallyDismissed] = useState(false);
  const lastTrackUri = useRef<string | null>(null);

  // Gesture state
  const [dragX, setDragX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const hasMovedSignificant = useRef(false);
  const DISMISS_THRESHOLD = 50;

  const fetchPlayback = async () => {
    try {
      const state = await musicProvider.getPlaybackStatus();

      if (state && state.currentTrack) {
        if (state.currentTrack.uri !== lastTrackUri.current) {
          setIsManuallyDismissed(false);
          lastTrackUri.current = state.currentTrack.uri;
        }
        setPlaybackState(state);
        if (!isManuallyDismissed) setIsVisible(true);
      } else {
        setIsVisible(false);
        setIsManuallyDismissed(false);
      }
    } catch {
      setIsVisible(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(fetchPlayback, 2000);
    fetchPlayback();
    return () => clearInterval(interval);
  }, [isManuallyDismissed]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsSwiping(true);
    hasMovedSignificant.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(deltaX) > 5) hasMovedSignificant.current = true;
    setDragX(deltaX);
  };

  const handleTouchEnd = async () => {
    if (touchStartX.current === null) return;
    const finalX = dragX;
    setIsSwiping(false);
    touchStartX.current = null;

    if (Math.abs(finalX) > DISMISS_THRESHOLD) {
      Haptics.impact();
      setDragX(finalX > 0 ? 500 : -500);
      try {
        await musicProvider.setPlaybackState('pause');
        setTimeout(() => {
          setIsVisible(false);
          setIsManuallyDismissed(true);
          setDragX(0);
          onClose?.();
        }, 300);
      } catch {
        setIsVisible(false);
        setIsManuallyDismissed(true);
        onClose?.();
      }
    } else {
      setDragX(0);
    }
  };

  const handleContainerClick = () => {
    if (!hasMovedSignificant.current) onStripClick?.();
  };

  const handleTogglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    Haptics.medium();
    try {
      const action = playbackState?.isPlaying ? 'pause' : 'play';
      await musicProvider.setPlaybackState(action);
      setPlaybackState((prev: any) => ({ ...prev, isPlaying: !prev?.isPlaying }));
      setTimeout(fetchPlayback, 400);
    } catch { }
  };

  const handleNext = async (e: React.MouseEvent) => {
    e.stopPropagation();
    Haptics.medium();
    try {
      await musicProvider.setPlaybackState('next');
      setTimeout(fetchPlayback, 600);
    } catch { }
  };

  const handlePrevious = async (e: React.MouseEvent) => {
    e.stopPropagation();
    Haptics.medium();
    try {
      await musicProvider.setPlaybackState('previous');
      setTimeout(fetchPlayback, 600);
    } catch { }
  };

  if (!isVisible || !playbackState || isManuallyDismissed) return null;

  const track = playbackState.currentTrack;
  const isPlaying = playbackState.isPlaying;
  const deviceName = track?.deviceName || 'iPhone';
  const imageUrl = track?.imageUrl || track?.albumArt;
  const progressPct = playbackState.progressMs && playbackState.durationMs
    ? (playbackState.progressMs / playbackState.durationMs) * 100
    : 0;

  return (
    <div
      className={`fixed bottom-[96px] left-0 right-0 z-[9999] h-16 cursor-pointer touch-none select-none px-4 ${!isSwiping ? 'transition-all duration-300' : ''}`}
      style={{
        transform: `translateX(${dragX}px)`,
        opacity: Math.max(0, 1 - Math.abs(dragX) / (DISMISS_THRESHOLD * 2.5)),
      }}
      onClick={handleContainerClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="bg-black/30 backdrop-blur-3xl border-t border-purple-500/30 rounded-[34px] overflow-hidden flex flex-col shadow-[0_0_25px_rgba(109,40,217,0.35),0_32px_64px_-16px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15)] transition-all active:scale-[0.99] h-full">

        {/* Progress bar */}
        <div className="w-full h-[3px] bg-white/5">
          <div
            className="h-full bg-palette-teal shadow-[0_0_12px_rgba(45,185,177,0.8)] transition-all duration-1000 ease-linear"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="px-5 flex-1 flex items-center gap-4">
          {/* Album art */}
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-white/10 relative shadow-xl">
            {imageUrl ? (
              <img src={imageUrl} className="w-full h-full object-cover" alt="Art" />
            ) : (
              <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                <svg className="w-5 h-5 text-zinc-700" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
            )}
            {!isPlaying && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              </div>
            )}
          </div>

          {/* Track info */}
          <div className="flex-1 min-w-0">
            <h4 className="text-[12px] font-garet font-black text-white truncate leading-tight tracking-tight drop-shadow-sm">
              {track?.name || track?.title}
            </h4>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-zinc-300 font-bold truncate max-w-[50%] drop-shadow-sm">
                {track?.artistName || track?.artist}
              </span>
              <span className="text-white/20 font-black text-[8px] shrink-0">•</span>
              <span className="text-[9px] text-palette-teal font-black uppercase tracking-[0.1em] truncate drop-shadow-sm">
                {deviceName}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevious}
              aria-label="Previous Track"
              className="w-8 h-8 flex items-center justify-center text-white bg-black/20 border border-white/5 hover:bg-white/10 active:scale-90 transition-all rounded-full"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>

            <button
              onClick={handleTogglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-10 h-10 flex items-center justify-center text-white active:scale-90 transition-transform rounded-full bg-black/20 border border-white/5 shadow-inner"
            >
              {isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button
              onClick={handleNext}
              aria-label="Next Track"
              className="w-8 h-8 flex items-center justify-center text-white bg-black/20 border border-white/5 hover:bg-white/10 active:scale-90 transition-all rounded-full"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NowPlayingStrip;
