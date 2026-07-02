import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// Telegram WebApp API (native)
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        backButton: {
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        mainButton: {
          show: () => void;
          hide: () => void;
          setText: (text: string) => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          setParams: (params: { color?: string; text_color?: string; text?: string; is_active?: boolean; is_visible?: boolean }) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        themeParams: Record<string, string>;
        colorScheme: 'light' | 'dark';
        initData: string;
        initDataUnsafe: {
          user?: { id: number; first_name: string; last_name?: string; username?: string; language_code?: string };
          chat_instance?: string;
          chat_type?: string;
          start_param?: string;
          can_send_messages?: boolean;
          auth_date: number;
          hash: string;
        };
        viewportHeight: number;
        viewportStableHeight: number;
        isExpanded: boolean;
        platform: string;
      };
    };
  }
}

interface TelegramContextType {
  isReady: boolean;
  isInTelegram: boolean;
  user: { id: number; firstName: string; lastName?: string; username?: string; languageCode?: string } | null;
  goBack: () => void;
  close: () => void;
  haptic: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  mainButton: {
    show: (text: string, onClick: () => void) => void;
    hide: () => void;
  };
}

const TelegramContext = createContext<TelegramContextType>({
  isReady: false,
  isInTelegram: false,
  user: null,
  goBack: () => {},
  close: () => {},
  haptic: {
    impactOccurred: () => {},
    notificationOccurred: () => {},
    selectionChanged: () => {},
  },
  mainButton: {
    show: () => {},
    hide: () => {},
  },
});

export function useTelegram() {
  return useContext(TelegramContext);
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isInTelegram, setIsInTelegram] = useState(false);
  const [user, setUser] = useState<TelegramContextType['user']>(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;

    if (tg) {
      setIsInTelegram(true);

      // Initialize Mini App
      tg.ready();
      tg.expand();

      // Parse user data
      if (tg.initDataUnsafe?.user) {
        const u = tg.initDataUnsafe.user;
        setUser({
          id: u.id,
          firstName: u.first_name,
          lastName: u.last_name,
          username: u.username,
          languageCode: u.language_code,
        });
      }

      // Show back button
      tg.backButton.show();
      tg.backButton.onClick(() => {
        window.history.back();
      });

      // Set theme colors for Acki Nacki style
      tg.mainButton.setParams({
        color: '#FFD700',
        text_color: '#0A0A0A',
      });
    }

    setIsReady(true);
  }, []);

  const goBack = () => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.backButton.show();
    } else {
      window.history.back();
    }
  };

  const close = () => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.close();
    }
  };

  const haptic = {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => {
      try { window.Telegram?.WebApp?.HapticFeedback.impactOccurred(style); } catch {}
    },
    notificationOccurred: (type: 'error' | 'success' | 'warning') => {
      try { window.Telegram?.WebApp?.HapticFeedback.notificationOccurred(type); } catch {}
    },
    selectionChanged: () => {
      try { window.Telegram?.WebApp?.HapticFeedback.selectionChanged(); } catch {}
    },
  };

  const mainButton = {
    show: (text: string, onClick: () => void) => {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        tg.mainButton.setText(text);
        tg.mainButton.onClick(onClick);
        tg.mainButton.show();
      }
    },
    hide: () => {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        tg.mainButton.hide();
      }
    },
  };

  return (
    <TelegramContext.Provider value={{ isReady, isInTelegram, user, goBack, close, haptic, mainButton }}>
      {children}
    </TelegramContext.Provider>
  );
}
