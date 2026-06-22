import { useI18n, LANGUAGES } from '../i18n';

interface Props {
  onBack: () => void;
}

export default function LanguageSelector({ onBack }: Props) {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto overflow-hidden">
      <div className="shrink-0 px-3 pt-3 pb-2">
        <div className="text-sm font-bold text-white mb-2">🌐 {t('menu.rules')}</div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        <div className="flex flex-col gap-1.5">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                lang === l.code
                  ? 'bg-neon-blue/20 border border-neon-blue/40 text-white'
                  : 'bg-white/5 border border-white/5 text-white/60 active:bg-white/10'
              }`}
            >
              <span className="text-lg">{l.flag}</span>
              <span className="text-sm font-medium">{l.name}</span>
              {lang === l.code && <span className="ml-auto text-neon-blue text-xs">✓</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 px-3 pb-3">
        <button
          onClick={onBack}
          className="w-full py-2.5 rounded-lg font-bold text-sm bg-white/5 border border-white/10 text-white/60 active:bg-white/10 active:scale-[0.98] transition-all"
        >
          {t('deck.back')}
        </button>
      </div>
    </div>
  );
}
