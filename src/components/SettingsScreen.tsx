import { useState } from 'react';
import { useI18n, type Lang } from '../i18n';

interface Props {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: Props) {
  const { lang, setLang } = useI18n();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleReset = () => {
    localStorage.clear();
    location.reload();
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto overflow-hidden" style={{ background: '#050508' }}>
      {/* Header */}
      <div className="shrink-0 px-4 py-4 border-b" style={{ borderColor: 'rgba(255,215,0,0.1)' }}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
            ←
          </button>
          <h1 className="text-lg font-bold" style={{ color: '#FFD700' }}>Настройки</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Language Section */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,215,0,0.5)' }}>Язык</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { code: 'ru', name: 'Русский', flag: '🇷🇺' },
              { code: 'en', name: 'English', flag: '🇬🇧' },
              { code: 'es', name: 'Español', flag: '🇪🇸' },
              { code: 'pt', name: 'Português', flag: '🇧🇷' },
              { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
              { code: 'fr', name: 'Français', flag: '🇫🇷' },
              { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
              { code: 'uk', name: 'Українська', flag: '🇺🇦' },
              { code: 'zh', name: '中文', flag: '🇨🇳' },
              { code: 'ja', name: '日本語', flag: '🇯🇵' },
              { code: 'ko', name: '한국어', flag: '🇰🇷' },
              { code: 'pl', name: 'Polski', flag: '🇵🇱' },
            ].map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code as Lang)}
                className="py-2 px-2 rounded-lg text-xs font-medium flex flex-col items-center gap-0.5 transition-all active:scale-95"
                style={{
                  background: lang === l.code ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${lang === l.code ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.06)'}`,
                  color: lang === l.code ? '#FFD700' : 'rgba(255,255,255,0.5)',
                }}
              >
                <span className="text-base">{l.flag}</span>
                <span>{l.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Account Section */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,215,0,0.5)' }}>Аккаунт</div>
          <div className="space-y-2">
            <button onClick={() => {
              const data = localStorage.getItem('acki-rivals-save');
              const blob = new Blob([data || '{}'], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'acki-rivals-save.json';
              a.click();
              URL.revokeObjectURL(url);
            }} className="w-full py-3 rounded-lg text-sm font-medium text-left flex items-center justify-between transition-all active:scale-[0.98]"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>📊 Экспорт данных</span>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,61,0,0.05)', border: '1px solid rgba(255,61,0,0.15)' }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,61,0,0.6)' }}>Опасная зона</div>
          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full py-3 rounded-lg text-sm font-medium transition-all active:scale-[0.98]"
              style={{ background: 'rgba(255,61,0,0.1)', border: '1px solid rgba(255,61,0,0.3)', color: '#FF6B6B' }}
            >
              🔄 Сбросить весь прогресс
            </button>
          ) : (
            <div className="space-y-3">
              <div className="text-xs" style={{ color: 'rgba(255,107,107,0.8)' }}>
                ⚠️ Это удалит все данные: карты, кредиты, статистику. Это действие необратимо!
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all active:scale-[0.98]"
                  style={{ background: '#FF3D00', color: 'white' }}
                >
                  Да, сбросить
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-[0.98]"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>

        {/* App Info */}
        <div className="text-center py-4">
          <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>ACKI RIVALS v0.1.0</div>
          <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.15)' }}>Powered by Acki Nacki Blockchain</div>
        </div>
      </div>
    </div>
  );
}
