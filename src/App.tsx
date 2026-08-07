import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGameState } from './hooks/useGameState';
import { openPack as openPackCards } from './utils/packGenerator';
import type { Card } from './types';
import type { WalletConnection } from './services/beeEngine';
import { getStoredSession, getNacklBalance, getShellBalance } from './services/beeEngine';
import { I18nProvider, useI18n } from './i18n';
import { useTelegram } from './telegram';
import { useHaptic } from './hooks/useHaptic';
import { useMusic } from './hooks/useMusic';
import BattleScreen from './components/BattleScreen';
import Shop from './components/Shop';
import WalletPanel from './components/WalletPanel';
import MiningPanel from './components/MiningPanel';
import DeckBuilder from './components/DeckBuilder';
import UpgradeScreen from './components/UpgradeScreen';
import PvpLobby from './components/PvpLobby';
import PvpBattleScreen from './components/PvpBattleScreen';
import InfoScreen from './components/InfoScreen';
import Leaderboard from './components/Leaderboard';
import SettingsScreen from './components/SettingsScreen';
import Marketplace from './components/Marketplace';
import AnimatedBackground from './components/AnimatedBackground';
import StarfieldCanvas from './components/StarfieldCanvas';
import type { Game } from './services/pvpService';
import { updatePlayerStats, mergePlayerRows } from './services/pvpService';
import { getStoredEpkKey, zkLoginFullFlow, type OAuthProvider } from './services/zkLoginService';

type Screen = 'menu' | 'battle' | 'shop' | 'marketplace' | 'wallet' | 'mining' | 'deck' | 'upgrade' | 'pvp' | 'pvp_battle' | 'info' | 'settings' | 'leaderboard';

function AppInner() {
  const { haptic } = useTelegram();
  const { impactOccurred, selectionChanged } = useHaptic();
  const { t } = useI18n();
  const { isEnabled: musicEnabled, toggle: toggleMusic, pause: pauseMusic, resume: resumeMusic } = useMusic();

  const [walletConnection, setWalletConnection] = useState<WalletConnection | null>(() =>
    getStoredSession()
  );
  const walletAddress = useMemo(() => walletConnection?.walletAddress ?? null, [walletConnection]);

  const {
    collection,
    deck,
    setDeck,
    battlesWon,
    battlesLost,
    addCard,
    removeCard,
    upgradeCard,
    saveToStorage,
    recordWin,
    recordLoss,
    setWalletAddress,
  } = useGameState(walletAddress);

  const [anonId] = useState(() => {
    const stored = localStorage.getItem('pvp_player_id');
    if (stored) return stored;
    const newId = 'p_' + crypto.randomUUID().slice(0, 8);
    localStorage.setItem('pvp_player_id', newId);
    return newId;
  });

  // Стабильный игровой id: с кошельком — его адрес (уникален, одинаков
  // на всех устройствах), без кошелька — анонимный id из localStorage.
  const playerId = walletAddress ?? anonId;

  const [screen, setScreen] = useState<Screen>('menu');

  // Background variant based on current screen
  const bgVariant = screen === 'battle' ? 'battle' :
    screen === 'shop' ? 'shop' :
      (screen === 'pvp' || screen === 'pvp_battle') ? 'pvp' : 'default';

  // Pause music during battles, resume when back to menu
  useEffect(() => {
    if (screen === 'menu' || screen === 'shop' || screen === 'deck') {
      resumeMusic();
    } else {
      pauseMusic();
    }
  }, [screen, resumeMusic, pauseMusic]);
  const [nacklBalance, setNacklBalance] = useState<string | null>(null);
  const [shellBalance, setShellBalance] = useState<string | null>(null);
  const [pvpGame, setPvpGame] = useState<Game | null>(null);
  const [pvpIsHost, setPvpIsHost] = useState(false);
  const [starterPackClaimed, setStarterPackClaimed] = useState<boolean>(() => {
    return localStorage.getItem('acki-starter-claimed') === 'true';
  });
  const [hasEpkKey, setHasEpkKey] = useState<boolean>(() => getStoredEpkKey() !== null);

  // Refresh EPK state
  useEffect(() => {
    setHasEpkKey(getStoredEpkKey() !== null);
  }, [walletConnection]);

  const handleZkLogin = useCallback(async (provider: OAuthProvider = 'google') => {
    if (!walletConnection) {
      setScreen('wallet');
      return;
    }
    try {
      const epk = await zkLoginFullFlow(walletConnection.walletName, provider);
      setHasEpkKey(true);
      console.log('[App] zkLogin completed, EPK key for', epk.walletAddress);
    } catch (e) {
      console.error('[App] zkLogin failed:', e);
      alert(`Ошибка входа (${provider}): ` + (e instanceof Error ? e.message : 'Неизвестная ошибка'));
    }
  }, [walletConnection]);

  useEffect(() => {
    saveToStorage();
  }, [collection, deck, battlesWon, battlesLost, saveToStorage]);

  // Poll NACKL + SHELL balances when wallet connected
  useEffect(() => {
    if (!walletConnection) {
      setNacklBalance(null);
      setShellBalance(null);
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const n = await getNacklBalance(walletConnection.walletAddress);
        if (!cancelled) setNacklBalance(n);
      } catch { /* ignore */ }
      try {
        const s = await getShellBalance(walletConnection.walletAddress);
        if (!cancelled) setShellBalance(s);
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => { cancelled = true; clearInterval(id); };
  }, [walletConnection]);

  const handleBattleEnd = useCallback((result: 'win' | 'loss' | 'draw') => {
    if (result === 'win') { recordWin(); haptic.notificationOccurred('success'); }
    else if (result === 'loss') { recordLoss(); haptic.notificationOccurred('error'); }
    else { haptic.notificationOccurred('warning'); }
    // Update leaderboard
    const playerName = walletConnection?.walletName || playerId;
    updatePlayerStats(playerId, playerName, result === 'win').catch(() => {});
    setScreen('menu');
  }, [recordWin, recordLoss, haptic, walletConnection, playerId]);

  const handleBuyPack = useCallback((packId: string): Card[] | void => {
    const newCards = openPackCards(packId);
    newCards.forEach((c) => addCard(c));
    haptic.notificationOccurred('success');
    return newCards;
  }, [addCard, haptic]);

  const handleClaimStarterPack = useCallback(() => {
    localStorage.setItem('acki-starter-claimed', 'true');
    setStarterPackClaimed(true);
  }, []);

  const handleToggleDeck = useCallback((card: Card) => {
    setDeck((prev) => {
      if (!card.uid) return prev;
      const inDeck = prev.some((c) => c.uid === card.uid);
      if (inDeck) {
        haptic.selectionChanged();
        return prev.filter((c) => c.uid !== card.uid);
      }
      if (prev.length >= 8) return prev;
      haptic.selectionChanged();
      return [...prev, card];
    });
  }, [setDeck, haptic]);

  const handleWalletConnected = useCallback((conn: WalletConnection) => {
    setWalletConnection(conn);
    setWalletAddress(conn.walletAddress);
    // Склеить анонимную статистику (старый p_xxx id) с кошельком
    mergePlayerRows(anonId, conn.walletAddress).catch(() => {});
  }, [setWalletAddress, anonId]);

  // Однократная миграция статистики при старте с уже подключённым кошельком
  useEffect(() => {
    if (walletConnection && anonId !== walletConnection.walletAddress) {
      mergePlayerRows(anonId, walletConnection.walletAddress).catch(() => {});
    }
  }, [walletConnection, anonId]);

  const handleWalletDisconnect = useCallback(() => {
    // Just disconnect wallet session — game progress stays saved
    setWalletConnection(null);
    setNacklBalance(null);
    setShellBalance(null);
    // Switch to anonymous mode (no wallet) — progress for this wallet is saved
    setWalletAddress(null);
  }, [setWalletAddress]);

  return (
    <div className="h-full w-full overflow-x-hidden overflow-y-auto text-white flex flex-col relative safe-top safe-bottom animate-page-enter" style={{ background: '#050508' }}>
      {/* Global animated background for non-menu screens */}
      {screen !== 'menu' && <AnimatedBackground variant={bgVariant} />}

      {screen === 'menu' && (
        <div className="relative flex flex-col items-center h-full w-full overflow-hidden">
          {/* Premium background — Canvas Starfield */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <StarfieldCanvas speed={0.6} />
            <img src="/cards/acki-nacki-hero.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-15 mix-blend-screen" style={{ filter: 'blur(3px)' }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(5,5,8,0.1) 0%, rgba(5,5,8,0.6) 40%, rgba(5,5,8,0.92) 70%, #050508 100%)' }} />
            {/* Animated grid */}
            <div className="absolute inset-0 bg-starfield-grid opacity-40" />
            {/* Premium glow effects */}
            <div className="absolute animate-aurora-1 rounded-full" style={{ width: 400, height: 400, top: '-150px', left: '-100px', background: 'radial-gradient(circle, rgba(255,215,0,0.12) 0%, transparent 70%)' }} />
            <div className="absolute animate-aurora-2 rounded-full" style={{ width: 350, height: 350, bottom: '5%', right: '-80px', background: 'radial-gradient(circle, rgba(255,100,0,0.08) 0%, transparent 70%)', animationDelay: '4s' }} />
            <div className="absolute animate-aurora-3 rounded-full" style={{ width: 300, height: 300, top: '30%', left: '30%', background: 'radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)', animationDelay: '8s' }} />
            {/* Animated particles */}
            {[...Array(8)].map((_, i) => (
              <div key={i} className="absolute animate-particle" style={{
                width: `${2 + Math.random() * 4}px`,
                height: `${2 + Math.random() * 4}px`,
                borderRadius: '50%',
                background: ['rgba(255,215,0,0.4)', 'rgba(255,61,0,0.3)', 'rgba(0,212,255,0.3)'][i % 3],
                left: `${10 + Math.random() * 80}%`,
                bottom: '-10px',
                '--duration': `${8 + Math.random() * 12}s`,
                '--delay': `${Math.random() * 10}s`,
              } as React.CSSProperties} />
            ))}
            {/* Sparkles */}
            {[{ top: '12%', left: '8%', delay: '0s', size: 'sm' }, { top: '25%', right: '5%', delay: '1s', size: 'md' }, { top: '45%', left: '3%', delay: '2s', size: 'sm' }, { top: '65%', right: '8%', delay: '0.5s', size: 'lg' }, { top: '80%', left: '15%', delay: '1.5s', size: 'sm' }].map((pos, i) => (
              <div key={i} className="absolute animate-sparkle" style={{ ...pos, animationDelay: pos.delay, color: 'rgba(255,215,0,0.4)' }}>
                {pos.size === 'lg' ? '✦' : pos.size === 'md' ? '✧' : '·'}
              </div>
            ))}
            {/* Floating card previews - Urban Rivals style */}
            <div className="absolute animate-card-float-1 pointer-events-none" style={{ top: '15%', right: '5%', opacity: 0.1, transform: 'rotate(12deg)' }}>
              <div className="w-12 h-16 rounded-lg menu-card-preview">
                <div className="w-full h-8 rounded-t-lg" style={{ background: 'linear-gradient(135deg, #4b5563, #6b7280)' }} />
              </div>
            </div>
            <div className="absolute animate-card-float-2 pointer-events-none" style={{ bottom: '20%', left: '3%', opacity: 0.08, transform: 'rotate(-8deg)' }}>
              <div className="w-14 h-16 rounded-lg menu-card-preview">
                <div className="w-full h-9 rounded-t-lg" style={{ background: 'linear-gradient(135deg, #581c87, #a855f7)' }} />
              </div>
            </div>
            <div className="absolute animate-card-float-3 pointer-events-none" style={{ top: '50%', right: '2%', opacity: 0.06, transform: 'rotate(18deg)' }}>
              <div className="w-10 h-14 rounded-lg menu-card-preview">
                <div className="w-full h-7 rounded-t-lg" style={{ background: 'linear-gradient(135deg, #78350f, #f59e0b)' }} />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col h-full w-full">
            <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-10 pb-4 flex flex-col items-center gap-4">
              {/* Premium Logo Section */}
              <div className="flex flex-col items-center animate-slide-down" style={{ animationDelay: '0.05s' }}>
                {/* Original NACKL Logo - Now Spinning */}
                <div className="relative mb-2">
                  <div className="absolute -inset-4 rounded-full opacity-30 animate-coin-pulse" style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.3) 0%, transparent 70%)', filter: 'blur(20px)' }} />
                  <div className="animate-coin-spin w-16 h-16 relative">
                    <img src="/cards/an-smiley-yellow.jpg" alt="" className="w-16 h-16 rounded-full border-2 relative z-10" style={{ borderColor: 'rgba(255,215,0,0.4)', boxShadow: '0 0 30px rgba(255,215,0,0.3)' }} />
                  </div>
                </div>
                <h1 className="text-4xl font-black tracking-wider text-hero-gradient font-display" style={{ letterSpacing: '0.08em' }}>
                  ACKI RIVALS
                </h1>
                <p className="text-[10px] tracking-[0.5em] uppercase mt-1 font-display" style={{ color: 'rgba(255,215,0,0.3)' }}>BLOCKCHAIN CARD BATTLE</p>
              </div>

              {/* Wallet / Stats Card */}
              <div className="w-full max-w-xs animate-slide-up" style={{ animationDelay: '0.1s' }}>
                {walletConnection ? (
                  /* Connected wallet — show wallet info + balances */
                  <div className="rounded-2xl p-4 relative overflow-hidden frost" style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.08) 0%, rgba(255,140,0,0.04) 100%)', border: '1px solid rgba(255,215,0,0.15)' }}>
                    <div className="absolute inset-0 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,215,0,0.05) 50%, transparent 100%)', backgroundSize: '200% 100%' }} />
                    {/* Wallet info */}
                    <div className="flex items-center gap-2 mb-3 pb-3" style={{ borderBottom: '1px solid rgba(255,215,0,0.1)' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black" style={{ background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.3)', color: '#FFD700' }}>
                        {walletConnection.walletName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white truncate">{walletConnection.walletName}</div>
                        <div className="text-[9px] truncate" style={{ color: 'rgba(255,215,0,0.4)', fontFamily: 'monospace' }}>{walletConnection.walletAddress.slice(0, 14)}...</div>
                      </div>
                      <div className="text-[8px] px-2 py-1 rounded-full font-bold" style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ADE80' }}>{t('menu.walletConnected')}</div>
                    </div>
                    {/* Balances grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-2 rounded-xl" style={{ background: 'rgba(255,215,0,0.06)' }}>
                        <div className="text-lg font-black" style={{ color: '#FFD700', textShadow: '0 0 10px rgba(255,215,0,0.5)' }}>{nacklBalance ?? '—'}</div>
                        <div className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,215,0,0.4)' }}>NACKL</div>
                      </div>
                      <div className="text-center p-2 rounded-xl" style={{ background: 'rgba(0,212,255,0.06)' }}>
                        <div className="text-lg font-black" style={{ color: '#00d4ff', textShadow: '0 0 10px rgba(0,212,255,0.5)' }}>{shellBalance ?? '—'}</div>
                        <div className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(0,212,255,0.4)' }}>SHELL</div>
                      </div>
                    </div>
                    {/* Battle stats */}
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="text-center">
                        <div className="text-lg font-black" style={{ color: '#4ADE80' }}>{battlesWon}</div>
                        <div className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('menu.wins')}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-black" style={{ color: '#FF6B6B' }}>{battlesLost}</div>
                        <div className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('menu.losses')}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* No wallet — prompt to connect */
                  <button onClick={() => { impactOccurred('medium'); setScreen('wallet'); }}
                    className="w-full rounded-2xl p-4 text-center transition-all active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.06) 0%, rgba(139,92,246,0.04) 100%)', border: '1px solid rgba(0,212,255,0.15)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                    <div className="text-2xl mb-2">👛</div>
                    <div className="text-sm font-bold" style={{ color: '#00d4ff' }}>{t('menu.connectWallet')}</div>
                    <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('menu.connectWalletDesc') || 'Подключите AN Wallet для игры'}</div>
                  </button>
                )}
              </div>

              {/* Deck warning */}
              {deck.length !== 8 && (
                <div className="w-full max-w-xs px-4 py-2.5 rounded-xl text-center animate-fade-in" style={{ background: 'rgba(255,180,0,0.1)', border: '1px solid rgba(255,180,0,0.2)' }}>
                  <span className="text-xs font-medium" style={{ color: 'rgba(255,215,0,0.8)' }}>{t('menu.deckHint')}</span>
                </div>
              )}

              {/* Premium Battle Buttons */}
              <div className="w-full max-w-xs space-y-2.5 animate-slide-up" style={{ animationDelay: '0.15s' }}>
                {/* PvP Button - Hero */}
                <button onClick={() => { impactOccurred('medium'); setScreen('pvp'); }} disabled={deck.length !== 8}
                  className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all relative overflow-hidden active:scale-[0.97] font-display"
                  style={{
                    background: deck.length === 8 ? 'linear-gradient(135deg, #FF3D00 0%, #FF6D00 50%, #FF9100 100%)' : 'rgba(255,255,255,0.03)',
                    border: deck.length === 8 ? '1px solid rgba(255,100,0,0.4)' : '1px solid rgba(255,255,255,0.05)',
                    boxShadow: deck.length === 8 ? '0 6px 30px rgba(255,61,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.2)' : 'none',
                    color: deck.length === 8 ? 'white' : 'rgba(255,255,255,0.15)',
                  }}>
                  {deck.length === 8 && <span className="absolute inset-0 animate-shimmer pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)', backgroundSize: '200% 100%' }} />}
                  <span className="text-xl">⚔️</span>
                  <div className="flex flex-col items-start">
                    <span className="font-bold">{t('menu.pvpBattle')}</span>
                    <span className="text-[10px] font-normal opacity-70">{t('menu.pvpDesc')}</span>
                  </div>
                </button>

                {/* AI Battle Button */}
                <button onClick={() => { impactOccurred('medium'); setScreen('battle'); }} disabled={deck.length !== 8}
                  className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all relative overflow-hidden active:scale-[0.97] font-display"
                  style={{
                    background: deck.length === 8 ? 'linear-gradient(135deg, #0a1628 0%, #0f2847 50%, #163a5f 100%)' : 'rgba(255,255,255,0.03)',
                    border: deck.length === 8 ? '1px solid rgba(0,180,255,0.3)' : '1px solid rgba(255,255,255,0.05)',
                    boxShadow: deck.length === 8 ? '0 6px 30px rgba(0,120,255,0.25), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.2)' : 'none',
                    color: deck.length === 8 ? 'white' : 'rgba(255,255,255,0.15)',
                  }}>
                  {deck.length === 8 && <span className="absolute inset-0 animate-shimmer pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(0,180,255,0.06) 50%, transparent 100%)', backgroundSize: '200% 100%' }} />}
                  <span className="text-xl">🤖</span>
                  <div className="flex flex-col items-start">
                    <span className="font-bold">{t('menu.aiBattle')}</span>
                    <span className="text-[10px] font-normal opacity-70">{t('menu.aiDesc')}</span>
                  </div>
                </button>
              </div>

              {/* Secondary Actions - Premium Cards */}
              <div className="w-full max-w-xs grid grid-cols-3 gap-2 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <button onClick={() => { selectionChanged(); setScreen('deck'); }}
                  className="py-3.5 rounded-xl font-bold text-sm flex flex-col items-center gap-1 transition-all active:scale-[0.95] frost"
                  style={{ border: '1px solid rgba(255,215,0,0.15)' }}>
                  <span className="text-xl">📚</span>
                  <span className="font-display" style={{ color: '#FFD700', fontSize: '11px' }}>{t('menu.deck')}</span>
                </button>
                <button onClick={() => { selectionChanged(); setScreen('shop'); }}
                  className="py-3.5 rounded-xl font-bold text-sm flex flex-col items-center gap-1 transition-all active:scale-[0.95] frost"
                  style={{ border: '1px solid rgba(168,85,247,0.15)' }}>
                  <span className="text-xl">🛒</span>
                  <span className="font-display" style={{ color: '#A855F7', fontSize: '11px' }}>{t('menu.shop')}</span>
                </button>
                <button onClick={() => { selectionChanged(); setScreen('marketplace'); }}
                  className="py-3.5 rounded-xl font-bold text-sm flex flex-col items-center gap-1 transition-all active:scale-[0.95] frost"
                  style={{ border: '1px solid rgba(255,215,0,0.15)' }}>
                  <span className="text-xl">🏪</span>
                  <span className="font-display" style={{ color: '#FFD700', fontSize: '11px' }}>{t('menu.marketplace') || 'Рынок'}</span>
                </button>
              </div>

              {/* Tertiary Actions - Minimal */}
              <div className="w-full max-w-xs grid grid-cols-4 gap-2 animate-slide-up" style={{ animationDelay: '0.25s' }}>
                <button onClick={() => { selectionChanged(); setScreen('upgrade'); }}
                  className="py-2.5 rounded-xl text-[11px] font-medium flex flex-col items-center gap-1 transition-all active:scale-[0.97]"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-base">⚒️</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{t('menu.upgrade')}</span>
                </button>
                <button onClick={() => { selectionChanged(); setScreen('wallet'); }}
                  className="py-2.5 rounded-xl text-[11px] font-medium flex flex-col items-center gap-1 transition-all active:scale-[0.97]"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-base">👛</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{t('menu.wallet')}</span>
                </button>
                <button onClick={() => { selectionChanged(); setScreen('mining'); }}
                  className="py-2.5 rounded-xl text-[11px] font-medium flex flex-col items-center gap-1 transition-all active:scale-[0.97]"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-base">⛏️</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{t('menu.mining')}</span>
                </button>
              </div>
            </div>
            {/* Bottom Navigation - Premium Tab Bar (sticky at the bottom) */}
            <div className="shrink-0 px-5 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <div className="w-full max-w-xs mx-auto flex items-center justify-around py-3 rounded-2xl frost">
                <button onClick={() => { selectionChanged(); setScreen('leaderboard'); }} className="flex flex-col items-center gap-1 px-3 transition-all active:scale-95">
                  <span className="text-lg">🏆</span>
                  <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('menu.leaderboard')}</span>
                </button>
                <button onClick={() => { selectionChanged(); setScreen('info'); }} className="flex flex-col items-center gap-1 px-3 transition-all active:scale-95">
                  <span className="text-lg">📖</span>
                  <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('menu.rules')}</span>
                </button>
                <button onClick={() => { toggleMusic(); selectionChanged(); }} className="flex flex-col items-center gap-1 px-3 transition-all active:scale-95">
                  <span className="text-lg">{musicEnabled ? '🎵' : '🔇'}</span>
                  <span className="text-[9px]" style={{ color: musicEnabled ? 'rgba(255,215,0,0.6)' : 'rgba(255,255,255,0.3)' }}>{musicEnabled ? 'Музыка' : 'Тихо'}</span>
                </button>
                <button onClick={() => { selectionChanged(); setScreen('settings'); }} className="flex flex-col items-center gap-1 px-3 transition-all active:scale-95">
                  <span className="text-lg">⚙️</span>
                  <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('menu.settings')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === 'battle' && (
        <div key="battle" className="relative z-10 h-full animate-page-enter">
          <BattleScreen playerDeck={deck} onBattleEnd={handleBattleEnd} />
        </div>
      )}

      {screen === 'shop' && (
        <div key="shop" className="relative z-10 flex-1 flex items-center justify-center animate-page-enter">
          <Shop
            walletConnection={walletConnection}
            nacklBalance={nacklBalance}
            onBuyPack={handleBuyPack}
            onBack={() => setScreen('menu')}
            starterPackClaimed={starterPackClaimed}
            onClaimStarterPack={handleClaimStarterPack}
            onReconnectWallet={() => setScreen('wallet')}
            onZkLogin={handleZkLogin}
            hasEpkKey={hasEpkKey}
          />
        </div>
      )}

      {screen === 'marketplace' && (
        <div key="marketplace" className="relative z-10 flex-1 flex items-center justify-center animate-page-enter">
          <Marketplace
            walletConnection={walletConnection}
            nacklBalance={nacklBalance}
            collection={collection}
            onAddCard={addCard}
            onRemoveCard={removeCard}
            onBack={() => setScreen('menu')}
          />
        </div>
      )}

      {screen === 'wallet' && (
        <div key="wallet" className="relative z-10 flex-1 flex items-center justify-center animate-page-enter">
          <WalletPanel
            connection={walletConnection}
            onConnected={handleWalletConnected}
            onDisconnect={handleWalletDisconnect}
            onBack={() => setScreen('menu')}
          />
        </div>
      )}

      {screen === 'mining' && walletConnection && (
        <div key="mining" className="relative z-10 flex-1 flex items-center justify-center animate-page-enter">
          <MiningPanel
            connection={walletConnection}
            onBack={() => setScreen('menu')}
          />
        </div>
      )}

      {screen === 'mining' && !walletConnection && (
        <div key="mining-connect" className="relative z-10 flex-1 flex flex-col items-center justify-center gap-4 p-4 animate-page-enter">
          <div className="text-white/50 text-center">
            {t('menu.connectWalletForMining')}
          </div>
          <button
            onClick={() => setScreen('wallet')}
            className="py-3 px-6 rounded-lg font-bold text-sm
              bg-gradient-to-r from-neon-blue to-neon-purple text-white
              active:scale-95 transition-all"
          >
            {t('menu.connectWallet')}
          </button>
          <button onClick={() => setScreen('menu')} className="text-xs text-white/30">
            {t('menu.back')}
          </button>
        </div>
      )}

      {screen === 'deck' && (
        <div key="deck" className="relative z-10 flex-1 animate-page-enter">
          <DeckBuilder
            collection={collection}
            deck={deck}
            onToggleDeck={handleToggleDeck}
            onBack={() => setScreen('menu')}
          />
        </div>
      )}

      {screen === 'upgrade' && (
        <div key="upgrade" className="relative z-10 flex-1 animate-page-enter">
          <UpgradeScreen
            collection={collection}
            onUpgrade={upgradeCard}
            onBack={() => setScreen('menu')}
          />
        </div>
      )}

      {screen === 'pvp' && (
        <div key="pvp" className="relative z-10 flex-1 animate-page-enter">
          <PvpLobby
            playerId={playerId}
            playerName={walletConnection?.walletName || playerId}
            deck={deck}
            onStartBattle={(game, isHost) => {
              setPvpGame(game);
              setPvpIsHost(isHost);
              setScreen('pvp_battle');
            }}
            onBack={() => setScreen('menu')}
            onMinimize={() => setScreen('menu')}
          />
        </div>
      )}

      {screen === 'pvp_battle' && pvpGame && (
        <div key="pvp_battle" className="relative z-10 flex-1 animate-page-enter">
          <PvpBattleScreen
            game={pvpGame}
            playerId={playerId}
            playerName={walletConnection?.walletName || playerId}
            isHost={pvpIsHost}
            onBattleEnd={(result) => {
              if (result === 'win') { recordWin(); haptic.notificationOccurred('success'); }
              else if (result === 'loss') { recordLoss(); haptic.notificationOccurred('error'); }
              else { haptic.notificationOccurred('warning'); }
              const pName = walletConnection?.walletName || playerId;
              updatePlayerStats(playerId, pName, result === 'win').catch(() => {});
              setPvpGame(null);
              setScreen('menu');
            }}
            onSurrender={() => {
              recordLoss();
              const pName = walletConnection?.walletName || playerId;
              updatePlayerStats(playerId, pName, false).catch(() => {});
              setPvpGame(null);
              setScreen('menu');
            }}
          />
        </div>
      )}

      {screen === 'info' && (
        <div key="info" className="relative z-10 flex-1 animate-page-enter">
          <InfoScreen onBack={() => setScreen('menu')} />
        </div>
      )}

      {screen === 'settings' && (
        <div key="settings" className="relative z-10 flex-1 animate-page-enter">
          <SettingsScreen onBack={() => setScreen('menu')} />
        </div>
      )}

      {screen === 'leaderboard' && (
        <div key="leaderboard" className="relative z-10 flex-1 animate-page-enter">
          <Leaderboard
            playerId={playerId}
            playerName={walletConnection?.walletName || playerId}
            wins={battlesWon}
            losses={battlesLost}
            onBack={() => setScreen('menu')}
          />
        </div>
      )}
    </div>
  );
}

export default function App() {
  return <I18nProvider><AppInner /></I18nProvider>;
}
// rebuild 1783796703
