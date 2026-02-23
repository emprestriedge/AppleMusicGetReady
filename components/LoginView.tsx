import React from 'react';
import { MUSIC_PLATFORM } from '../constants';
import { appleMusicService } from '../services/appleMusicService';
import { SpotifyAuth } from '../services/spotifyAuth';
import { Haptics } from '../services/haptics';
import InkBackground from './InkBackground';

interface LoginViewProps {
  onLoginSuccess?: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const isApple = MUSIC_PLATFORM === 'apple';

  const handleLogin = async () => {
    Haptics.heavy();
    try {
      if (isApple) {
        await appleMusicService.login();
        onLoginSuccess?.();
      } else {
        await SpotifyAuth.login();
      }
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-[4000] bg-black">
      <InkBackground>
        <div className="flex flex-col items-center justify-center h-full px-8 text-center">
          <header className="mb-16 stagger-entry stagger-1">
            <h1 className="font-mango header-ombre leading-none tracking-tighter w-full" style={{ fontSize: 'clamp(3rem, 18vw, 6rem)' }}>GetReady</h1>
            <p className="ios-caption text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-6">
              AI-Powered Music Curator
            </p>
          </header>

          <div className="w-full max-w-sm space-y-6 stagger-entry stagger-2">
            <p className="text-zinc-400 text-sm leading-relaxed px-4" style={{ fontFamily: '"Avenir Next Condensed", "Avenir Next", "Avenir", sans-serif' }}>
              Connect your music library to start generating personalized mixes with Gemini AI insights.
            </p>

            {isApple ? (
              <button 
                onClick={handleLogin}
                className="relative overflow-hidden w-full bg-gradient-to-br from-[#FA243C] via-[#FA243C] to-[#FD5D93] text-white font-black py-5 rounded-[28px] flex items-center justify-center gap-4 active:scale-[0.98] transition-all shadow-2xl shadow-[#FA243C]/30 border border-white/20"
              >
                <div className="absolute top-1 left-2 w-[90%] h-[40%] bg-gradient-to-b from-white/30 to-transparent rounded-full blur-[1px] animate-jelly-shimmer pointer-events-none" />
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                  <path d="M18.71,19.5C17.88,20.74,17,21.95,15.66,22c-1.31,0-1.72-.8-3.26-.8s-2,.77-3.23.82c-1.33,0-2.3-1.33-3.13-2.53C4.4,17.1,3.15,12.35,4.8,9.49c.81-1.42,2.27-2.32,3.87-2.35,1.21,0,2.35.84,3.1.84s2.12-1,3.53-.88a4.91,4.91,0,0,1,3.83,2.1,4.78,4.78,0,0,0-2.27,4A4.85,4.85,0,0,0,19.29,18,13,13,0,0,1,18.71,19.5ZM13,3.5a4.8,4.8,0,0,0,1.18-3.41,4.61,4.61,0,0,0-3,1.56,4.42,4.42,0,0,0-1.18,3.29A4.3,4.3,0,0,0,13,3.5Z" />
                </svg>
                <span className="text-lg font-black uppercase tracking-widest">Connect Apple Music</span>
              </button>
            ) : (
              <button 
                onClick={handleLogin}
                className="relative overflow-hidden w-full bg-gradient-to-br from-[#1DB954] via-[#1DB954] to-[#24cc5c] text-white font-black py-5 rounded-[28px] flex items-center justify-center gap-4 active:scale-[0.98] transition-all shadow-2xl shadow-[#1DB954]/20 border border-white/20"
              >
                <div className="absolute top-1 left-2 w-[90%] h-[40%] bg-gradient-to-b from-white/30 to-transparent rounded-full blur-[1px] animate-jelly-shimmer pointer-events-none" />
                <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.494 17.306c-.215.353-.674.463-1.027.248-2.857-1.745-6.453-2.14-10.686-1.173-.404.093-.813-.162-.906-.566-.093-.404.162-.813.566-.906 4.63-1.06 8.598-.61 11.785 1.339.353.215.463.674.248 1.027zm1.467-3.264c-.271.44-.847.581-1.287.31-3.268-2.008-8.25-2.592-12.115-1.417-.496.15-1.022-.128-1.173-.623-.15-.496.128-1.022.623-1.173 4.417-1.34 9.907-.678 13.642 1.613.44.271.581.847.31 1.287zm.127-3.413C15.228 8.249 8.845 8.038 5.16 9.157c-.551.167-1.13-.153-1.297-.704-.167-.551.153-1.13.704-1.297 4.227-1.282 11.278-1.037 15.82 1.66.496.295.661.934.366 1.43-.295.496-.934.661-1.43.366z"/>
                </svg>
                <span className="text-lg font-black uppercase tracking-widest">Connect Spotify</span>
              </button>
            )}

            <p className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em]">
              Secure authentication via Official APIs
            </p>
          </div>
        </div>
      </InkBackground>
    </div>
  );
};

export default LoginView;
