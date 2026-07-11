import { useCallback } from 'react';

const vibrateMap: Record<string, number> = {
  light: 10,
  medium: 20,
  heavy: 40,
  rigid: 10,
  soft: 5,
  error: 50,
  success: 15,
  warning: 30,
};

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {}
}

export function useHaptic() {
  const impactOccurred = useCallback((style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => {
    try {
      window.Telegram?.WebApp?.HapticFeedback.impactOccurred(style);
    } catch {
      vibrate(vibrateMap[style] ?? 15);
    }
  }, []);

  const notificationOccurred = useCallback((type: 'error' | 'success' | 'warning') => {
    try {
      window.Telegram?.WebApp?.HapticFeedback.notificationOccurred(type);
    } catch {
      vibrate(vibrateMap[type] ?? 20);
    }
  }, []);

  const selectionChanged = useCallback(() => {
    try {
      window.Telegram?.WebApp?.HapticFeedback.selectionChanged();
    } catch {
      vibrate(5);
    }
  }, []);

  return { impactOccurred, notificationOccurred, selectionChanged };
}
