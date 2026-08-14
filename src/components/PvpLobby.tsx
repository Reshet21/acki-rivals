import { useState, useEffect, useRef } from 'react';
import type { Card } from '../types';
import { createGame, joinGame, getWaitingGames, getGame, refundPvpStake, type Game } from '../services/pvpService';
import { useHaptic } from '../hooks/useHaptic';
import { useI18n } from '../i18n';
import Icon from './Icon';

interface Props {
  playerId: string;
  playerName?: string;
  deck: Card[];
  onStartBattle: (game: Game, isHost: boolean) => void;
  onBack: () => void;
  onMinimize?: () => void;
}

type Tab = 'menu' | 'open' | 'join';

export default function PvpLobby({ playerId, playerName, deck, onStartBattle, onBack, onMinimize }: Props) {
  const displayName = playerName || playerId;
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
  const [stake, setStake] = useState(0);
  const [randomQueue, setRandomQueue] = useState(false);
  const [searchTimer, setSearchTimer] = useState(0);
  const [menuItemsRevealed, setMenuItemsRevealed] = useState(false);
  const [waitTime, setWaitTime] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const creatingRef = useRef(false);
  const joiningRef = useRef(false);
  const createdOwnRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setMenuItemsRevealed(true), 100);
    return () => clearTimeout(timer);
  }, [tab]);

  // Restore a pending waiting room if user minimized the lobby earlier
  useEffect(() => {
    if (room) return;
    const pendingId = localStorage.getItem('pvp_pending_room_id');
    if (!pendingId) return;
    let cancelled = false;
    getGame(pendingId).then((g) => {
      if (cancelled) return;
      if (g && g.status === 'waiting' && !g.guest_id) {
        setRoom(g);
      } else {
        localStorage.removeItem('pvp_pending_room_id');
      }
    }).catch(() => localStorage.removeItem('pvp_pending_room_id'));
    return () => { cancelled = true; };
  }, []);

  // Poll room for updates (fallback for realtime)
  useEffect(() => {
    if (!room) { if (pollRef.current) clearInterval(pollRef.current); return; }

    const poll = async () => {
      try {
        const fresh = await getGame(room.id);
        if (fresh && fresh.guest_id && fresh.status === 'active') {
          if (pollRef.current) clearInterval(pollRef.current);
          if (waitTimerRef.current) clearInterval(waitTimerRef.current);
          setRoom(null);
          localStorage.removeItem('pvp_pending_room_id');
          onStartBattle(fresh, fresh.host_id === playerId);
        }
      } catch {}
    };

    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [room?.id, playerId, onStartBattle]);

  // Waiting room timer
  useEffect(() => {
    if (room && !room.guest_id) {
      setWaitTime(0);
      waitTimerRef.current = setInterval(() => setWaitTime((t) => t + 1), 1000);
      return () => { if (waitTimerRef.current) clearInterval(waitTimerRef.current); };
    } else {
      setWaitTime(0);
      if (waitTimerRef.current) clearInterval(waitTimerRef.current);
    }
  }, [room?.id, room?.guest_id]);

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
    if (!randomQueue) {
      createdOwnRef.current = false;
      return;
    }
    const startTime = Date.now();
    const check = async () => {
      // Lock immediately to prevent duplicate create/join
      const acquired = joiningRef.current || creatingRef.current;
      if (acquired) return;
      creatingRef.current = true; // lock BEFORE first await
      try {
        const games = await getWaitingGames();
        const avail = games.filter((g) => g.host_id !== playerId);
        if (avail.length > 0) {
          joiningRef.current = true;
          creatingRef.current = false; // release create lock before join
          const updated = await joinGame(avail[0].id, playerId, deck, displayName);
          joiningRef.current = false;
          if (updated) { setRandomQueue(false); setRoom(updated); }
        } else if (!createdOwnRef.current && Date.now() - startTime >= 3000) {
          createdOwnRef.current = true;
          const g = await createGame(playerId, deck, displayName, stake > 0 ? BigInt(Math.round(stake * 1e9)).toString() : '0');
          if (g) { setRandomQueue(false); setRoom(g); }
        } else {
          creatingRef.current = false; // nothing to do, release lock
        }
      } catch (e: any) {
        if (e?.message) setError(String(e.message));
        // Сбросить ОБА лоча, иначе после первой ошибки join (гонка «комната
        // уже занята») поиск навсегда замирает: следующий тик выходит по
        // acquired=true и ничего не делает.
        joiningRef.current = false;
        creatingRef.current = false;
      }
    };
    check();
    const i = setInterval(check, 2000);
    return () => clearInterval(i);
  }, [randomQueue, playerId, deck, displayName]);

  const handleCreate = async () => {
    if (deck.length !== 10 || creatingRef.current) return;
    creatingRef.current = true;
    try {
      setWaiting(true); setError(null);
      // Резерв ставки делает сервер (create) — клиент только создаёт комнату
      const g = await createGame(playerId, deck, displayName, stake > 0 ? BigInt(Math.round(stake * 1e9)).toString() : '0');
      if (g) { setRoom(g); localStorage.setItem('pvp_pending_room_id', g.id); setTab('menu'); }
    } catch (e: any) { setError(e.message); } finally { setWaiting(false); creatingRef.current = false; }
  };

  const handleRandom = () => { if (deck.length !== 10) return; setRandomQueue(true); setSearchTimer(0); setTab('menu'); };
  const cancelRandom = () => { setRandomQueue(false); setSearchTimer(0); };

  const handleJoinOpen = async (game: Game) => {
    if (joiningRef.current) return;
    joiningRef.current = true;
    try {
      setWaiting(true); setError(null);
      // Резерв ставки гостя делает сервер (join) — сумму из запроса не принять
      const updated = await joinGame(game.id, playerId, deck, displayName);
      if (updated) { setRoom(updated); localStorage.setItem('pvp_pending_room_id', updated.id); setTab('menu'); }
    } catch (e: any) { setError(e.message); } finally { setWaiting(false); joiningRef.current = false; }
  };

  const handleJoinCode = async () => {
    if (!joinCode.trim() || joiningRef.current) return;
    joiningRef.current = true;
    try {
      setWaiting(true); setError(null);
      const games = await getWaitingGames();
      const game = games.find((g) => g.id === joinCode.trim());
      if (!game) { setError(t('pvp.errorRoomNotFound')); setWaiting(false); return; }
      if (game.host_id === playerId) { setError(t('pvp.errorSelfJoin')); setWaiting(false); return; }
      const updated = await joinGame(joinCode.trim(), playerId, deck, displayName);
      if (updated) { setRoom(updated); localStorage.setItem('pvp_pending_room_id', updated.id); setTab('menu'); }
    } catch (e: any) { setError(e.message); } finally { setWaiting(false); joiningRef.current = false; }
  };

  const handleCopy = () => { navigator.clipboard.writeText(room?.id || '').then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  const handleAbandon = async () => {
    if (room) {
      // refund удаляет комнату на сервере (хост, гость ещё не вступил)
      await refundPvpStake(playerId, room.id);
      localStorage.removeItem('pvp_pending_room_id');
      setRoom(null);
    }
    setTab('menu');
  };

  const handleMinimize = () => {
    if (onMinimize) onMinimize();
  };

  // ═══ DECK CHECK ═══
  if (deck.length !== 10) return (
    <div className="flex flex-col h-full w-full max-w-lg mx-auto items-center justify-center p-4">
      <div className="text-white/50 text-center"><div className="text-sm">{t('menu.buildDeck')}</div></div>
      <button onClick={() => { impactOccurred('soft'); onBack(); }} className="mt-4 px-6 py-2 rounded-lg text-sm font-bold bg-white/5 border border-white/10 text-white/60 active:bg-white/10">{t('pvp.back')}</button>
    </div>
  );

  // ═══ WAITING FOR OPPONENT ═══
  if (room && !room.guest_id) return (
    <div className="flex flex-col h-full w-full max-w-lg mx-auto items-center justify-center p-4 gap-4 bg-battle relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-64 h-64 rounded-full bg-neon-blue/5 animate-pulse-glow" style={{ top: '10%', left: '50%', transform: 'translateX(-50%)' }} />
        <div className="absolute w-32 h-32 rounded-full bg-an-orange/5 animate-float" style={{ top: '60%', left: '20%' }} />
        <div className="absolute w-24 h-24 rounded-full bg-an-red/5 animate-float-alt" style={{ top: '70%', right: '20%' }} />
      </div>
      <div className="relative z-10 flex flex-col items-center gap-4 w-full max-w-xs">
        <div className="flex justify-center text-an-gold animate-title-glow"><Icon name="sword" size={48} /></div>
        <div className="text-center">
          <div className="text-lg font-black text-an-gold animate-pulse-ring">{t('pvp.player1Waiting')}</div>
          <div className="text-sm text-white/50 text-center mt-1">{t('pvp.waitingForSecondPlayer')}</div>
        </div>

        {/* Player 1 card */}
        <div className="w-full p-3 rounded-xl bg-an-card/60 border border-an-gold/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-an-gold/30 to-an-orange/30 flex items-center justify-center text-an-gold border border-an-gold/30">
            <Icon name="user" size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-white/40 uppercase tracking-wider">{t('pvp.youShort')}</div>
            <div className="text-sm font-bold text-white truncate">{displayName}</div>
          </div>
          <div className="text-xs text-an-gold font-bold">{t('pvp.host')}</div>
        </div>

        {/* Waiting timer */}
        <div className="w-full p-4 rounded-xl bg-an-card/40 border border-white/10 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-neon-blue rounded-full animate-pulse" />
            <span className="text-sm text-white/60">{t('pvp.waitingForOpponent')}</span>
          </div>
          <div className="text-3xl font-black text-white tabular-nums">
            {Math.floor(waitTime / 60).toString().padStart(2, '0')}:{(waitTime % 60).toString().padStart(2, '0')}
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-neon-blue to-neon-purple rounded-full animate-pulse" style={{ width: `${Math.min(100, (waitTime / 60) * 100)}%` }} />
          </div>
        </div>

        <div className="w-full max-w-xs mt-2">
          <div className="text-[10px] text-white/40 text-center mb-1 uppercase tracking-widest">{t('pvp.roomCode')}</div>
          <div className="w-full px-4 py-3 rounded-xl bg-an-card/80 border border-an-gold/30 text-center font-mono text-sm text-an-gold break-all select-all backdrop-blur-sm shadow-[0_0_20px_rgba(255,215,0,0.15)]">{room.id}</div>
          {(room.stake_nano && Number(room.stake_nano) > 0) && (
            <div className="mt-2 w-full px-4 py-2 rounded-xl bg-an-gold/10 border border-an-gold/40 text-center text-sm font-bold text-an-gold">
              <span className="inline-flex items-center gap-1"><Icon name="target" size={12} /> {t('pvp.stake')}: {(Number(room.stake_nano) / 1e9).toFixed(room.stake_nano.length > 10 ? 2 : 0)} NACKL</span>
            </div>
          )}
        </div>

        <button onClick={() => { selectionChanged(); handleCopy(); }}
          className={`w-full max-w-xs py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
            copied
              ? 'bg-an-green/20 text-an-green border-2 border-an-green/40 shadow-[0_0_20px_rgba(0,230,118,0.2)]'
              : 'bg-an-card/60 border-2 border-an-gold/20 text-an-gold hover:border-an-gold/40 active:bg-an-surface'
          }`}>
          {copied ? <span className="inline-flex items-center gap-1.5 justify-center"><Icon name="check" size={13} stroke={2.4} /> {t('pvp.copied')}</span> : <span className="inline-flex items-center gap-1.5 justify-center"><Icon name="deck" size={13} /> {t('pvp.copyCode')}</span>}
        </button>

        <div className="flex gap-2 w-full max-w-xs">
          <button onClick={handleMinimize}
            className="flex-1 py-3 rounded-xl text-sm font-bold bg-an-card/60 border-2 border-white/10 text-white/70 hover:border-white/30 active:bg-white/5 transition-all duration-200">
            {t('pvp.minimize')}
          </button>
          <button onClick={handleAbandon}
            className="flex-1 py-3 rounded-xl text-sm font-bold bg-an-red/10 border-2 border-an-red/30 text-an-red hover:border-an-red/50 active:bg-an-red/20 transition-all duration-200">
            {t('pvp.exitRoom')}
          </button>
        </div>
      </div>
    </div>
  );

  // ═══ RANDOM MATCHMAKING ═══
  if (randomQueue) return (
    <div className="flex flex-col h-full w-full max-w-lg mx-auto items-center justify-center p-4 gap-6 bg-battle relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-80 h-80 rounded-full bg-neon-blue/5 animate-pulse-glow" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
        <div className="absolute w-40 h-40 rounded-full bg-an-red/5 animate-float" style={{ top: '20%', right: '10%' }} />
        <div className="absolute w-32 h-32 rounded-full bg-neon-blue/5 animate-float-alt" style={{ bottom: '20%', left: '10%' }} />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="absolute w-1.5 h-1.5 rounded-full animate-drift" 
            style={{
              background: ['rgba(255,215,0,0.3)', 'rgba(255,61,0,0.2)', 'rgba(0,212,255,0.2)'][i % 3],
              top: `${10 + Math.random() * 80}%`,
              left: `${10 + Math.random() * 80}%`,
              animationDelay: `${i * 1.5}s`,
            }} />
        ))}
      </div>
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="relative">
          <div className="flex justify-center animate-spin text-neon-blue" style={{ animationDuration: '2s' }}><Icon name="dice" size={48} /></div>
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-neon-blue rounded-full animate-ping" />
        </div>
        <div className="text-center">
          <div className="text-lg font-black text-white mb-1">{t('pvp.findingOpponent')}</div>
          <div className="text-sm text-white/40">{t('pvp.lookingForOpenRoom')}</div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-black text-white tabular-nums">{searchTimer}</span>
          <span className="text-[10px] text-white/40">сек</span>
        </div>
        <div className="w-full max-w-[200px] h-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-neon-blue to-neon-purple rounded-full animate-pulse" 
            style={{ width: `${Math.min(100, (searchTimer / 10) * 100)}%` }} />
        </div>
        <button onClick={cancelRandom} 
          className="mt-4 px-8 py-3 rounded-xl text-sm font-bold bg-an-red/10 border border-an-red/30 text-an-red hover:border-an-red/50 active:bg-an-red/20 transition-all">
          <span className="inline-flex items-center gap-1.5 justify-center"><Icon name="close" size={13} /> {t('pvp.exitSearch').replace(/^[^\p{L}\p{N}]+/u, '').trim()}</span>
        </button>
      </div>
    </div>
  );

  // ═══ MAIN MENU ═══
  return (
    <div className="flex flex-col h-full w-full max-w-lg mx-auto overflow-hidden bg-battle relative">
      {/* Header */}
      <div className="relative z-10 px-4 pt-4 pb-2 shrink-0">
        <button
          onClick={() => { impactOccurred('soft'); onBack(); }}
          className="absolute left-4 top-4 w-8 h-8 rounded-lg flex items-center justify-center text-sm bg-white/10 text-white/80 active:bg-white/20 active:scale-95 transition-all"
        >
          ←
        </button>
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 text-lg font-black text-white"><Icon name="sword" size={16} /> PvP</div>
          <div className="text-[10px] text-white/30 uppercase tracking-[0.2em]">{t('pvp.gameRules')}</div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="relative z-10 flex mx-4 gap-1 rounded-xl bg-white/[0.03] border border-white/[0.06] p-1 shrink-0">
        {(['menu', 'open', 'join'] as const).map((tabKey) => {
          const active = tab === tabKey;
          const icon = tabKey === 'menu' ? 'gamepad' : tabKey === 'open' ? 'search' : 'link';
          const raw = tabKey === 'menu' ? t('pvp.menu') : tabKey === 'open' ? t('pvp.openRooms') : t('pvp.byCode');
          const label = raw.replace(/^[^\p{L}\p{N}]+/u, '').trim();
          return (
            <button key={tabKey}
              onClick={() => { selectionChanged(); setTab(tabKey); }}
              className="flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
              style={{
                background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.4)',
              }}>
              <Icon name={icon} size={13} />
              {label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="relative z-10 mx-4 mt-2 px-3 py-2 rounded-lg text-xs bg-an-red/10 text-an-red border border-an-red/30 animate-slide-down">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-4 relative z-10">
        {tab === 'menu' && (
          <div className="flex flex-col gap-3 animate-fade-in">
            {/* Stake input */}
            <div className="w-full px-3 py-2.5" style={{ borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-white/60"><Icon name="target" size={12} /> {t('pvp.stake')}</span>
                <div className="flex items-center gap-1.5">
                  {[0, 5, 10, 25].map((v) => (
                    <button key={v} onClick={() => setStake(v)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${stake === v ? 'text-white' : 'text-white/50'}`}
                      style={stake === v ? { background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.2)' } : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {v === 0 ? t('pvp.noStake') : v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number" min={0} step={1}
                  value={stake || ''}
                  onChange={(e) => setStake(Math.max(0, Number(e.target.value) || 0))}
                  placeholder={t('pvp.stakeCustom')}
                  className="w-full px-3 py-1.5 rounded-md text-sm font-bold text-white placeholder-white/25 outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                <span className="text-xs text-white/40 shrink-0">NACKL</span>
              </div>
            </div>

            {/* Random Battle */}
            <button onClick={() => { impactOccurred('medium'); handleRandom(); }} disabled={waiting}
              className={`w-full py-3 font-bold text-base flex items-center justify-center gap-3 active:scale-[0.97] disabled:opacity-50 transition-all ${menuItemsRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} ${!waiting ? 'snake-border' : ''}`}
              style={{ borderRadius: 14, background: 'transparent', border: !waiting ? 'none' : '2px solid rgba(255,255,255,0.1)', color: '#e6ebef', boxShadow: 'none' }}>
              <Icon name="dice" size={22} />
              <div className="flex flex-col items-center text-center">
                <span className="font-bold">{t('pvp.randomBattle')}</span>
                <span className="text-[10px] font-normal opacity-70">{t('pvp.findOpponent')}</span>
              </div>
            </button>

            {/* Create Room */}
            <button onClick={() => { impactOccurred('medium'); handleCreate(); }} disabled={waiting}
              className={`w-full py-3 font-bold text-base flex items-center justify-center gap-3 active:scale-[0.97] disabled:opacity-50 transition-all ${menuItemsRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(230,235,239,0.85)' }}>
              <Icon name="castle" size={22} />
              <div className="flex flex-col items-center text-center">
                <span className="font-bold">{t('pvp.createRoom')}</span>
                <span className="text-[10px] font-normal opacity-70">{t('pvp.shareCode')}</span>
              </div>
            </button>

            {/* Rules footer */}
            <div className="text-center mt-4 animate-fade-in" style={{ animationDelay: '0.5s' }}>
              <div className="flex items-center justify-center gap-3 text-[10px] text-white/20">
                <span className="inline-flex items-center gap-1"><Icon name="heart" size={11} /> 12HP</span>
                <span className="w-1 h-1 rounded-full bg-white/10" />
                <span className="inline-flex items-center gap-1"><Icon name="pill" size={11} /> 12+1 {t('battle.pillzShort')}.</span>
                <span className="w-1 h-1 rounded-full bg-white/10" />
                <span className="inline-flex items-center gap-1"><Icon name="sword" size={11} /> 4 {t('battle.roundShort')}.</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'open' && (
          <div className="flex flex-col gap-2 animate-fade-in">
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs text-white/50 uppercase tracking-wider font-bold">{t('pvp.availableRooms')}</div>
              <button onClick={loadRooms}
                className="text-[10px] px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white/70 hover:bg-white/10 transition-all active:scale-95">
                <span className="inline-flex items-center gap-1.5 justify-center"><Icon name="arrowRight" size={13} /> {t('pvp.refresh').replace(/^[^\p{L}\p{N}]+/u, '').trim()}</span>
              </button>
            </div>
            
            {loadingRooms && (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-white/30">
                <div className="w-4 h-4 border-2 border-an-gold/30 border-t-an-gold rounded-full animate-spin" />
                {t('pvp.loading')}
              </div>
            )}
            
            {!loadingRooms && openRooms.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12 animate-fade-in">
                <div className="flex justify-center opacity-30 text-white/50"><Icon name="clock" size={40} /></div>
                <div className="text-xs text-white/30">{t('pvp.noOpenRooms')}</div>
              </div>
            )}
            
            {openRooms.map((g, i) => (
              <div key={g.id} 
                className="flex items-center justify-between p-4 rounded-2xl bg-an-card/60 border border-an-border/50 hover:border-an-gold/30 transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-an-gold/20 to-an-orange/20 flex items-center justify-center text-an-gold border border-an-gold/20">
                    <Icon name="user" size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white truncate max-w-[140px]">{g.host_id === playerId ? displayName : (g.host_name || t('pvp.host'))}</div>
                    <div className="text-[10px] text-white/30 flex items-center gap-2">
                      <span>10/10 {t('deck.cards')}</span>
                      <span className="w-1 h-1 rounded-full bg-white/10" />
                      {g.stake_nano && Number(g.stake_nano) > 0 && (
                        <span className="inline-flex items-center gap-1 text-an-gold font-bold"><Icon name="target" size={12} /> {(Number(g.stake_nano) / 1e9).toFixed(g.stake_nano.length > 10 ? 2 : 0)} NACKL</span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => { impactOccurred('medium'); handleJoinOpen(g); }} disabled={waiting} 
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-an-gold to-an-orange text-an-dark active:scale-95 disabled:opacity-50 transition-all duration-200 shadow-[0_0_15px_rgba(255,215,0,0.2)]">
                  {t('pvp.join')}
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'join' && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div className="text-xs text-white/50 uppercase tracking-wider">{t('pvp.joinByCode')}</div>
            <div className="flex flex-col gap-3">
              <input 
                type="text" 
                value={joinCode} 
                onChange={(e) => setJoinCode(e.target.value)} 
                placeholder={t('pvp.enterCode')}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.12] text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all duration-200"
              />
              <button onClick={() => { impactOccurred('medium'); handleJoinCode(); }} disabled={!joinCode.trim() || waiting}
                className={`w-full py-3.5 rounded-[14px] text-sm font-bold text-white disabled:opacity-30 active:scale-[0.97] transition-all duration-200 ${joinCode.trim() && !waiting ? 'snake-border' : ''}`}
                style={{ background: 'transparent', border: joinCode.trim() && !waiting ? 'none' : '2px solid rgba(255,255,255,0.1)', boxShadow: 'none' }}>
                {waiting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('pvp.connecting')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 justify-center"><Icon name="sword" size={14} /> {t('pvp.join')}</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 pb-4 relative z-10">
        <button onClick={() => { impactOccurred('soft'); onBack(); }} 
          className="group w-full py-3 rounded-xl font-bold text-sm bg-an-card/40 border border-an-border/30 text-white/40 hover:text-white/60 hover:border-white/20 active:bg-an-surface/50 active:scale-[0.98] transition-all duration-200">
          <span className="group-hover:-translate-x-1 inline-block transition-transform">←</span> {t('pvp.back')}
        </button>
      </div>
    </div>
  );
}
