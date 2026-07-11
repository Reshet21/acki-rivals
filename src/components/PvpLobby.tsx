import { useState, useEffect, useRef } from 'react';
import type { Card } from '../types';
import { createGame, joinGame, getWaitingGames, abandonGame, getGame, type Game } from '../services/pvpService';
import { useHaptic } from '../hooks/useHaptic';
import { useI18n } from '../i18n';

interface Props {
  playerId: string;
  deck: Card[];
  onStartBattle: (game: Game, isHost: boolean) => void;
  onBack: () => void;
}

type Tab = 'menu' | 'open' | 'join';

export default function PvpLobby({ playerId, deck, onStartBattle, onBack }: Props) {
  const { impactOccurred, selectionChanged } = useHaptic();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('menu');
  const [room, setRoom] = useState<Game | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [openRooms, setOpenRooms] = useState<Game[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [randomQueue, setRandomQueue] = useState(false);
  const [searchTimer, setSearchTimer] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll room for updates (fallback for realtime)
  useEffect(() => {
    if (!room) { if (pollRef.current) clearInterval(pollRef.current); return; }

    const poll = async () => {
      try {
        const fresh = await getGame(room.id);
        if (fresh && fresh.guest_id && fresh.status === 'active') {
          if (pollRef.current) clearInterval(pollRef.current);
          setRoom(fresh);
          onStartBattle(fresh, fresh.host_id === playerId);
        }
      } catch {}
    };

    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [room?.id, playerId, onStartBattle]);

  // Poll open rooms
  const loadRooms = async () => {
    setLoadingRooms(true);
    try { setOpenRooms((await getWaitingGames()).filter((g) => g.host_id !== playerId)); } catch {}
    setLoadingRooms(false);
  };

  useEffect(() => { if (tab === 'open') loadRooms(); }, [tab]);

  // Random search timer
  useEffect(() => {
    if (!randomQueue) return;
    const i = setInterval(() => setSearchTimer((p) => p + 1), 1000);
    return () => clearInterval(i);
  }, [randomQueue]);

  // Random matchmaking — if no room found after 3s, create one automatically
  useEffect(() => {
    if (!randomQueue) return;
    let createdOwn = false;

    const check = async () => {
      try {
        const games = await getWaitingGames();
        const avail = games.filter((g) => g.host_id !== playerId);
        if (avail.length > 0) {
          const updated = await joinGame(avail[0].id, playerId, deck);
          if (updated) { setRandomQueue(false); setRoom(updated); }
        } else if (!createdOwn && searchTimer >= 3) {
          // No rooms found after 3s — create one automatically
          createdOwn = true;
          const g = await createGame(playerId, deck);
          if (g) { setRandomQueue(false); setRoom(g); }
        }
      } catch {}
    };
    check();
    const i = setInterval(check, 2000);
    return () => clearInterval(i);
  }, [randomQueue, playerId, deck, searchTimer]);

  const handleCreate = async () => {
    if (deck.length !== 8) return;
    try {
      setWaiting(true); setError(null);
      const g = await createGame(playerId, deck);
      if (g) { setRoom(g); setTab('menu'); }
    } catch (e: any) { setError(e.message); } finally { setWaiting(false); }
  };

  const handleRandom = () => { if (deck.length !== 8) return; setRandomQueue(true); setSearchTimer(0); setTab('menu'); };
  const cancelRandom = () => { setRandomQueue(false); setSearchTimer(0); };

  const handleJoinOpen = async (game: Game) => {
    try {
      setWaiting(true); setError(null);
      const updated = await joinGame(game.id, playerId, deck);
      if (updated) { setRoom(updated); setTab('menu'); }
    } catch (e: any) { setError(e.message); } finally { setWaiting(false); }
  };

  const handleJoinCode = async () => {
    if (!joinCode.trim()) return;
    try {
      setWaiting(true); setError(null);
      const games = await getWaitingGames();
      const game = games.find((g) => g.id === joinCode.trim());
      if (!game) { setError(t('pvp.errorRoomNotFound')); setWaiting(false); return; }
      if (game.host_id === playerId) { setError(t('pvp.errorSelfJoin')); setWaiting(false); return; }
      const updated = await joinGame(joinCode.trim(), playerId, deck);
      if (updated) { setRoom(updated); setTab('menu'); }
    } catch (e: any) { setError(e.message); } finally { setWaiting(false); }
  };

  const handleCopy = () => { navigator.clipboard.writeText(room?.id || '').then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  const handleEnter = () => { if (room) onStartBattle(room, room.host_id === playerId); };
  const handleAbandon = async () => {
    if (room) { try { await abandonGame(room.id); } catch {} setRoom(null); }
    setTab('menu');
  };

  // ═══ DECK CHECK ═══
  if (deck.length !== 8) return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto items-center justify-center p-4">
      <div className="text-white/50 text-center"><div className="text-lg mb-2">⚠️</div><div className="text-sm">{t('menu.buildDeck')}</div></div>
      <button onClick={() => { impactOccurred('soft'); onBack(); }} className="mt-4 px-6 py-2 rounded-lg text-sm font-bold bg-white/5 border border-white/10 text-white/60 active:bg-white/10">{t('pvp.back')}</button>
    </div>
  );

  // ═══ WAITING FOR OPPONENT ═══
  if (room && !room.guest_id) return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto items-center justify-center p-4 gap-4">
      <div className="text-4xl animate-pulse">⏳</div>
      <div className="text-lg font-bold text-white">{t('pvp.waitingForOpponent')}</div>
      <div className="w-full max-w-xs">
        <div className="text-[10px] text-white/40 text-center mb-1">{t('pvp.roomCode')}</div>
        <div className="w-full px-3 py-2.5 rounded-lg bg-an-card border border-an-border text-center font-mono text-sm text-an-gold break-all select-all">{room.id}</div>
      </div>
      <button onClick={() => { selectionChanged(); handleCopy(); }} className={`w-full max-w-xs py-2.5 rounded-lg text-sm font-bold transition-all ${copied ? 'bg-an-green/20 text-an-green border border-an-green/30' : 'bg-an-card border border-an-border text-white/60 active:bg-an-surface'}`}>
        {copied ? t('pvp.copied') : t('pvp.copyCode')}
      </button>
      <button onClick={handleEnter} className="w-full max-w-xs py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-an-gold to-an-orange text-an-dark active:scale-95">{t('pvp.joinRoom')}</button>
      <button onClick={handleAbandon} className="w-full max-w-xs py-3 rounded-xl text-sm font-bold bg-an-red text-white active:scale-95">{t('pvp.leaveRoom')}</button>
    </div>
  );

  // ═══ RANDOM MATCHMAKING ═══
  if (randomQueue) return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto items-center justify-center p-4 gap-6">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-spin" style={{ animationDuration: '3s' }}>⚔️</div>
        <div className="text-lg font-bold text-white mb-2">{t('pvp.findingOpponent')}</div>
        <div className="text-sm text-white/40">{searchTimer}с</div>
      </div>
      <div className="flex flex-col gap-1.5 text-xs text-white/30 text-center">
        <div>{t('pvp.lookingForOpenRoom')}</div>
      </div>
      <button onClick={cancelRandom} className="px-6 py-2.5 rounded-lg text-sm font-bold bg-an-red/20 border border-an-red/40 text-an-red active:bg-an-red/30">{t('pvp.exitSearch')}</button>
    </div>
  );

  // ═══ MAIN MENU ═══
  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto overflow-hidden">
      <div className="flex border-b border-an-border shrink-0">
        {(['menu', 'open', 'join'] as const).map((tabKey) => (
          <button key={tabKey} onClick={() => { selectionChanged(); setTab(tabKey); }} className={`flex-1 py-2.5 text-xs font-bold transition-colors ${tab === tabKey ? 'text-an-gold border-b-2 border-an-gold' : 'text-white/40'}`}>
            {tabKey === 'menu' && t('pvp.menu')}{tabKey === 'open' && t('pvp.openRooms')}{tabKey === 'join' && t('pvp.byCode')}
          </button>
        ))}
      </div>
      {error && <div className="mx-3 mt-2 px-3 py-2 rounded-lg text-xs bg-an-red/10 text-an-red border border-an-red/30">{error}</div>}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {tab === 'menu' && (
          <div className="flex flex-col gap-3">
            <button onClick={() => { impactOccurred('medium'); handleRandom(); }} disabled={waiting} className="py-4 rounded-xl font-bold text-sm flex flex-col items-center gap-1 bg-gradient-to-br from-an-red to-an-orange text-white shadow-lg active:scale-95 disabled:opacity-50">
              <span className="text-2xl">🎲</span><span>{t('pvp.randomBattle')}</span><span className="text-[10px] text-white/60 font-normal">{t('pvp.findOpponent')}</span>
            </button>
            <button onClick={() => { impactOccurred('medium'); handleCreate(); }} disabled={waiting} className="py-4 rounded-xl font-bold text-sm flex flex-col items-center gap-1 bg-gradient-to-br from-an-gold to-an-orange text-an-dark shadow-lg active:scale-95 disabled:opacity-50">
              <span className="text-2xl">🏠</span><span>{t('pvp.createRoom')}</span><span className="text-[10px] text-an-dark/60 font-normal">{t('pvp.shareCode')}</span>
            </button>
            <div className="text-center text-[10px] text-white/20 mt-2">{t('pvp.gameRules')}</div>
          </div>
        )}
        {tab === 'open' && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center mb-1">
              <div className="text-xs text-white/40 font-bold">{t('pvp.availableRooms')}</div>
              <button onClick={loadRooms} className="text-[10px] text-an-gold">{t('pvp.refresh')}</button>
            </div>
            {loadingRooms && <div className="text-xs text-white/30 text-center py-4">{t('pvp.loading')}</div>}
            {!loadingRooms && openRooms.length === 0 && <div className="text-xs text-white/30 text-center py-8"><div className="text-2xl mb-2">😴</div>{t('pvp.noOpenRooms')}</div>}
            {openRooms.map((g) => (
              <div key={g.id} className="flex items-center justify-between p-3 rounded-xl bg-an-card border border-an-border">
                <div>
                  <div className="text-sm font-bold text-white">{g.host_id}</div>
                  <div className="text-[10px] text-white/30">{g.host_deck?.length || 0}/8 {t('deck.cards')}</div>
                </div>
                <button onClick={() => { impactOccurred('medium'); handleJoinOpen(g); }} disabled={waiting} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-an-gold text-an-dark active:scale-95 disabled:opacity-50">{t('pvp.join')}</button>
              </div>
            ))}
          </div>
        )}
        {tab === 'join' && (
          <div className="flex flex-col gap-3">
            <div className="text-xs text-white/40">{t('pvp.joinByCode')}</div>
            <div className="flex gap-2">
              <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder={t('pvp.enterCode')} className="flex-1 px-3 py-2 rounded-lg bg-an-card border border-an-border text-sm text-white placeholder-white/30 focus:outline-none focus:border-an-gold" />
              <button onClick={() => { impactOccurred('medium'); handleJoinCode(); }} disabled={!joinCode.trim() || waiting} className="px-4 py-2 rounded-lg text-sm font-bold bg-an-gold text-an-dark disabled:opacity-50 active:scale-95">{waiting ? '...' : t('pvp.join')}</button>
            </div>
          </div>
        )}
      </div>
      <div className="shrink-0 px-3 pb-3">
        <button onClick={() => { impactOccurred('soft'); onBack(); }} className="w-full py-2.5 rounded-lg font-bold text-sm bg-an-card border border-an-border text-white/60 active:bg-an-surface">{t('pvp.back')}</button>
      </div>
    </div>
  );
}
