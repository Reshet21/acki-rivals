import { useState, useMemo } from 'react';
import type { Card } from '../types';
import { useI18n } from '../i18n';
import { useHaptic } from '../hooks/useHaptic';
import CardComponent from './CardComponent';
import { RarityChips, SearchField } from './CardFilters';
import Icon from './Icon';
import type { Rarity } from '../types';

interface Props {
  collection: Card[];
  onUpgrade: (cardUid: string, t?: (key: string) => string) => { success: boolean; message: string };
  onBack: () => void;
}

const MAX_STARS = 6;
const NEEDED_PER_MERGE = 2;

export default function UpgradeScreen({ collection, onUpgrade, onBack }: Props) {
  const { t } = useI18n();
  const { notificationOccurred, selectionChanged, impactOccurred } = useHaptic();
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'all'>('all');

  // Group cards by id. For each group: base = highest-starred card.
  // To upgrade ★N → ★(N+1) you need TWO cards with ★N.
  const cardGroups = useMemo(() => {
    const groups = new Map<number, { base: Card; stars: number; sameLevel: number }>();

    for (const card of collection) {
      const existing = groups.get(card.id);
      if (!existing) {
        groups.set(card.id, {
          base: card,
          stars: card.stars ?? 0,
          sameLevel: 1,
        });
        continue;
      }
      const s = card.stars ?? 0;
      if (s === existing.stars) {
        existing.sameLevel += 1;
      }
      if (s > existing.stars) {
        existing.stars = s;
        existing.base = card;
        existing.sameLevel = 1;
      }
    }

    const enriched = Array.from(groups.values()).map((g) => {
      const isMax = g.stars >= MAX_STARS;
      const canUpgrade = !isMax && g.sameLevel >= NEEDED_PER_MERGE;
      return { ...g, isMax, canUpgrade };
    });

    // Sort: ready cards first, then by stars/rarity
    return enriched.sort((a, b) => {
      if (a.canUpgrade && !b.canUpgrade) return -1;
      if (!a.canUpgrade && b.canUpgrade) return 1;
      return b.stars - a.stars || b.base.id - a.base.id;
    });
  }, [collection]);

  const matches = (card: Card) => {
    if (rarityFilter !== 'all' && card.rarity !== rarityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return card.name.toLowerCase().includes(q) || card.clan.toLowerCase().includes(q);
    }
    return true;
  };

  const ready = cardGroups.filter((g) => g.canUpgrade && matches(g.base));
  const notReady = cardGroups.filter((g) => !g.canUpgrade && matches(g.base));
  const selGroup = cardGroups.find((g) => g.base.uid === selectedUid);

  const handleUpgrade = () => {
    if (!selectedUid) return;
    notificationOccurred('success');
    const result = onUpgrade(selectedUid, t);
    setMessage({ text: result.message, type: result.success ? 'success' : 'error' });
    if (result.success) {
      setSelectedUid(null);
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const renderGridItem = (g: typeof cardGroups[0]) => (
    <div key={g.base.uid} className="relative transform transition-all active:scale-95">
      <CardComponent
        card={g.base}
        compact
        noPopup
        onClick={() => {
          selectionChanged();
          setSelectedUid(g.base.uid!);
        }}
      />
      <div
        className={`absolute -top-2 -right-2 z-10 px-2 py-0.5 text-[11px] font-black rounded-full border shadow-lg ${
          g.isMax
            ? 'bg-black text-yellow-400 border-yellow-400/50'
            : g.canUpgrade
            ? 'bg-neon-green text-black border-neon-green shadow-neon-green/40'
            : 'bg-black/90 text-white/50 border-white/20'
        }`}
      >
        {g.isMax ? 'MAX' : `${g.sameLevel}/${NEEDED_PER_MERGE}`}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full max-w-lg mx-auto overflow-hidden bg-battle relative">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-white/10 relative flex flex-col items-center bg-black/60 backdrop-blur-md safe-top">
        <button
          onClick={() => { impactOccurred('soft'); onBack(); }}
          className="absolute left-4 top-4 w-8 h-8 rounded-lg flex items-center justify-center text-sm bg-white/10 text-white/80 active:bg-white/20 active:scale-95 transition-all"
        >
          ←
        </button>
        <h1 className="inline-flex items-center gap-1.5 text-lg font-black text-white tracking-wide text-center">
          <Icon name="anvil" size={16} /> {t('upgrade.title').replace(/^[^\p{L}\p{N}]+/u, '').trim()}
        </h1>
        <p className="text-[10px] text-white/40 mt-0.5 text-center">{t('upgrade.mergeHint')}</p>
      </div>

      {/* Search + rarity filters */}
      <div className="shrink-0 px-4 py-2 space-y-2 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <SearchField value={search} onChange={setSearch} placeholder={t('deck.search')} />
        <RarityChips value={rarityFilter} onChange={(v) => { selectionChanged(); setRarityFilter(v); }} />
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mx-4 mt-4 px-3 py-2 rounded-lg text-xs font-bold text-center border relative z-10 shadow-lg ${
            message.type === 'success'
              ? 'bg-neon-green/20 text-neon-green border-neon-green/50'
              : 'bg-an-red/20 text-an-red border-an-red/50'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Roster */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20">
        {ready.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-neon-green mb-4 flex items-center gap-2 drop-shadow-md">
              <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
              {t('upgrade.ready') || 'Ready to upgrade'}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {ready.map(renderGridItem)}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-bold text-white/40 mb-4 block">
            {t('upgrade.collection') || 'Collection (Need Copies / Maxed)'}
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {notReady.map(renderGridItem)}
          </div>
        </section>
      </div>

      {/* Back */}
      <div className="shrink-0 px-4 py-3 border-t border-white/10 bg-black/60 backdrop-blur-md">
        <button onClick={() => { impactOccurred('soft'); onBack(); }} className="w-full py-2.5 rounded-lg font-bold text-sm bg-white/5 border border-white/10 text-white/60 active:bg-white/10 active:scale-[0.98] transition-all">
          {t('deck.back')}
        </button>
      </div>

      {/* Upgrade Modal */}
      {selGroup && (
        <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col overflow-y-auto animate-fade-in">
          <div className="flex flex-col items-center justify-start px-4 pt-6 pb-8 min-h-full">
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-4 tracking-wider text-center">
            {selGroup.isMax ? t('upgrade.max') : t('upgrade.title')}
          </h2>

          <div className="w-40 mb-4 transform hover:scale-105 transition-all duration-300 shrink-0">
            <CardComponent card={selGroup.base} noPopup />
          </div>

          {!selGroup.isMax && (
            <div className="w-full max-w-xs bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 mb-4 shadow-2xl">
              <div className="flex items-center justify-between text-center">
                <div className="flex-1">
                  <div className="text-[10px] uppercase text-white/40 font-bold mb-1">{t('card.power')}</div>
                  <div className="text-2xl font-black text-white">
                    {selGroup.base.power + selGroup.stars}{' '}
                    <span className="text-neon-green text-lg ml-1">→ {selGroup.base.power + selGroup.stars + 1}</span>
                  </div>
                </div>
                <div className="w-px h-10 bg-white/10 mx-4" />
                <div className="flex-1">
                  <div className="text-[10px] uppercase text-white/40 font-bold mb-1">{t('card.damage')}</div>
                  <div className="text-2xl font-black text-white">
                    {selGroup.base.damage + selGroup.stars}{' '}
                    <span className="text-neon-green text-lg ml-1">→ {selGroup.base.damage + selGroup.stars + 1}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="w-full max-w-xs mb-4 bg-black/40 p-4 rounded-xl border border-white/5">
            <div className="flex justify-between text-xs font-bold mb-1">
              <span className="text-yellow-400">{NEEDED_PER_MERGE} × ★{selGroup.stars} → ★{selGroup.stars + 1}</span>
              <span
                className={
                  selGroup.isMax ? 'text-yellow-400' : selGroup.canUpgrade ? 'text-neon-green' : 'text-red-400'
                }
              >
                {selGroup.isMax ? 'MAX' : `${selGroup.sameLevel} / ${NEEDED_PER_MERGE}`}
              </span>
            </div>
            {!selGroup.isMax && (
              <>
                <div className="h-2.5 bg-white/10 rounded-full overflow-hidden shadow-inner">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      selGroup.canUpgrade ? 'bg-neon-green shadow-[0_0_10px_#10b981]' : 'bg-neon-blue'
                    }`}
                    style={{ width: `${Math.min(100, (selGroup.sameLevel / NEEDED_PER_MERGE) * 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-white/40 mt-2">
                  {selGroup.canUpgrade
                    ? t('upgrade.ready') || 'Ready to merge'
                    : t('upgrade.needSameStar') || `Need ${NEEDED_PER_MERGE - selGroup.sameLevel} more ★${selGroup.stars} card(s)`}
                </div>
              </>
            )}
          </div>

          {selGroup.canUpgrade ? (
            <button
              onClick={handleUpgrade}
              className="w-full max-w-xs py-4 rounded-xl font-black text-black bg-gradient-to-r from-yellow-400 to-orange-500 shadow-[0_0_30px_rgba(245,158,11,0.3)] active:scale-95 transition-all outline-none relative overflow-hidden"
            >
              <span className="absolute inset-0 animate-shimmer pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)', backgroundSize: '200% 100%' }} />
              ★ {t('upgrade.upgradeTo')} {selGroup.stars + 1}
            </button>
          ) : (
            <button
              disabled
              className="w-full max-w-xs py-4 rounded-xl font-black text-white/30 bg-white/5 border border-white/10 cursor-not-allowed"
            >
              {selGroup.isMax ? t('upgrade.max') : t('upgrade.notEnough')}
            </button>
          )}

          <button
            onClick={() => setSelectedUid(null)}
            className="mt-4 mb-2 text-sm font-bold text-white/40 active:text-white pb-1 border-b border-transparent active:border-white transition-all uppercase tracking-widest"
          >
            {t('deck.back')}
          </button>
          </div>
        </div>
      )}
    </div>
  );
}
