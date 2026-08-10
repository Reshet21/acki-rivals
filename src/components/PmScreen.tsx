import { useState, useEffect, useRef, useCallback } from 'react';
import { useHaptic } from '../hooks/useHaptic';
import { useI18n } from '../i18n';
import Icon from './Icon';
import {
  sendPm, fetchPmHistory, fetchConversations,
  type PmMessage, type Conversation,
} from '../services/chatService';

interface Props {
  playerId: string;
  initialWith?: { player: string; name: string } | null;
  onBack: () => void;
}

export default function PmScreen({ playerId, initialWith, onBack }: Props) {
  const { impactOccurred, selectionChanged } = useHaptic();
  const { t } = useI18n();

  const [view, setView] = useState<'list' | 'chat'>(initialWith ? 'chat' : 'list');
  const [with_, setWith] = useState<{ player: string; name: string } | null>(initialWith || null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<PmMessage[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const lastIdRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const stickBottomRef = useRef(true);
  const convRef = useRef(conversations);
  convRef.current = conversations;

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    if (sameDay) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  const fullReload = useCallback(async (withPlayer: string) => {
    const msgs = await fetchPmHistory(playerId, withPlayer, 0);
    setMessages(msgs);
    lastIdRef.current = msgs.length > 0 ? msgs[msgs.length - 1].id : 0;
    if (msgs.length > 0) setConversations((prev) => prev.map((c) => (c.player === withPlayer ? { ...c, unread: 0 } : c)));
  }, [playerId]);

  const openChat = useCallback((c: Conversation) => {
    selectionChanged();
    setWith({ player: c.player, name: c.name });
    setMessages([]);
    lastIdRef.current = 0;
    setView('chat');
    fullReload(c.player);
  }, [fullReload, selectionChanged]);

  const loadConversations = useCallback(async () => {
    const convs = await fetchConversations(playerId);
    setConversations(convs);
  }, [playerId]);

  // Поллинг
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (view === 'list') {
      pollRef.current = setInterval(loadConversations, 3000);
      loadConversations();
    } else if (with_) {
      pollRef.current = setInterval(async () => {
        const msgs = await fetchPmHistory(playerId, with_.player, lastIdRef.current);
        if (msgs.length === 0) return;
        setMessages((prev) => [...prev, ...msgs]);
        lastIdRef.current = Math.max(lastIdRef.current, ...msgs.map((m) => m.id));
        setConversations((prev) => prev.map((c) => (c.player === with_.player ? { ...c, unread: 0 } : c)));
      }, 2500);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [view, with_, playerId, loadConversations]);

  // Авто-скролл вниз
  useEffect(() => {
    const el = listRef.current;
    if (el && stickBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, view]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !with_) return;
    impactOccurred('light');
    setSending(true);
    setError(null);
    const result = await sendPm(playerId, with_.player, text);
    setSending(false);
    if (!result.ok) {
      setError(result.error || 'Ошибка отправки');
      return;
    }
    setInput('');
    await fullReload(with_.player);
  };

  const handleBack = () => {
    if (view === 'chat' && !initialWith) {
      selectionChanged();
      setView('list');
      setWith(null);
      return;
    }
    onBack();
  };

  return (
    <div className="flex flex-col h-full max-w-md mx-auto px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <button onClick={handleBack} className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] active:scale-90 transition-all">
          <Icon name="back" size={16} style={{ color: 'rgba(255,255,255,0.7)' }} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-base font-black font-display truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>
            {view === 'chat' && with_ ? with_.name : t('pm.title')}
          </div>
          {view === 'chat' && with_ && (
            <div className="text-[9px] text-white/30 truncate font-mono">{with_.player}</div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-2 px-3 py-2 rounded-xl text-[11px] font-medium" style={{ background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.25)', color: '#ff9b9b' }}>
          {error}
        </div>
      )}

      {view === 'list' ? (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pb-1 pr-0.5">
          {conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-center gap-2">
              <div className="text-white/25"><Icon name="user" size={30} /></div>
              <div className="text-xs text-white/35">{t('pm.empty')}</div>
            </div>
          )}
          {conversations.map((c) => (
            <button key={c.player} onClick={() => openChat(c)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] active:scale-[0.98] transition-all text-left">
              <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center border border-white/[0.08]"
                style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(139,92,246,0.12))' }}>
                <Icon name="user" size={18} style={{ color: c.unread > 0 ? '#00d4ff' : 'rgba(255,255,255,0.45)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>{c.name}</span>
                  {c.unread > 0 && (
                    <span className="shrink-0 px-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-black text-black"
                      style={{ background: '#00d4ff' }}>{c.unread}</span>
                  )}
                </div>
                <div className="text-[11px] text-white/40 truncate mt-0.5">
                  {c.last_text}
                  <span className="text-white/25 ml-1.5">{fmtTime(c.last_at)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div ref={listRef} onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto space-y-2 pb-1 pr-0.5">
          {messages.length === 0 && (
            <div className="text-center py-10 text-xs text-white/25">{t('pm.emptyChat')}</div>
          )}
          {messages.map((m) => {
            const mine = m.sender === playerId;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl border ${mine ? 'rounded-br-md border-neon-blue/25' : 'rounded-bl-md border-white/[0.06]'}`}
                  style={{ background: mine ? 'rgba(0,212,255,0.10)' : 'rgba(255,255,255,0.04)' }}>
                  <div className="text-[13px] leading-snug break-words" style={{ color: 'rgba(255,255,255,0.88)' }}>{m.text}</div>
                  <div className={`text-[9px] mt-1 ${mine ? 'text-neon-blue/50' : 'text-white/25'} text-right`}>{fmtTime(m.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Input (только в переписке) */}
      {view === 'chat' && (
        <div className="flex items-center gap-2 mt-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            placeholder={t('pm.placeholder')}
            maxLength={500}
            className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] text-white placeholder-white/25 outline-none focus:border-neon-blue/50 transition-all"
          />
          <button onClick={handleSend} disabled={!input.trim() || sending}
            className="shrink-0 p-2.5 rounded-xl transition-all active:scale-90 disabled:opacity-30"
            style={{ background: input.trim() ? 'linear-gradient(135deg, rgba(0,212,255,0.25), rgba(139,92,246,0.25))' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,212,255,0.25)' }}>
            {sending ? <Icon name="clock" size={18} style={{ color: 'rgba(255,255,255,0.6)' }} /> : <Icon name="arrowRight" size={18} style={{ color: '#00d4ff' }} />}
          </button>
        </div>
      )}
    </div>
  );
}
