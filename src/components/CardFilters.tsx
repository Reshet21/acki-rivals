import type { Rarity } from '../types';
import { useI18n } from '../i18n';
import Icon from './Icon';

export const RARITY_FILTERS: { value: Rarity | 'all'; labelKey: string }[] = [
  { value: 'all', labelKey: 'deck.filterAll' },
  { value: 'common', labelKey: 'deck.filterCommon' },
  { value: 'uncommon', labelKey: 'deck.filterUncommon' },
  { value: 'rare', labelKey: 'deck.filterRare' },
  { value: 'epic', labelKey: 'deck.filterEpic' },
  { value: 'legendary', labelKey: 'deck.filterLegendary' },
];

interface RarityChipsProps {
  value: Rarity | 'all';
  onChange: (v: Rarity | 'all') => void;
  onHaptic?: () => void;
}

// цвет квадрата-индикатора редкости (как гем на карточке)
const RARITY_COLOR: Record<string, string> = {
  common: '#9ca3af', uncommon: '#10b981', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b',
};
// убираем ведущий эмодзи (цветной кружок) из перевода
const stripEmoji = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, '').trim();

export function RarityChips({ value, onChange, onHaptic }: RarityChipsProps) {
  const { t } = useI18n();
  return (
    <div className="flex gap-1 overflow-x-auto p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      {RARITY_FILTERS.map((f) => {
        const active = value === f.value;
        return (
          <button
            key={f.value}
            onClick={() => { onHaptic?.(); onChange(f.value); }}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all"
            style={{
              background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: active ? '#fff' : 'rgba(255,255,255,0.4)',
            }}
          >
            {f.value !== 'all' && (
              <span style={{ width: 9, height: 9, borderRadius: 2, background: RARITY_COLOR[f.value], boxShadow: `0 0 5px ${RARITY_COLOR[f.value]}`, border: '1px solid rgba(255,255,255,0.15)' }} />
            )}
            {stripEmoji(t(f.labelKey))}
          </button>
        );
      })}
    </div>
  );
}

interface SearchFieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}

export function SearchField({ value, onChange, placeholder }: SearchFieldProps) {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 pl-10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
      />
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-white/40 hover:bg-white/10 transition-all"
        >
          <Icon name="close" size={12} />
        </button>
      )}
    </div>
  );
}
