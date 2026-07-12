import { useState } from 'react';
import { useI18n, type Lang } from '../i18n';
import { useHaptic } from '../hooks/useHaptic';

interface Props {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: Props) {
  const { lang, setLang, t } = useI18n();
  const { selectionChanged, impactOccurred } = useHaptic();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleReset = () => {
    localStorage.removeItem('acki-rivals-save');
    localStorage.removeItem('acki-lang');
    localStorage.removeItem('pvp_player_id');
    location.reload();
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto overflow-hidden" style={{ background: '#050508' }}>
      {/* Header */}
      <div className="shrink-0 px-4 py-4 border-b" style={{ borderColor: 'rgba(255,215,0,0.1)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => { impactOccurred('soft'); onBack(); }} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
            ←
          </button>
          <h1 className="text-lg font-bold" style={{ color: '#FFD700' }}>{t('settings.title')}</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Language Section */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,215,0,0.5)' }}>{t('settings.language')}</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { code: 'ru', name: 'Русский', flag: '🇷🇺' },
              { code: 'en', name: 'English', flag: '🇬🇧' },
              { code: 'es', name: 'Español', flag: '🇪🇸' },
              { code: 'pt', name: 'Português', flag: '🇧🇷' },
              { code: 'ar', name: 'العربية', flag: '🇸🇦' },
              { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
              { code: 'id', name: 'Bahasa', flag: '🇮🇩' },
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
                onClick={() => { selectionChanged(); setLang(l.code as Lang); }}
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
          <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,215,0,0.5)' }}>{t('settings.account')}</div>
          <div className="space-y-2">
            <button onClick={() => {
              impactOccurred('light');
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
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{t('settings.exportData')}</span>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,61,0,0.05)', border: '1px solid rgba(255,61,0,0.15)' }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,61,0,0.6)' }}>{t('settings.dangerZone')}</div>
          {!showResetConfirm ? (
            <button
              onClick={() => { impactOccurred('heavy'); setShowResetConfirm(true); }}
              className="w-full py-3 rounded-lg text-sm font-medium transition-all active:scale-[0.98]"
              style={{ background: 'rgba(255,61,0,0.1)', border: '1px solid rgba(255,61,0,0.3)', color: '#FF6B6B' }}
            >
              {t('settings.resetProgress')}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="text-xs" style={{ color: 'rgba(255,107,107,0.8)' }}>
                {t('settings.confirmReset')}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { impactOccurred('heavy'); handleReset(); }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all active:scale-[0.98]"
                  style={{ background: '#FF3D00', color: 'white' }}
                >
                  {t('settings.reset')}
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-[0.98]"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
                >
                  {t('settings.cancel')}
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
