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
  const [menuItemsRevealed, setMenuItemsRevealed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setMenuItemsRevealed(true), 100);
    return () => clearTimeout(timer);
  }, [tab]);

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
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto items-center justify-center p-4 gap-4 bg-battle relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-64 h-64 rounded-full bg-an-gold/5 animate-pulse-glow" style={{ top: '10%', left: '50%', transform: 'translateX(-50%)' }} />
        <div className="absolute w-32 h-32 rounded-full bg-an-orange/5 animate-float" style={{ top: '60%', left: '20%' }} />
        <div className="absolute w-24 h-24 rounded-full bg-an-red/5 animate-float-alt" style={{ top: '70%', right: '20%' }} />
      </div>
      <div className="relative z-10 flex flex-col items-center gap-4 w-full">
        <div className="text-5xl animate-title-glow">⚔️</div>
        <div className="text-lg font-black text-an-gold animate-pulse-ring">{t('pvp.waitingForOpponent')}</div>
        <div className="text-sm text-white/30 text-center">{t('pvp.shareCodeHint')}</div>
        
        <div className="w-full max-w-xs mt-2">
          <div className="text-[10px] text-white/40 text-center mb-1 uppercase tracking-widest">{t('pvp.roomCode')}</div>
          <div className="w-full px-4 py-3 rounded-xl bg-an-card/80 border border-an-gold/30 text-center font-mono text-sm text-an-gold break-all select-all backdrop-blur-sm shadow-[0_0_20px_rgba(255,215,0,0.15)]">{room.id}</div>
        </div>
        
        <button onClick={() => { selectionChanged(); handleCopy(); }} 
          className={`w-full max-w-xs py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
            copied 
              ? 'bg-an-green/20 text-an-green border-2 border-an-green/40 shadow-[0_0_20px_rgba(0,230,118,0.2)]' 
              : 'bg-an-card/60 border-2 border-an-gold/20 text-an-gold hover:border-an-gold/40 active:bg-an-surface'
          }`}>
          {copied ? '✓ ' + t('pvp.copied') : '📋 ' + t('pvp.copyCode')}
        </button>
        
        <button onClick={handleEnter} 
          className="w-full max-w-xs py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-an-gold via-yellow-400 to-an-orange text-an-dark active:scale-95 transition-all duration-200 shadow-[0_0_25px_rgba(255,215,0,0.3)]">
          ⚔️ {t('pvp.joinRoom')}
        </button>
        
        <button onClick={handleAbandon} 
          className="w-full max-w-xs py-3 rounded-xl text-sm font-bold bg-an-red/10 border-2 border-an-red/30 text-an-red hover:border-an-red/50 active:bg-an-red/20 transition-all duration-200">
          🚪 {t('pvp.leaveRoom')}
        </button>
      </div>
    </div>
  );

  // ═══ RANDOM MATCHMAKING ═══
  if (randomQueue) return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto items-center justify-center p-4 gap-6 bg-battle relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-80 h-80 rounded-full bg-an-gold/5 animate-pulse-glow" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
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
          <div className="text-5xl animate-spin" style={{ animationDuration: '2s' }}>🎲</div>
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-an-gold rounded-full animate-ping" />
        </div>
        <div className="text-center">
          <div className="text-lg font-black text-an-gold mb-1">{t('pvp.findingOpponent')}</div>
          <div className="text-sm text-white/40">{t('pvp.lookingForOpenRoom')}</div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
          <div className="w-2 h-2 bg-an-gold rounded-full animate-pulse" />
          <span className="text-lg font-black text-white tabular-nums">{searchTimer}</span>
          <span className="text-[10px] text-white/40">сек</span>
        </div>
        <div className="w-full max-w-[200px] h-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-an-gold to-an-orange rounded-full animate-pulse" 
            style={{ width: `${Math.min(100, (searchTimer / 10) * 100)}%` }} />
        </div>
        <button onClick={cancelRandom} 
          className="mt-4 px-8 py-3 rounded-xl text-sm font-bold bg-an-red/10 border-2 border-an-red/30 text-an-red hover:border-an-red/50 active:bg-an-red/20 transition-all duration-200">
          ❌ {t('pvp.exitSearch')}
        </button>
      </div>
    </div>
  );

  // ═══ MAIN MENU ═══
  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto overflow-hidden bg-battle relative">
      {/* Background particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-72 h-72 rounded-full bg-an-gold/[0.04] animate-aurora-1" style={{ top: '-10%', left: '-20%' }} />
        <div className="absolute w-56 h-56 rounded-full bg-an-red/[0.03] animate-aurora-2" style={{ bottom: '-10%', right: '-15%' }} />
        <div className="absolute w-40 h-40 rounded-full bg-neon-blue/[0.03] animate-aurora-3" style={{ top: '40%', left: '50%', transform: 'translateX(-50%)' }} />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="absolute animate-drift"
            style={{
              width: `${6 + Math.random() * 8}px`,
              height: `${6 + Math.random() * 8}px`,
              borderRadius: '50%',
              background: ['rgba(255,215,0,0.08)', 'rgba(255,152,0,0.06)', 'rgba(255,61,0,0.05)', 'rgba(0,212,255,0.06)'][i],
              top: `${15 + i * 20}%`,
              left: `${10 + i * 25}%`,
              animationDelay: `${i * 2}s`,
            }} />
        ))}
      </div>

      {/* Header */}
      <div className="relative z-10 px-4 pt-4 pb-2 shrink-0">
        <div className="text-center">
          <div className="text-lg font-black text-an-gold animate-title-glow">⚔️ PvP</div>
          <div className="text-[10px] text-white/30 uppercase tracking-[0.2em]">{t('pvp.gameRules')}</div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="relative z-10 flex mx-4 gap-1 rounded-xl bg-an-card/50 border border-an-border/50 p-1 shrink-0">
        {(['menu', 'open', 'join'] as const).map((tabKey, i) => (
          <button key={tabKey} 
            onClick={() => { selectionChanged(); setTab(tabKey); }} 
            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all duration-300 ${
              tab === tabKey 
                ? 'bg-gradient-to-r from-an-gold to-an-orange text-an-dark shadow-lg scale-105' 
                : 'text-white/40 hover:text-white/70'
            }`}
            style={{ animationDelay: `${i * 0.1}s` }}>
            {tabKey === 'menu' && t('pvp.menu')}
            {tabKey === 'open' && t('pvp.openRooms')}
            {tabKey === 'join' && t('pvp.byCode')}
          </button>
        ))}
      </div>

      {error && (
        <div className="relative z-10 mx-4 mt-2 px-3 py-2 rounded-lg text-xs bg-an-red/10 text-an-red border border-an-red/30 animate-slide-down">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-4 relative z-10">
        {tab === 'menu' && (
          <div className="flex flex-col gap-3 animate-fade-in">
            {/* Random Battle */}
            <button onClick={() => { impactOccurred('medium'); handleRandom(); }} disabled={waiting} 
              className={`group relative py-5 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 
                bg-gradient-to-br from-an-red via-red-600 to-an-orange text-white 
                shadow-[0_0_30px_rgba(255,61,0,0.2)] 
                active:scale-[0.97] disabled:opacity-50 transition-all duration-200 overflow-hidden
                ${menuItemsRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
              `}
              style={{ transitionDelay: '0.1s', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent group-hover:translate-x-full transition-transform duration-700" />
              <span className="text-3xl">🎲</span>
              <span className="text-base">{t('pvp.randomBattle')}</span>
              <span className="text-[10px] text-white/60 font-normal">{t('pvp.findOpponent')}</span>
            </button>
            
            {/* Create Room */}
            <button onClick={() => { impactOccurred('medium'); handleCreate(); }} disabled={waiting} 
              className={`group relative py-5 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 
                bg-gradient-to-br from-an-gold via-yellow-500 to-an-orange text-an-dark 
                shadow-[0_0_30px_rgba(255,215,0,0.2)] 
                active:scale-[0.97] disabled:opacity-50 transition-all duration-200 overflow-hidden
                ${menuItemsRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
              `}
              style={{ transitionDelay: '0.2s', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:translate-x-full transition-transform duration-700" />
              <span className="text-3xl">🏠</span>
              <span className="text-base">{t('pvp.createRoom')}</span>
              <span className="text-[10px] text-an-dark/60 font-normal">{t('pvp.shareCode')}</span>
            </button>

            {/* Rules footer */}
            <div className="text-center mt-4 animate-fade-in" style={{ animationDelay: '0.5s' }}>
              <div className="flex items-center justify-center gap-3 text-[10px] text-white/20">
                <span>❤️ 12HP</span>
                <span className="w-1 h-1 rounded-full bg-white/10" />
                <span>💊 12+1 {t('battle.pillzShort')}.</span>
                <span className="w-1 h-1 rounded-full bg-white/10" />
                <span>⚔️ 4 {t('battle.roundShort')}.</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'open' && (
          <div className="flex flex-col gap-2 animate-fade-in">
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs text-white/50 uppercase tracking-wider font-bold">{t('pvp.availableRooms')}</div>
              <button onClick={loadRooms} 
                className="text-[10px] px-3 py-1 rounded-lg bg-an-gold/10 border border-an-gold/20 text-an-gold hover:bg-an-gold/20 transition-all active:scale-95">
                🔄 {t('pvp.refresh')}
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
                <div className="text-4xl opacity-30">😴</div>
                <div className="text-xs text-white/30">{t('pvp.noOpenRooms')}</div>
              </div>
            )}
            
            {openRooms.map((g, i) => (
              <div key={g.id} 
                className="flex items-center justify-between p-4 rounded-2xl bg-an-card/60 border border-an-border/50 hover:border-an-gold/30 transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-an-gold/20 to-an-orange/20 flex items-center justify-center text-lg border border-an-gold/20">
                    👤
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{g.host_id}</div>
                    <div className="text-[10px] text-white/30 flex items-center gap-2">
                      <span>{g.host_deck?.length || 0}/8 {t('deck.cards')}</span>
                      <span className="w-1 h-1 rounded-full bg-white/10" />
                      <span className="text-an-gold">⚔️</span>
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
                className="w-full px-4 py-3 rounded-xl bg-an-card/80 border-2 border-an-border/50 text-sm text-white placeholder-white/20 focus:outline-none focus:border-an-gold/50 transition-all duration-200"
              />
              <button onClick={() => { impactOccurred('medium'); handleJoinCode(); }} disabled={!joinCode.trim() || waiting} 
                className="w-full py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-an-gold to-an-orange text-an-dark disabled:opacity-30 active:scale-[0.97] transition-all duration-200 shadow-[0_0_20px_rgba(255,215,0,0.2)]">
                {waiting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-an-dark/30 border-t-an-dark rounded-full animate-spin" />
                    Подключение...
                  </span>
                ) : (
                  `⚔️ ${t('pvp.join')}`
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
