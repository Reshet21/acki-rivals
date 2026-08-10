import { useState, useEffect, useRef, useCallback } from 'react';
import type { Card } from '../types';
import { useHaptic } from '../hooks/useHaptic';
import { useI18n } from '../i18n';
import Icon from './Icon';
import CardComponent from './CardComponent';
import { fetchMessages, sendText, sendListing, fetchMyClan, type ChatMessage, type ChatQuery } from '../services/chatService';
import { createListing, buyListing } from '../services/marketplaceService';

interface Props {
  playerId: string;
  playerName?: string;
  collection: Card[];
  onAddCard: (card: Card) => void;
  onRemoveCard: (cardUid: string) => void;
  onBack: () => void;
}

type Tab = 'global' | 'trade' | 'clan';

export default function ChatScreen({ playerId, playerName, collection, onAddCard, onRemoveCard, onBack }: Props) {
  const displayName = playerName || playerId;
  const { impactOccurred, selectionChanged } = useHaptic();
  const { t } = useI18n();

  const [tab, setTab] = useState<Tab>('global');  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [myClanId, setMyClanId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saleCard, setSaleCard] = useState<Card | null>(null);
  const [salePrice, setSalePrice] = useState('');
  const [saleBusy, setSaleBusy] = useState(false);
  const [buyTarget, setBuyTarget] = useState<ChatMessage | null>(null);
  const [buyBusy, setBuyBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [loadedIds, setLoadedIds] = useState<Set<number>>(new Set());

  const lastIdRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const stickBottomRef = useRef(true);

  const queryForTab: ChatQuery = tab === 'clan'
    ? { channel: 'clan', clanId: myClanId }
    : { channel: tab };

  // Продажа карт: в торговом канале и в клановом (если есть клан).
  // В глобальный чат торговые позиции уходят (сервер ставит канал 'trade').
  const canSell = tab !== 'global' && (tab !== 'clan' || !!myClanId);

  const sortMessages = (msgs: ChatMessage[]) =>
    [...msgs].sort((a, b) => a.id - b.id);

  const fullReload = useCallback(async (query: ChatQuery) => {
    const msgs = await fetchMessages(playerId, query, 0);
    setMessages(sortMessages(msgs));
    const ids = new Set<number>(msgs.map((m) => m.id));
    setLoadedIds(ids);
    lastIdRef.current = msgs.length > 0 ? Math.max(...msgs.map((m) => m.id)) : 0;
  }, [playerId]);

  // Инициализация: мой клан + первая загрузка
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const info = await fetchMyClan(playerId);
      if (cancelled) return;
      setMyClanId(info.clan ? info.clan.id : null);
      if (!cancelled) await fullReload({ channel: 'global' });
    })();
    return () => { cancelled = true; };
  }, [playerId, fullReload]);

  // Поллинг активного таба
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const msgs = await fetchMessages(playerId, queryForTab, lastIdRef.current);
      if (msgs.length === 0) return;
      const fresh = msgs.filter((m) => !loadedIdsRef.current.has(m.id));
      if (fresh.length === 0) return;
      setMessages((prev) => sortMessages([...prev, ...fresh]));
      fresh.forEach((m) => loadedIdsRef.current.add(m.id));
      lastIdRef.current = Math.max(lastIdRef.current, ...fresh.map((m) => m.id));
    }, 2500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [tab, myClanId, playerId, queryForTab]);

  // Переключение таба — полная перезагрузка
  useEffect(() => {
    fullReload(queryForTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, myClanId]);

  const loadedIdsRef = useRef(loadedIds);
  loadedIdsRef.current = loadedIds;

  // Авто-скролл вниз при новых сообщениях, если были внизу
  useEffect(() => {
    const el = listRef.current;
    if (el && stickBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    impactOccurred('light');
    setSending(true);
    setError(null);
    const result = await sendText(playerId, text, queryForTab, replyTo?.id);
    setSending(false);
    if (!result.ok) {
      setError(result.error || 'Ошибка отправки');
      return;
    }
    setInput('');
    setReplyTo(null);
    await fullReload(queryForTab);
  };

  const handleOpenPicker = async () => {
    impactOccurred('light');
    setSaleCard(null);
    setSalePrice('');
    setError(null);
    setPickerOpen(true);
  };

  const handleSell = async () => {
    if (!saleCard || !saleCard.uid) return;
    const price = Number(salePrice);
    if (!price || price <= 0) {
      setError(t('chat.enterPrice'));
      return;
    }
    impactOccurred('medium');
    setSaleBusy(true);
    setError(null);
    const listing = await createListing(saleCard, price, playerId, displayName);
    if (!listing) {
      setSaleBusy(false);
      setError(t('chat.listError'));
      return;
    }
    onRemoveCard(saleCard.uid);
    const result = await sendListing(playerId, listing.id, queryForTab, replyTo?.id);
    setSaleBusy(false);
    if (!result.ok) {
      setError(result.error || 'Ошибка публикации в чат');
      return;
    }
    setPickerOpen(false);
    setReplyTo(null);
    await fullReload(queryForTab);
  };

  const handleBuy = async () => {
    if (!buyTarget || !buyTarget.listing_id) return;
    impactOccurred('medium');
    setBuyBusy(true);
    setError(null);
    const result = await buyListing(buyTarget.listing_id, playerId);
    setBuyBusy(false);
    if (!result.success || !result.card) {
      setError(result.error || t('marketplace.notEnoughNackl'));
      return;
    }
    onAddCard(result.card);
    setMessages((prev) => prev.map((m) => (m.id === buyTarget.id ? { ...m, sold: true } : m)));
    setBuyTarget(null);
  };

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  const fmtPrice = (v: string | null) =>
    v ? Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) : '';

  const scrollToMsg = (msgId: number) => {
    document.getElementById(`chat-msg-${msgId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const startReply = (m: ChatMessage) => {
    impactOccurred('light');
    setReplyTo(m);
  };

  const replyQuote = (m: ChatMessage) => {
    if (!m.reply_to) return null;
    return (
      <button onClick={() => scrollToMsg(m.reply_to!)}
        className="w-full text-left px-2 py-1.5 mb-1.5 rounded-lg border-l-2 bg-white/[0.03] border-l-neon-blue/60 active:scale-[0.99] transition-all"
        style={{ borderLeftColor: 'rgba(0,212,255,0.5)' }}>
        <div className="text-[9px] font-bold truncate" style={{ color: '#00d4ff' }}>
          {t('chat.replyPrefix')} {m.reply_player_name || t('chat.you')}
        </div>
        <div className="text-[10px] truncate text-white/40">{m.reply_text}</div>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full max-w-md mx-auto px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <button onClick={onBack} className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] active:scale-90 transition-all">
          <Icon name="back" size={16} style={{ color: 'rgba(255,255,255,0.7)' }} />
        </button>
        <div className="flex-1">
          <div className="text-base font-black font-display" style={{ color: 'rgba(255,255,255,0.9)' }}>{t('chat.title')}</div>
        </div>
          {canSell && (
          <button onClick={handleOpenPicker}
            className="px-3 py-2 rounded-xl text-[11px] font-bold bg-white/[0.04] border border-white/[0.08] active:scale-90 transition-all flex items-center gap-1.5"
            style={{ color: 'rgba(255,215,0,0.9)' }}>
            <Icon name="gift" size={14} />
            {t('chat.sellCard')}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-2">
        <button onClick={() => { selectionChanged(); setTab('global'); }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.97] ${tab === 'global' ? 'bg-gradient-to-r from-neon-blue/30 to-neon-purple/25 border border-neon-blue/40' : 'bg-white/[0.03] border border-white/[0.06]'}`}
          style={{ color: tab === 'global' ? '#ffffff' : 'rgba(255,255,255,0.5)' }}>
          🌐 {t('chat.global')}
        </button>
        <button onClick={() => { selectionChanged(); setTab('trade'); }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.97] ${tab === 'trade' ? 'bg-gradient-to-r from-emerald-500/25 to-teal-500/20 border border-emerald-400/40' : 'bg-white/[0.03] border border-white/[0.06]'}`}
          style={{ color: tab === 'trade' ? '#ffffff' : 'rgba(255,255,255,0.5)' }}>
          💰 {t('chat.trade')}
        </button>
        <button onClick={() => { selectionChanged(); setTab('clan'); }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.97] ${tab === 'clan' ? 'bg-gradient-to-r from-orange-500/25 to-amber-500/20 border border-orange-400/40' : 'bg-white/[0.03] border border-white/[0.06]'}`}
          style={{ color: tab === 'clan' ? '#ffffff' : 'rgba(255,255,255,0.5)' }}>
          🏰 {t('chat.clan')}
        </button>
      </div>

      {error && (
        <div className="mb-2 px-3 py-2 rounded-xl text-[11px] font-medium" style={{ background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.25)', color: '#ff9b9b' }}>
          {error}
        </div>
      )}

      {/* Messages */}
      {tab === 'clan' && !myClanId ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
          <div className="text-white/30"><Icon name="castle" size={34} /></div>
          <div className="text-sm text-white/50">{t('chat.noClan')}</div>
        </div>
      ) : (
        <div ref={listRef} onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto space-y-2 pb-1 pr-0.5">
          {messages.length === 0 && (
            <div className="text-center py-10 text-xs text-white/25">{t('chat.empty')}</div>
          )}
          {messages.map((m) => (
            <div key={m.id} id={`chat-msg-${m.id}`} className="px-3 py-2 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold truncate" style={{ color: m.player === playerId ? '#00d4ff' : 'rgba(255,215,0,0.8)' }}>
                  {m.player === playerId ? t('chat.you') : m.player_name}
                </span>
                <span className="text-[9px] text-white/25 shrink-0">{fmtTime(m.created_at)}</span>
                <button onClick={() => startReply(m)}
                  className="ml-auto shrink-0 px-1.5 py-0.5 rounded-md text-[10px] text-white/30 bg-white/[0.04] active:scale-90 transition-all hover:text-white/60">
                  ↩
                </button>
              </div>
              {replyQuote(m)}
              {m.text && <div className="text-[13px] leading-snug break-words" style={{ color: 'rgba(255,255,255,0.85)' }}>{m.text}</div>}
              {m.listing_id && m.card && (
                <div className="mt-1 flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.07] p-2">
                  <div className="shrink-0 w-14"><CardComponent card={m.card} compact /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-white truncate">{m.card.name}</div>
                    <div className="text-[10px] text-white/40 mt-0.5">{m.card.clan}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-white/40">
                      <Icon name="sword" size={10} />{m.card.power + (m.card.stars ?? 0)}
                      <Icon name="boom" size={10} />{m.card.damage + (m.card.stars ?? 0)}
                      {m.card.stars && m.card.stars > 0 && (
                        <span className="flex items-center gap-0.5 text-yellow-400"><Icon name="star" size={10} />{m.card.stars}</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-base font-black text-an-gold">{fmtPrice(m.price_nackl)}</div>
                    <div className="text-[8px] text-white/30 uppercase">NACKL</div>
                    {m.sold ? (
                      <div className="mt-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white/[0.05] text-white/35">{t('chat.sold')}</div>
                    ) : (
                      m.player !== playerId ? (
                        <button onClick={() => { impactOccurred('light'); setBuyTarget(m); }}
                          className="mt-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gradient-to-r from-neon-blue to-neon-purple text-white active:scale-90 transition-all">
                          {t('marketplace.buyButton')}
                        </button>
                      ) : (
                        <div className="mt-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white/[0.05] text-white/35">{t('chat.yourListing')}</div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reply bar */}
      {replyTo && (
        <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-xl bg-white/[0.04] border border-neon-blue/25">
          <Icon name="back" size={13} style={{ color: '#00d4ff', transform: 'scaleX(-1)' }} />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold" style={{ color: '#00d4ff' }}>{t('chat.replyingTo')} {replyTo.player_name}</span>
            <span className="text-[10px] text-white/40 truncate block">{replyTo.text || (replyTo.card ? `${replyTo.card.name} · ${fmtPrice(replyTo.price_nackl)} NACKL` : '')}</span>
          </div>
          <button onClick={() => { selectionChanged(); setReplyTo(null); }}
            className="shrink-0 p-1 rounded-md bg-white/[0.05] active:scale-90 transition-all">
            <Icon name="close" size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 mt-2">
          {canSell && (
          <button onClick={handleOpenPicker}
            className="shrink-0 p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] active:scale-90 transition-all"
            style={{ color: 'rgba(255,215,0,0.8)' }}>
            <Icon name="gift" size={18} />
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder={t('chat.placeholder')}
          maxLength={300}
          className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] text-white placeholder-white/25 outline-none focus:border-neon-blue/50 transition-all"
        />
        <button onClick={handleSend} disabled={!input.trim() || sending}
          className="shrink-0 p-2.5 rounded-xl transition-all active:scale-90 disabled:opacity-30"
          style={{ background: input.trim() ? 'linear-gradient(135deg, rgba(0,212,255,0.25), rgba(139,92,246,0.25))' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,212,255,0.25)' }}>
          {sending ? <Icon name="clock" size={18} style={{ color: 'rgba(255,255,255,0.6)' }} /> : <Icon name="arrowRight" size={18} style={{ color: '#00d4ff' }} />}
        </button>
      </div>

      {/* Card picker modal */}
      {pickerOpen && (
        <div className="absolute inset-0 z-30 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-md max-h-[80%] flex flex-col rounded-t-3xl border border-white/[0.08] p-4 pb-6 animate-slide-up"
            style={{ background: '#0b0b12' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-black text-white">{t('chat.sellCard')}</div>
              <button onClick={() => setPickerOpen(false)} className="p-1.5 rounded-lg bg-white/[0.05] active:scale-90 transition-all">
                <Icon name="close" size={14} style={{ color: 'rgba(255,255,255,0.6)' }} />
              </button>
            </div>
            {!saleCard ? (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                {collection.filter((c) => c.uid).length === 0 && (
                  <div className="text-center py-8 text-xs text-white/30">{t('chat.noCards')}</div>
                )}
                {collection.filter((c) => c.uid).map((card) => (
                  <button key={card.uid} onClick={() => { selectionChanged(); setSaleCard(card); }}
                    className="w-full flex items-center gap-3 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] active:scale-[0.98] transition-all text-left">
                    <div className="shrink-0 w-12"><CardComponent card={card} compact /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-white truncate">{card.name}</div>
                      <div className="text-[10px] text-white/40">{card.clan}</div>
                    </div>
                    <div className="text-[10px] text-white/50">{t('chat.pick')} ›</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="shrink-0 w-14"><CardComponent card={saleCard} compact /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-white">{saleCard.name}</div>
                    <div className="text-[10px] text-white/40">{saleCard.clan}</div>
                  </div>
                  <button onClick={() => setSaleCard(null)} className="p-1.5 rounded-lg bg-white/[0.05] active:scale-90 transition-all">
                    <Icon name="close" size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />
                  </button>
                </div>
                <input
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder={t('chat.pricePlaceholder')}
                  inputMode="decimal"
                  className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] text-white placeholder-white/25 outline-none focus:border-an-gold/50"
                />
                <button onClick={handleSell} disabled={saleBusy || !salePrice}
                  className="py-3 rounded-xl text-[13px] font-black text-black active:scale-[0.98] transition-all disabled:opacity-30"
                  style={{ background: 'linear-gradient(135deg, #ffd700, #ffaa00)' }}>
                  {saleBusy ? t('chat.publishing') : t('chat.publish')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Buy confirm modal */}
      {buyTarget && buyTarget.card && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-xs rounded-3xl border border-white/[0.08] p-5 text-center animate-slide-up" style={{ background: '#0b0b12' }}>
            <div className="flex justify-center mb-2"><div className="w-20"><CardComponent card={buyTarget.card} compact /></div></div>
            <div className="text-base font-black text-white">{buyTarget.card.name}</div>
            <div className="text-[11px] text-white/40 mt-0.5">{t('chat.buyFrom')} {buyTarget.player_name}</div>
            <div className="text-2xl font-black text-an-gold mt-2">{fmtPrice(buyTarget.price_nackl)} <span className="text-[10px] text-white/40 uppercase">NACKL</span></div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setBuyTarget(null)} className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-white/[0.05] border border-white/[0.08] text-white/60 active:scale-95 transition-all">
                {t('settings.cancel')}
              </button>
              <button onClick={handleBuy} disabled={buyBusy}
                className="flex-1 py-2.5 rounded-xl text-xs font-black text-white active:scale-95 transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.8), rgba(139,92,246,0.8))' }}>
                {buyBusy ? t('pvp.sending') : t('marketplace.buyButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
