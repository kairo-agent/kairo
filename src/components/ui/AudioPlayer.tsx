'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface AudioPlayerProps {
  src: string;
  mimeType?: string;
  onError?: () => void;
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioPlayer({ src, mimeType, onError }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => setDuration(audio.duration);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => { setPlaying(false); setCurrentTime(0); };
    const onErr = () => { setError(true); onError?.(); };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onErr);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onErr);
    };
  }, [onError]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  }, [playing]);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
    setCurrentTime(audio.currentTime);
  }, [duration]);

  if (error) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg w-[280px]" style={{ background: 'rgba(0,0,0,0.15)' }}>
      <audio ref={audioRef} preload="metadata" src={src}>
        {mimeType && <source src={src} type={mimeType} />}
      </audio>

      {/* Play/Pause */}
      <button onClick={toggle} className="w-7 h-7 flex items-center justify-center rounded-full bg-[var(--accent-primary)] text-[var(--kairo-midnight)] flex-shrink-0 hover:opacity-80 transition-opacity">
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Progress + Time */}
      <div className="flex-1 min-w-0">
        {/* Progress bar */}
        <div className="h-1 rounded-full cursor-pointer" style={{ background: 'rgba(255,255,255,0.2)' }} onClick={seek}>
          <div className="h-full rounded-full bg-[var(--accent-primary)] transition-[width] duration-100" style={{ width: `${progress}%` }} />
        </div>
        {/* Time */}
        <div className="flex justify-between mt-0.5">
          <span className="text-[10px] opacity-60">{formatTime(currentTime)}</span>
          <span className="text-[10px] opacity-60">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
