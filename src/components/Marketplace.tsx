import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Card } from '../types';
import type { WalletConnection } from '../services/beeEngine';
import { useHaptic } from '../hooks/useHaptic';
import { useI18n } from '../i18n';
import CardComponent from './CardComponent';
import { RarityChips, SearchField } from './CardFilters';
import type { Rarity } from '../types';
import {
  getListings,
  getMyListings,
  createListing,
  buyListing,
  cancelListing,
  type Listing,
} from '../services/marketplaceService';
import { getPlayerBalance } from '../services/treasuryService';
import Icon from './Icon';

interface Props {
  walletConnection: WalletConnection | null;
  collection: Card[];
  onAddCard: (card: Card) => void;
  onRemoveCard: (cardUid: string) => void;
  onBack: () => void;
}

type Tab = 'buy' | 'my' | 'sell';
type StatusKind = 'idle' | 'listing' | 'listed' | 'buying' | 'bought' | 'cancelling' | 'cancelled' | 'error';
interface StatusMsg { kind: StatusKind; text: string; }

// ═══ DEV MODE: если VITE_PAYMENT_MODE не задан или = 'dev',
// блокчейн-платежи пропускаются, покупка бесплатна.
const IS_DEV_PAYMENT = !import.meta.env.VITE_PAYMENT_MODE || import.meta.env.VITE_PAYMENT_MODE === 'dev';

const rarityOrder: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

export default function Marketplace({ walletConnection, collection, onAddCard, onRemoveCard, onBack }: Props) {
  const { t } = useI18n();
  const { impactOccurred, selectionChanged, notificationOccurred } = useHaptic();
  const walletAddress = useMemo(() => walletConnection?.walletAddress ?? 'anonymous', [walletConnection]);
  const walletName = useMemo(() => walletConnection?.walletName ?? 'Игрок', [walletConnection]);

  // Игровой баланс (Supabase player_balances) — покупки/продажи идут через него
  const [balance, setBalance] = useState<number | null>(null);

  const refreshBalance = useCallback(async () => {
    if (walletAddress === 'anonymous') return;
    const b = await getPlayerBalance(walletAddress);
    setBalance(b);
  }, [walletAddress]);

  useEffect(() => {
    refreshBalance();
    const i = setInterval(refreshBalance, 15000);
    return () => clearInterval(i);
  }, [refreshBalance]);

  const [tab, setTab] = useState<Tab>('buy');
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [myActiveListings, setMyActiveListings] = useState<Listing[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [sellPrice, setSellPrice] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [status, setStatus] = useState<StatusMsg | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [buySearch, setBuySearch] = useState('');
  const [buyRarity, setBuyRarity] = useState<Rarity | 'all'>('all');
  const [pickSearch, setPickSearch] = useState('');
  const [pickRarity, setPickRarity] = useState<Rarity | 'all'>('all');

  const matchCard = (card: Card, search: string, rarity: Rarity | 'all') => {
    if (rarity !== 'all' && card.rarity !== rarity) return false;
    if (search) {
      const q = search.toLowerCase();
      return card.name.toLowerCase().includes(q) || card.clan.toLowerCase().includes(q);
    }
    return true;
  };

  const buyListings = useMemo(() => {
    return allListings
      .filter((l) => l.seller_id !== walletAddress && matchCard(l.card, buySearch, buyRarity))
      .sort((a, b) => {
        const rarityDiff = (rarityOrder[b.card.rarity] ?? 0) - (rarityOrder[a.card.rarity] ?? 0);
        if (rarityDiff !== 0) return rarityDiff;
        return a.price_nackl - b.price_nackl;
      });
  }, [allListings, walletAddress, buySearch, buyRarity]);

  // Refresh listings when tab changes or after actions
  const refreshListings = useCallback(async () => {
    const [all, mine] = await Promise.all([
      getListings(),
      getMyListings(walletAddress),
    ]);
    setAllListings(all);
    setMyActiveListings(mine);
  }, [walletAddress]);

  useEffect(() => {
    refreshListings();
  }, [tab, refreshKey, refreshListings]);

  // Auto-clear status after 3 seconds
  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  // Cards available to sell (in collection, not already listed)
  const sellableCards = useMemo(() => {
    const listedUids = new Set(myActiveListings.map((l) => l.card.uid));
    return collection.filter((c) => c.uid && !listedUids.has(c.uid));
  }, [collection, myActiveListings]);

  const filteredSellable = useMemo(() => {
    return sellableCards.filter((c) => matchCard(c, pickSearch, pickRarity));
  }, [sellableCards, pickSearch, pickRarity]);

  const handleList = useCallback(async () => {
    if (!selectedCard || !selectedCard.uid) return;
    const price = parseFloat(sellPrice);
    if (isNaN(price) || price <= 0) return;

    impactOccurred('medium');
    setStatus({ kind: 'listing', text: 'Выставляем на продажу…' });

    const listing = await createListing(selectedCard, price, walletAddress, walletName);

    if (listing) {
      // Remove card from seller's collection (and deck if present)
      onRemoveCard(selectedCard.uid!);
      setStatus({ kind: 'listed', text: `${selectedCard.name} выставлена за ${price} NACKL` });
      notificationOccurred('success');
      setSelectedCard(null);
      setSellPrice('');
      setRefreshKey((k) => k + 1);
    } else {
      setStatus({ kind: 'error', text: 'Не удалось выставить карту' });
      notificationOccurred('error');
    }
  }, [selectedCard, sellPrice, walletAddress, walletName, impactOccurred, notificationOccurred, onRemoveCard]);

  const handleBuy = useCallback(async (listing: Listing) => {
    if (listing.seller_id === walletAddress) {
      setStatus({ kind: 'error', text: 'Нельзя купить свою карту' });
      notificationOccurred('error');
      return;
    }

    // Предварительная проверка игрового баланса (сервер всё равно проверит атомарно)
    if (balance !== null && balance < listing.price_nackl) {
      setStatus({ kind: 'error', text: `${t('marketplace.notEnoughNackl')} ${listing.price_nackl})` });
      notificationOccurred('error');
      return;
    }

    impactOccurred('medium');
    setStatus({ kind: 'buying', text: `Покупаем ${listing.card.name}…` });

    const result = await buyListing(listing.id, walletAddress);

    // dev-режим (без БД): сервер вернул success без карты — берём из листинга
    const boughtCard = result.card ?? listing.card;

    if (result.success && boughtCard) {
      onAddCard(boughtCard);
      if (result.balanceNackl !== undefined) setBalance(result.balanceNackl);
      setStatus({ kind: 'bought', text: `${boughtCard.name} куплена за ${listing.price_nackl} NACKL` });
      notificationOccurred('success');
      setRefreshKey((k) => k + 1);
    } else {
      setStatus({ kind: 'error', text: result.error || 'Ошибка покупки' });
      notificationOccurred('error');
    }
  }, [walletAddress, balance, impactOccurred, notificationOccurred, onAddCard]);

  const handleCancel = useCallback(async (listingId: string) => {
    impactOccurred('light');
    setStatus({ kind: 'cancelling', text: 'Отменяем листинг…' });

    const result = await cancelListing(listingId);

    if (result.success && result.card) {
      onAddCard(result.card);
      setStatus({ kind: 'cancelled', text: `${result.card.name} возвращена в коллекцию` });
      notificationOccurred('success');
      setRefreshKey((k) => k + 1);
    } else {
      setStatus({ kind: 'error', text: result.error || 'Ошибка отмены' });
      notificationOccurred('error');
    }
  }, [impactOccurred, notificationOccurred, onAddCard]);

  const canSell = selectedCard && sellPrice && parseFloat(sellPrice) > 0;

  const statusBg = (kind: StatusKind) => {
    if (kind === 'error') return { bg: 'rgba(255,60,60,0.1)', border: 'rgba(255,60,60,0.2)', color: '#FF6B6B' };
    if (kind === 'listed' || kind === 'bought' || kind === 'cancelled') return { bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.2)', color: '#4ADE80' };
    return { bg: 'rgba(255,215,0,0.1)', border: 'rgba(255,215,0,0.2)', color: 'rgba(255,215,0,0.8)' };
  };

  return (
    <div className="flex flex-col h-full w-full max-w-lg mx-auto overflow-hidden bg-battle relative">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-72 h-72 rounded-full bg-an-gold/[0.03] animate-aurora-1" style={{ top: '-10%', left: '-20%' }} />
        <div className="absolute w-56 h-56 rounded-full bg-neon-blue/[0.03] animate-aurora-2" style={{ bottom: '-10%', right: '-15%' }} />
      </div>

      {/* Header */}
      <div className="relative z-10 px-4 pt-4 pb-2 shrink-0">
        <div className="relative flex items-center justify-between mb-3">
          <button onClick={() => { impactOccurred('soft'); onBack(); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'rgba(255,255,255,0.05)' }}>
            ←
          </button>
          <h1 className="absolute left-1/2 -translate-x-1/2 text-lg font-bold text-white whitespace-nowrap inline-flex items-center gap-1.5"><Icon name="store" size={16} /> Marketplace</h1>
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-neon-green" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
            <Icon name="moneybag" size={12} />
            {(balance ?? 0).toFixed(2)}
            <span className="text-[9px] text-white/40 font-normal">NACKL</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-white/[0.03] border border-white/[0.06] p-1">
          {(['buy', 'my', 'sell'] as const).map((tabKey) => {
            const rawLabel = tabKey === 'buy' ? t('marketplace.tabBuy') : tabKey === 'my' ? t('marketplace.tabMy') : t('marketplace.tabSell');
            const label = rawLabel.replace(/^[^\p{L}\p{N}]+/u, '').trim();
            const icon = tabKey === 'buy' ? 'bag' : tabKey === 'my' ? 'user' : 'moneybag';
            const badge = tabKey === 'buy' ? allListings.length : tabKey === 'my' ? myActiveListings.length : 0;
            const active = tab === tabKey;
            return (
              <button key={tabKey}
                onClick={() => { selectionChanged(); setTab(tabKey); }}
                className="flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                style={{
                  background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,0.4)',
                }}>
                <Icon name={icon} size={13} />
                {label}
                {badge > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status messages */}
      {status && (
        <div className="relative z-10 mx-4 mb-2 px-3 py-2 rounded-lg text-xs text-center animate-fade-in" style={{ background: statusBg(status.kind).bg, border: `1px solid ${statusBg(status.kind).border}`, color: statusBg(status.kind).color }}>
          {status.text}
        </div>
      )}

      {/* Dev mode banner */}
      {IS_DEV_PAYMENT && tab === 'buy' && allListings.length > 0 && (
        <div className="relative z-10 mx-4 mb-2 px-3 py-1.5 rounded-lg text-[10px] text-center" style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)', color: 'rgba(0,212,255,0.6)' }}>
          {t('marketplace.devModeBanner')}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 relative z-10">

        {/* ═══ BUY TAB ═══ */}
        {tab === 'buy' && (
          <div className="space-y-3">
            {allListings.length === 0 ? (
              <div className="text-center py-12">
                <div className="flex justify-center mb-3 text-white/40"><Icon name="store" size={40} /></div>
                <div className="text-white/40 text-sm">{t('marketplace.noListings')}</div>
                <div className="text-white/20 text-[10px] mt-1">{t('marketplace.noListingsHint')}</div>
              </div>
            ) : (
              <>
                {/* Search + rarity filters */}
                <div className="space-y-2 mb-3">
                  <SearchField value={buySearch} onChange={setBuySearch} placeholder={t('deck.search')} />
                  <RarityChips value={buyRarity} onChange={(v) => { selectionChanged(); setBuyRarity(v); }} />
                </div>
                {buyListings.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="flex justify-center mb-2 text-white/40"><Icon name="search" size={30} /></div>
                    <div className="text-white/40 text-sm">{t('deck.noCards')}</div>
                  </div>
                ) : (
                  <>
                {/* Sort info */}
                <div className="text-[10px] text-white/20 uppercase tracking-wider mb-1">
                  {buyListings.length} {buyListings.length === 1 ? 'листинг' : 'листингов'} доступно
                </div>
                {buyListings.map((listing) => (
                  <div key={listing.id}
                    className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden transition-all hover:bg-white/[0.05] active:scale-[0.99]">
                    <div className="flex items-center gap-3 p-3">
                      {/* Card preview */}
                      <div className="shrink-0 w-16">
                        <CardComponent card={listing.card} compact />
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white truncate">{listing.card.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-white/40">{listing.card.clan}</span>
                          <span className="text-[10px] text-white/30">·</span>
                          <span className="inline-flex items-center gap-1 text-[10px] text-white/40"><Icon name="sword" size={10} />{listing.card.power + (listing.card.stars ?? 0)} <Icon name="boom" size={10} />{listing.card.damage + (listing.card.stars ?? 0)}</span>
                          {listing.card.stars && listing.card.stars > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-yellow-400"><Icon name="star" size={10} />{listing.card.stars}</span>
                          )}
                        </div>
                        <div className="text-[9px] text-white/20 mt-0.5">
                          {t('marketplace.seller')} {listing.seller_name}
                        </div>
                      </div>
                      {/* Price + buy button */}
                      <div className="shrink-0 text-right">
                        <div className="text-lg font-black text-an-gold">{listing.price_nackl}</div>
                        <div className="text-[9px] text-white/30 uppercase">NACKL</div>
                        <button
                          onClick={() => handleBuy(listing)}
                          className="mt-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gradient-to-r from-neon-blue to-neon-purple text-white active:scale-90 transition-all shadow-[0_0_10px_rgba(0,212,255,0.2)] relative overflow-hidden">
                          <span className="absolute inset-0 animate-shimmer pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)', backgroundSize: '200% 100%' }} />
                          {t('marketplace.buyButton')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══ MY LISTINGS TAB ═══ */}
        {tab === 'my' && (
          <div className="space-y-3">
            {myActiveListings.length === 0 ? (
              <div className="text-center py-12">
                <div className="flex justify-center mb-3 text-white/40"><Icon name="gift" size={40} /></div>
                <div className="text-white/40 text-sm">У тебя нет активных листингов</div>
                <div className="text-white/20 text-[10px] mt-1">Перейди во вкладку «Продать», чтобы выставить карту</div>
              </div>
            ) : (
              myActiveListings.map((listing) => (
                <div key={listing.id}
                  className="rounded-2xl border border-an-gold/20 bg-an-gold/[0.03] overflow-hidden">
                  <div className="flex items-center gap-3 p-3">
                    <div className="shrink-0 w-16">
                      <CardComponent card={listing.card} compact />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">{listing.card.name}</div>
                      <div className="text-[10px] text-white/40 mt-0.5">{listing.card.clan} · {listing.card.rarity}</div>
                      <div className="text-lg font-black text-an-gold mt-1">{listing.price_nackl} NACKL</div>
                    </div>
                    <button
                      onClick={() => handleCancel(listing.id)}
                      className="shrink-0 px-3 py-2 rounded-lg text-[11px] font-bold bg-an-red/10 text-an-red border border-an-red/30 active:scale-90 transition-all">
                      {t('marketplace.cancelButton')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ═══ SELL TAB ═══ */}
        {tab === 'sell' && (
          <div>
            {/* Selected card summary */}
            {sellableCards.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">🃏</div>
                <div className="text-white/40 text-sm">{t('marketplace.noCardsToSell')}</div>
                <div className="text-white/20 text-[10px] mt-1">{t('marketplace.noCardsHint')}</div>
              </div>
            ) : selectedCard ? (
              <div className="rounded-2xl border border-an-gold/25 bg-an-gold/[0.05] p-3 flex items-center gap-3">
                <div className="w-14 shrink-0">
                  <CardComponent card={selectedCard} compact />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">{selectedCard.name}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">{selectedCard.clan} · {selectedCard.rarity}</div>
                  <div className="inline-flex items-center gap-1 text-[9px] text-white/25 mt-0.5"><Icon name="sword" size={9} />{selectedCard.power + (selectedCard.stars ?? 0)} <Icon name="boom" size={9} />{selectedCard.damage + (selectedCard.stars ?? 0)}</div>
                </div>
                <button
                  onClick={() => { setSelectedCard(null); setSellPrice(''); selectionChanged(); }}
                  className="shrink-0 px-3 py-2 rounded-lg text-[11px] font-bold bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 active:scale-90 transition-all">
                  <span className="inline-flex items-center gap-1.5 justify-center"><Icon name="arrowRight" size={13} /> {t('marketplace.changeCard') || 'Сменить'}</span>
                </button>
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="text-3xl mb-2">🃏</div>
                <div className="text-white/40 text-sm">{t('marketplace.selectCard')}</div>
                <div className="text-white/20 text-[10px] mt-1">
                  {sellableCards.length} {t('marketplace.available')}
                </div>
                <button
                  onClick={() => { impactOccurred('medium'); setPickerOpen(true); }}
                  className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-an-gold to-an-orange text-an-dark active:scale-95 transition-all shadow-[0_0_16px_rgba(255,215,0,0.25)]">
                  + {t('marketplace.pickCard') || 'Выбрать карту'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ SELL PRICE PANEL (fixed, always visible) ═══ */}
      {tab === 'sell' && selectedCard && (
        <div className="shrink-0 px-4 pb-2 relative z-20 animate-slide-up" style={{ background: 'rgba(5,5,8,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,215,0,0.12)' }}>
          <div className="space-y-2 pt-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 shrink-0">
                  <CardComponent card={selectedCard} compact />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{selectedCard.name}</div>
                  <div className="text-[9px] text-white/40 truncate">{selectedCard.clan} · {selectedCard.rarity}</div>
                </div>
              </div>
              <button
                onClick={() => { setSelectedCard(null); setSellPrice(''); selectionChanged(); }}
                className="shrink-0 w-7 h-7 rounded-lg text-xs bg-white/5 text-white/40 hover:bg-white/10 active:scale-90 transition-all"
                aria-label="Снять выбор"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                step="0.1"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                placeholder="Цена в NACKL"
                autoFocus
                className="flex-1 px-3.5 py-2.5 rounded-xl text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder-white/20 focus:outline-none focus:border-an-gold/40 transition-all"
              />
              <span className="text-xs text-neon-blue font-bold shrink-0">NACKL</span>
              <button
                onClick={handleList}
                disabled={!canSell}
                className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  canSell
                    ? 'bg-gradient-to-r from-an-gold to-an-orange text-an-dark active:scale-95 shadow-[0_0_16px_rgba(255,215,0,0.25)]'
                    : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'
                }`}>
                <span className="inline-flex items-center gap-1.5 justify-center"><Icon name="moneybag" size={15} /> {t('marketplace.sellButton')}</span>
              </button>
            </div>

            {/* Quick price presets */}
            <div className="flex gap-1.5">
              {[5, 10, 25, 50, 100].map((preset) => (
                <button key={preset}
                  onClick={() => { setSellPrice(String(preset)); selectionChanged(); }}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition-all active:scale-90 ${
                    sellPrice === String(preset)
                      ? 'bg-an-gold/15 text-an-gold border-an-gold/30'
                      : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10'
                  }`}>
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div className="shrink-0 px-4 py-3 relative z-10 border-t border-white/[0.03]" style={{ background: 'rgba(5,5,8,0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <button onClick={() => { impactOccurred('soft'); onBack(); }}
          className="w-full py-2.5 rounded-xl font-bold text-sm bg-white/5 border border-white/10 text-white/60 active:bg-white/10 active:scale-[0.98] transition-all hover:bg-white/[0.08]">
          {t('deck.back') || 'Назад'}
        </button>
      </div>

      {/* ═══ CARD PICKER SHEET (fullscreen overlay) ═══ */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { impactOccurred('soft'); setPickerOpen(false); }} />
          <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-t-3xl overflow-hidden animate-slide-up" style={{ background: '#0A0A10', border: '1px solid rgba(255,215,0,0.15)', borderBottom: 'none', boxShadow: '0 -8px 40px rgba(0,0,0,0.6)' }}>
            {/* Sheet header */}
            <div className="shrink-0 px-4 pt-3 pb-2 border-b border-white/[0.06]">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-bold text-white">{t('marketplace.selectCard')}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">{sellableCards.length} {t('marketplace.available')}</div>
                </div>
                <button
                  onClick={() => { impactOccurred('soft'); setPickerOpen(false); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <Icon name="close" size={16} />
                </button>
              </div>
              <div className="space-y-2">
                <SearchField value={pickSearch} onChange={setPickSearch} placeholder={t('deck.search')} />
                <RarityChips value={pickRarity} onChange={(v) => { selectionChanged(); setPickRarity(v); }} />
              </div>
            </div>
            {/* Cards grid (own scroll — panel never hides cards) */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {filteredSellable.length === 0 ? (
                <div className="text-center py-10">
                  <div className="flex justify-center mb-2 text-white/40"><Icon name="search" size={30} /></div>
                  <div className="text-white/40 text-sm">{t('deck.noCards')}</div>
                </div>
              ) : (
              <div className="grid grid-cols-3 gap-2">
                {filteredSellable.map((card) => (
                  <div key={card.uid}
                    className={`relative cursor-pointer transition-all rounded-xl ${
                      selectedCard?.uid === card.uid
                        ? 'ring-2 ring-an-gold scale-105'
                        : 'hover:ring-1 hover:ring-white/20'
                    }`}
                    onClick={() => { selectionChanged(); setSelectedCard(card); setSellPrice(''); setPickerOpen(false); }}>
                    <CardComponent card={card} compact />
                    {selectedCard?.uid === card.uid && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-an-gold text-an-dark flex items-center justify-center"><Icon name="check" size={12} stroke={2.5} /></div>
                    )}
                  </div>
                ))}
              </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
