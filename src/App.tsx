import { useState, useEffect, useCallback } from 'react';
import { useGameState } from './hooks/useGameState';
import { openPack as openPackCards } from './utils/packGenerator';
import type { Card } from './types';
import type { WalletConnection } from './services/beeEngine';
import { getStoredSession, getNacklBalance } from './services/beeEngine';
import { I18nProvider, useI18n } from './i18n';
import { useTelegram } from './telegram';
import { useHaptic } from './hooks/useHaptic';
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
import type { Game } from './services/pvpService';

type Screen = 'menu' | 'battle' | 'shop' | 'wallet' | 'mining' | 'deck' | 'upgrade' | 'pvp' | 'pvp_battle' | 'info' | 'settings' | 'leaderboard';

function AppInner() {
  const { haptic, user } = useTelegram();
  const { impactOccurred, selectionChanged } = useHaptic();
  const { t } = useI18n();
  const {
    collection,
    deck,
    setDeck,
    credits,
    battlesWon,
    battlesLost,
    addCard,
    addCredits: _addCredits,
    upgradeCard,
    saveToStorage,
    recordWin,
    recordLoss,
  } = useGameState();

  const [playerId] = useState(() => {
    const stored = localStorage.getItem('pvp_player_id');
    if (stored) return stored;
    const newId = 'p_' + crypto.randomUUID().slice(0, 8);
    localStorage.setItem('pvp_player_id', newId);
    return newId;
  });

  const [screen, setScreen] = useState<Screen>('menu');
  const [walletConnection, setWalletConnection] = useState<WalletConnection | null>(() =>
    getStoredSession()
  );
  const [nacklBalance, setNacklBalance] = useState<string | null>(null);
  const [pvpGame, setPvpGame] = useState<Game | null>(null);
  const [pvpIsHost, setPvpIsHost] = useState(false);

  useEffect(() => {
    saveToStorage();
  }, [collection, deck, credits, battlesWon, battlesLost, saveToStorage]);

  // Poll NACKL balance when wallet connected
  useEffect(() => {
    if (!walletConnection) { setNacklBalance(null); return; }

    let cancelled = false;
    const poll = async () => {
      try {
        const b = await getNacklBalance(walletConnection.walletAddress);
        if (!cancelled) setNacklBalance(b);
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
    setScreen('menu');
  }, [recordWin, recordLoss, haptic]);

  const handleBuyPack = useCallback((packId: string): Card[] | void => {
    const newCards = openPackCards(packId);
    newCards.forEach((c) => addCard(c));
    haptic.notificationOccurred('success');
    return newCards;
  }, [addCard, haptic]);

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
  }, []);

  return (
    <div className="min-h-screen w-full overflow-x-hidden overflow-y-auto text-white flex flex-col relative" style={{ background: '#050508' }}>
      {screen === 'menu' && (
        <div className="relative flex flex-col items-center min-h-screen w-full overflow-hidden">
          {/* Premium background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <img src="/cards/acki-nacki-hero.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" style={{ filter: 'blur(2px)' }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(5,5,8,0.3) 0%, rgba(5,5,8,0.7) 40%, rgba(5,5,8,0.95) 70%, #050508 100%)' }} />
            {/* Premium glow effects */}
            <div className="absolute animate-aurora-1 rounded-full" style={{ width: 400, height: 400, top: '-150px', left: '-100px', background: 'radial-gradient(circle, rgba(255,215,0,0.12) 0%, transparent 70%)' }} />
            <div className="absolute animate-aurora-2 rounded-full" style={{ width: 350, height: 350, bottom: '5%', right: '-80px', background: 'radial-gradient(circle, rgba(255,100,0,0.08) 0%, transparent 70%)', animationDelay: '4s' }} />
            {/* Grid pattern */}
            <div style={{ position: 'absolute', inset: 0, opacity: 0.02, backgroundImage: 'linear-gradient(rgba(255,215,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,215,0,1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
            {/* Sparkles */}
            {[{ top: '12%', left: '8%', delay: '0s', size: 'sm' }, { top: '25%', right: '5%', delay: '1s', size: 'md' }, { top: '45%', left: '3%', delay: '2s', size: 'sm' }, { top: '65%', right: '8%', delay: '0.5s', size: 'lg' }, { top: '80%', left: '15%', delay: '1.5s', size: 'sm' }].map((pos, i) => (
              <div key={i} className="absolute animate-sparkle" style={{ ...pos, animationDelay: pos.delay, color: 'rgba(255,215,0,0.4)' }}>
                {pos.size === 'lg' ? '✦' : pos.size === 'md' ? '✧' : '·'}
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center w-full px-5 pt-10 pb-6 gap-4">
            {/* Premium Logo Section */}
            <div className="flex flex-col items-center animate-slide-down" style={{ animationDelay: '0.05s' }}>
              {/* Logo glow effect */}
              <div className="relative">
                <div className="absolute -inset-4 rounded-full opacity-30" style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.3) 0%, transparent 70%)', filter: 'blur(20px)' }} />
                <img src="/cards/an-smiley-yellow.jpg" alt="" className="w-16 h-16 rounded-full border-2 border-an-gold/40 relative z-10" style={{ boxShadow: '0 0 30px rgba(255,215,0,0.3)' }} />
              </div>
              <h1 className="text-3xl font-black tracking-tight mt-3 animate-title-glow" style={{ background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 30%, #FF8C00 60%, #FFD700 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', letterSpacing: '0.05em' }}>
                ACKI RIVALS
              </h1>
              <p className="text-[10px] tracking-[0.4em] uppercase mt-1" style={{ color: 'rgba(255,215,0,0.35)' }}>BLOCKCHAIN CARD BATTLE</p>
            </div>

            {/* Premium Stats Card */}
            <div className="w-full max-w-xs animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.08) 0%, rgba(255,140,0,0.04) 100%)', border: '1px solid rgba(255,215,0,0.15)', boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,215,0,0.1)' }}>
                {/* Shimmer effect */}
                <div className="absolute inset-0 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,215,0,0.05) 50%, transparent 100%)', backgroundSize: '200% 100%' }} />
                {/* User info */}
                {user && (
                  <div className="flex items-center gap-2 mb-3 pb-3" style={{ borderBottom: '1px solid rgba(255,215,0,0.1)' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.3)' }}>
                      {user.firstName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{user.firstName}</div>
                      {user.username && <div className="text-[10px]" style={{ color: 'rgba(255,215,0,0.5)' }}>@{user.username}</div>}
                    </div>
                  </div>
                )}
                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-xl font-black" style={{ color: '#FFD700', textShadow: '0 0 10px rgba(255,215,0,0.5)' }}>{credits.toLocaleString()}</div>
                    <div className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,215,0,0.4)' }}>{t('menu.credits')}</div>
                  </div>
                  <div>
                    <div className="text-xl font-black" style={{ color: '#4ADE80' }}>{battlesWon}</div>
                    <div className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('menu.wins')}</div>
                  </div>
                  <div>
                    <div className="text-xl font-black" style={{ color: '#FF6B6B' }}>{battlesLost}</div>
                    <div className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('menu.losses')}</div>
                  </div>
                </div>
                {walletConnection && (
                  <div className="mt-3 pt-2 flex items-center justify-center gap-1" style={{ borderTop: '1px solid rgba(255,215,0,0.1)' }}>
                    <span className="text-[9px]" style={{ color: 'rgba(255,215,0,0.4)' }}>{t('menu.walletConnected')}</span>
                  </div>
                )}
              </div>
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
                className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all relative overflow-hidden active:scale-[0.98]"
                style={{
                  background: deck.length === 8 ? 'linear-gradient(135deg, #FF3D00 0%, #FF6D00 50%, #FF9100 100%)' : 'rgba(255,255,255,0.03)',
                  border: deck.length === 8 ? '1px solid rgba(255,100,0,0.4)' : '1px solid rgba(255,255,255,0.05)',
                  boxShadow: deck.length === 8 ? '0 4px 20px rgba(255,61,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)' : 'none',
                  color: deck.length === 8 ? 'white' : 'rgba(255,255,255,0.15)',
                }}>
                <span className="text-xl">⚔️</span>
                <div className="flex flex-col items-start">
                  <span className="font-bold">{t('menu.pvpBattle')}</span>
                  <span className="text-[10px] font-normal opacity-70">{t('menu.pvpDesc')}</span>
                </div>
              </button>

              {/* AI Battle Button */}
              <button onClick={() => { impactOccurred('medium'); setScreen('battle'); }} disabled={deck.length !== 8}
                className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all relative overflow-hidden active:scale-[0.98]"
                style={{
                  background: deck.length === 8 ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' : 'rgba(255,255,255,0.03)',
                  border: deck.length === 8 ? '1px solid rgba(0,212,255,0.3)' : '1px solid rgba(255,255,255,0.05)',
                  boxShadow: deck.length === 8 ? '0 4px 20px rgba(0,212,255,0.15), inset 0 1px 0 rgba(255,255,255,0.05)' : 'none',
                  color: deck.length === 8 ? 'white' : 'rgba(255,255,255,0.15)',
                }}>
                <span className="text-xl">🤖</span>
                <div className="flex flex-col items-start">
                  <span className="font-bold">{t('menu.aiBattle')}</span>
                  <span className="text-[10px] font-normal opacity-70">{t('menu.aiDesc')}</span>
                </div>
              </button>
            </div>

            {/* Secondary Actions - Premium Cards */}
            <div className="w-full max-w-xs grid grid-cols-2 gap-2.5 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <button onClick={() => { selectionChanged(); setScreen('deck'); }}
                className="py-3.5 rounded-xl font-bold text-sm flex flex-col items-center gap-1 transition-all active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.12) 0%, rgba(255,140,0,0.06) 100%)', border: '1px solid rgba(255,215,0,0.2)', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
                <span className="text-xl">📚</span>
                <span style={{ color: '#FFD700' }}>{t('menu.deck')}</span>
              </button>
              <button onClick={() => { selectionChanged(); setScreen('shop'); }}
                className="py-3.5 rounded-xl font-bold text-sm flex flex-col items-center gap-1 transition-all active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.12) 0%, rgba(139,92,246,0.06) 100%)', border: '1px solid rgba(168,85,247,0.2)', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
                <span className="text-xl">🛒</span>
                <span style={{ color: '#A855F7' }}>{t('menu.shop')}</span>
              </button>
            </div>

            {/* Tertiary Actions - Minimal */}
            <div className="w-full max-w-xs grid grid-cols-3 gap-2 animate-slide-up" style={{ animationDelay: '0.25s' }}>
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

            {/* Bottom Navigation - Premium Tab Bar */}
            <div className="w-full max-w-xs mt-2 animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <div className="flex items-center justify-around py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <button onClick={() => { selectionChanged(); setScreen('leaderboard'); }} className="flex flex-col items-center gap-1 px-3 transition-all active:scale-95">
                  <span className="text-lg">🏆</span>
                  <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('menu.leaderboard')}</span>
                </button>
                <button onClick={() => { selectionChanged(); setScreen('info'); }} className="flex flex-col items-center gap-1 px-3 transition-all active:scale-95">
                  <span className="text-lg">📖</span>
                  <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('menu.rules')}</span>
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
        <BattleScreen playerDeck={deck} onBattleEnd={handleBattleEnd} />
      )}

      {screen === 'shop' && (
        <div className="flex-1 flex items-center justify-center">
          <Shop
            walletConnection={walletConnection}
            nacklBalance={nacklBalance}
            onBuyPack={handleBuyPack}
            onBack={() => setScreen('menu')}
          />
        </div>
      )}

      {screen === 'wallet' && (
        <div className="flex-1 flex items-center justify-center">
          <WalletPanel
            onConnected={handleWalletConnected}
            onBack={() => setScreen('menu')}
          />
        </div>
      )}

      {screen === 'mining' && walletConnection && (
        <div className="flex-1 flex items-center justify-center">
          <MiningPanel
            connection={walletConnection}
            onBack={() => setScreen('menu')}
          />
        </div>
      )}

      {screen === 'mining' && !walletConnection && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
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
        <div className="flex-1">
          <DeckBuilder
            collection={collection}
            deck={deck}
            onToggleDeck={handleToggleDeck}
            onBack={() => setScreen('menu')}
          />
        </div>
      )}

      {screen === 'upgrade' && (
        <div className="flex-1">
          <UpgradeScreen
            collection={collection}
            onUpgrade={upgradeCard}
            onBack={() => setScreen('menu')}
          />
        </div>
      )}

      {screen === 'pvp' && (
        <div className="flex-1">
          <PvpLobby
            playerId={playerId}
            deck={deck}
            onStartBattle={(game, isHost) => {
              setPvpGame(game);
              setPvpIsHost(isHost);
              setScreen('pvp_battle');
            }}
            onBack={() => setScreen('menu')}
          />
        </div>
      )}

      {screen === 'pvp_battle' && pvpGame && (
        <div className="flex-1">
          <PvpBattleScreen
            game={pvpGame}
            playerId={playerId}
            isHost={pvpIsHost}
            onBattleEnd={(result) => {
              if (result === 'win') { recordWin(); haptic.notificationOccurred('success'); }
              else if (result === 'loss') { recordLoss(); haptic.notificationOccurred('error'); }
              else { haptic.notificationOccurred('warning'); }
              setPvpGame(null);
              setScreen('menu');
            }}
            onSurrender={() => {
              recordLoss();
              setPvpGame(null);
              setScreen('menu');
            }}
          />
        </div>
      )}

      {screen === 'info' && (
        <div className="flex-1">
          <InfoScreen onBack={() => setScreen('menu')} />
        </div>
      )}

      {screen === 'settings' && (
        <div className="flex-1">
          <SettingsScreen onBack={() => setScreen('menu')} />
        </div>
      )}

      {screen === 'leaderboard' && (
        <div className="flex-1">
          <Leaderboard
            walletAddress={walletConnection?.walletName || null}
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
