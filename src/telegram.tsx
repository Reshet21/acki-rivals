import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { init, backButton, themeParams, hapticFeedback, miniApp } from '@telegram-apps/sdk';

interface TelegramContextType {
  isReady: boolean;
  goBack: () => void;
  haptic: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  theme: {
    bg_color: string;
    text_color: string;
    hint_color: string;
    link_color: string;
    button_color: string;
    button_text_color: string;
    secondary_bg_color: string;
  };
}

const defaultTheme = {
  bg_color: '#0f0f23',
  text_color: '#ffffff',
  hint_color: '#999999',
  link_color: '#00d4ff',
  button_color: '#b742ff',
  button_text_color: '#ffffff',
  secondary_bg_color: '#1a1a2e',
};

const TelegramContext = createContext<TelegramContextType>({
  isReady: false,
  goBack: () => {},
  haptic: {
    impactOccurred: () => {},
    notificationOccurred: () => {},
    selectionChanged: () => {},
  },
  theme: defaultTheme,
});

export function useTelegram() {
  return useContext(TelegramContext);
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [theme, setTheme] = useState(defaultTheme);

  useEffect(() => {
    try {
      init();

      // Mount back button
      backButton.mount();

      // Mount theme params
      themeParams.mount();

      // Mount mini app for closing behavior
      miniApp.mount();

      // Read theme after mount
      const tp = themeParams.state();
      if (tp && Object.keys(tp).length > 0) {
        setTheme({
          bg_color: tp.bg_color || defaultTheme.bg_color,
          text_color: tp.text_color || defaultTheme.text_color,
          hint_color: tp.hint_color || defaultTheme.hint_color,
          link_color: tp.link_color || defaultTheme.link_color,
          button_color: tp.button_color || defaultTheme.button_color,
          button_text_color: tp.button_text_color || defaultTheme.button_text_color,
          secondary_bg_color: tp.secondary_bg_color || defaultTheme.secondary_bg_color,
        });
      }

      setIsReady(true);
    } catch {
      // Not in Telegram — use defaults
      setIsReady(true);
    }
  }, []);

  const goBack = () => {
    try {
      window.history.back();
    } catch {}
  };

  const haptic = {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => {
      try { hapticFeedback.impactOccurred(style); } catch {}
    },
    notificationOccurred: (type: 'error' | 'success' | 'warning') => {
      try { hapticFeedback.notificationOccurred(type); } catch {}
    },
    selectionChanged: () => {
      try { hapticFeedback.selectionChanged(); } catch {}
    },
  };

  return (
    <TelegramContext.Provider value={{ isReady, goBack, haptic, theme }}>
      {children}
    </TelegramContext.Provider>
  );
}
