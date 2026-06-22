import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import translations from './translations';

type Lang = 'ru' | 'en' | 'es' | 'pt' | 'ar' | 'zh' | 'tr' | 'uk' | 'de' | 'fr' | 'hi' | 'id' | 'ja' | 'ko' | 'pl';

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({ lang: 'ru', setLang: () => {}, t: (k) => k });

export function useI18n() { return useContext(I18nContext); }

export const LANGUAGES: { code: Lang; name: string; flag: string }[] = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'id', name: 'Bahasa', flag: '🇮🇩' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
];

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try { return (localStorage.getItem('acki-lang') as Lang) || 'ru'; } catch { return 'ru'; }
  });
  const [, forceUpdate] = useState(0);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem('acki-lang', l);
    forceUpdate((n) => n + 1);
  }, []);

  // Translations are stored as flat keys: { 'menu.pvp': 'PvP', 'menu.ai': 'AI Battle' }
  const t = useCallback((key: string): string => {
    const langTranslations = translations[lang];
    if (!langTranslations) return key;
    return langTranslations[key] ?? key;
  }, [lang]);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}
