import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'acki-music-enabled';

export function useMusic() {
  const [isEnabled, setIsEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved !== 'false'; // default: enabled
    } catch { return true; }
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevEnabledRef = useRef(isEnabled);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, isEnabled ? 'true' : 'false');
  }, [isEnabled]);

  useEffect(() => {
    const audio = new Audio('/music/Neon Requiem.mp3');
    audio.loop = true;
    audio.volume = 0.3;
    audioRef.current = audio;

    const playAttempt = () => {
      if (isEnabled) {
        audio.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    };

    // Try to play immediately
    playAttempt();

    // If autoplay blocked, try on user interaction
    const handleInteraction = () => {
      if (!audioRef.current) return;
      if (isEnabled && audio.paused) {
        audio.play().then(() => setIsPlaying(true)).catch(() => {});
      }
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle enable/disable changes
  useEffect(() => {
    if (prevEnabledRef.current === isEnabled) return;
    prevEnabledRef.current = isEnabled;

    const audio = audioRef.current;
    if (!audio) return;

    if (isEnabled) {
      audio.volume = 0.3;
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [isEnabled]);

  const toggle = useCallback(() => {
    setIsEnabled((prev) => !prev);
  }, []);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  const resume = useCallback(() => {
    if (!isEnabled) return;
    const audio = audioRef.current;
    if (audio) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isEnabled]);

  return { isEnabled, isPlaying, toggle, pause, resume };
}
