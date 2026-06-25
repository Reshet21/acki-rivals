import { useState, useEffect, useRef } from 'react';
import type { Card } from '../types';
import { createGame, joinGame, getWaitingGames, abandonGame, getGame, type Game } from '../services/pvpService';

interface Props {
  playerId: string;
  deck: Card[];
  onStartBattle: (game: Game, isHost: boolean) => void;
  onBack: () => void;
}

type Tab = 'menu' | 'open' | 'join';

export default function PvpLobby({ playerId, deck, onStartBattle, onBack }: Props) {
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
    if (deck.length !== 4) return;
    try {
      setWaiting(true); setError(null);
      const g = await createGame(playerId, deck);
      if (g) { setRoom(g); setTab('menu'); }
    } catch (e: any) { setError(e.message); } finally { setWaiting(false); }
  };

  const handleRandom = () => { if (deck.length !== 4) return; setRandomQueue(true); setSearchTimer(0); setTab('menu'); };
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
      if (!game) { setError('Комната не найдена'); setWaiting(false); return; }
      if (game.host_id === playerId) { setError('Нельзя войти в свою комнату'); setWaiting(false); return; }
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
  if (deck.length !== 4) return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto items-center justify-center p-4">
      <div className="text-white/50 text-center"><div className="text-lg mb-2">⚠️</div><div className="text-sm">Соберите колоду из 4 карт</div></div>
      <button onClick={onBack} className="mt-4 px-6 py-2 rounded-lg text-sm font-bold bg-white/5 border border-white/10 text-white/60 active:bg-white/10">Назад</button>
    </div>
  );

  // ═══ WAITING FOR OPPONENT ═══
  if (room && !room.guest_id) return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto items-center justify-center p-4 gap-4">
      <div className="text-4xl animate-pulse">⏳</div>
      <div className="text-lg font-bold text-white">Ожидание соперника...</div>
      <div className="w-full max-w-xs">
        <div className="text-[10px] text-white/40 text-center mb-1">Код комнаты</div>
        <div className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-center font-mono text-sm text-neon-green break-all select-all">{room.id}</div>
      </div>
      <button onClick={handleCopy} className={`w-full max-w-xs py-2.5 rounded-lg text-sm font-bold transition-all ${copied ? 'bg-neon-green/20 text-neon-green border border-neon-green/30' : 'bg-white/5 border border-white/10 text-white/60 active:bg-white/10'}`}>
        {copied ? '✓ Скопировано' : '📋 Скопировать код'}
      </button>
      <button onClick={handleEnter} className="w-full max-w-xs py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-neon-blue to-neon-purple text-white active:scale-95 shadow-[0_0_12px_rgba(0,212,255,0.3)]">⚔️ Войти в комнату</button>
      <button onClick={handleAbandon} className="text-xs text-neon-red/50 active:text-neon-red">Выйти из комнаты</button>
    </div>
  );

  // ═══ RANDOM MATCHMAKING ═══
  if (randomQueue) return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto items-center justify-center p-4 gap-6">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-spin" style={{ animationDuration: '3s' }}>⚔️</div>
        <div className="text-lg font-bold text-white mb-2">Подбор соперника...</div>
        <div className="text-sm text-white/40">{searchTimer}с</div>
      </div>
      <div className="flex flex-col gap-1.5 text-xs text-white/30 text-center">
        <div>Ищем открытую комнату</div>
      </div>
      <button onClick={cancelRandom} className="px-6 py-2.5 rounded-lg text-sm font-bold bg-neon-red/10 border border-neon-red/30 text-neon-red active:bg-neon-red/20">❌ Выйти из поиска</button>
    </div>
  );

  // ═══ MAIN MENU ═══
  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto overflow-hidden">
      <div className="flex border-b border-dark-border shrink-0">
        {(['menu', 'open', 'join'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2.5 text-xs font-bold transition-colors ${tab === t ? 'text-neon-blue border-b-2 border-neon-blue' : 'text-white/40'}`}>
            {t === 'menu' && '🎮 Меню'}{t === 'open' && '🔍 Открытые'}{t === 'join' && '🔗 По коду'}
          </button>
        ))}
      </div>
      {error && <div className="mx-3 mt-2 px-3 py-2 rounded-lg text-xs bg-neon-red/10 text-neon-red border border-neon-red/30">{error}</div>}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {tab === 'menu' && (
          <div className="flex flex-col gap-3">
            <button onClick={handleRandom} disabled={waiting} className="py-4 rounded-xl font-bold text-sm flex flex-col items-center gap-1 bg-gradient-to-br from-neon-red to-orange-500 text-white shadow-lg active:scale-95 disabled:opacity-50">
              <span className="text-2xl">🎲</span><span>Случайный бой</span><span className="text-[10px] text-white/60 font-normal">Найдём соперника</span>
            </button>
            <button onClick={handleCreate} disabled={waiting} className="py-4 rounded-xl font-bold text-sm flex flex-col items-center gap-1 bg-gradient-to-br from-neon-purple to-neon-blue text-white shadow-lg active:scale-95 disabled:opacity-50">
              <span className="text-2xl">🏠</span><span>Создать комнату</span><span className="text-[10px] text-white/60 font-normal">Поделись кодом</span>
            </button>
            <div className="text-center text-[10px] text-white/20 mt-2">12HP · 12+1 пиллз · 4 раунда</div>
          </div>
        )}
        {tab === 'open' && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center mb-1">
              <div className="text-xs text-white/40 font-bold">Доступные комнаты</div>
              <button onClick={loadRooms} className="text-[10px] text-neon-blue">🔄 Обновить</button>
            </div>
            {loadingRooms && <div className="text-xs text-white/30 text-center py-4">Загрузка...</div>}
            {!loadingRooms && openRooms.length === 0 && <div className="text-xs text-white/30 text-center py-8"><div className="text-2xl mb-2">😴</div>Нет открытых комнат</div>}
            {openRooms.map((g) => (
              <div key={g.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div><div className="text-sm font-bold text-white">{g.host_id}</div><div className="text-[10px] text-white/30">{g.host_deck?.length || 4}/4 карт</div></div>
                <button onClick={() => handleJoinOpen(g)} disabled={waiting} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-neon-green text-white active:scale-95 disabled:opacity-50">Войти</button>
              </div>
            ))}
          </div>
        )}
        {tab === 'join' && (
          <div className="flex flex-col gap-3">
            <div className="text-xs text-white/40">Введите код комнаты:</div>
            <div className="flex gap-2">
              <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Код комнаты..." className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-neon-blue" />
              <button onClick={handleJoinCode} disabled={!joinCode.trim() || waiting} className="px-4 py-2 rounded-lg text-sm font-bold bg-neon-blue text-white disabled:opacity-50 active:scale-95">{waiting ? '...' : 'Войти'}</button>
            </div>
          </div>
        )}
      </div>
      <div className="shrink-0 px-3 pb-3">
        <button onClick={onBack} className="w-full py-2.5 rounded-lg font-bold text-sm bg-white/5 border border-white/10 text-white/60 active:bg-white/10">Назад</button>
      </div>
    </div>
  );
}
