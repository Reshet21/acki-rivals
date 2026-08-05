import type { Rarity } from '../types';
import { useI18n } from '../i18n';

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

export function RarityChips({ value, onChange, onHaptic }: RarityChipsProps) {
  const { t } = useI18n();
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
      {RARITY_FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => { onHaptic?.(); onChange(f.value); }}
          className="px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all active:scale-95"
          style={{
            background: value === f.value ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${value === f.value ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.06)'}`,
            color: value === f.value ? '#FFD700' : 'rgba(255,255,255,0.4)',
          }}
        >
          {t(f.labelKey)}
        </button>
      ))}
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
          className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white/40 hover:bg-white/10 transition-all"
        >
          ✕
        </button>
      )}
    </div>
  );
}
