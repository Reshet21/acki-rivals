import { useState, useEffect, useCallback } from 'react';
import { useGameState } from './hooks/useGameState';
import { openPack as openPackCards } from './utils/packGenerator';
import { getPackById } from './data/packs';
import type { Card } from './types';
import type { WalletConnection } from './services/beeEngine';
import { getStoredSession } from './services/beeEngine';
import { I18nProvider, useI18n } from './i18n';
import BattleScreen from './components/BattleScreen';
import Shop from './components/Shop';
import WalletPanel from './components/WalletPanel';
import MiningPanel from './components/MiningPanel';
import DeckBuilder from './components/DeckBuilder';
import UpgradeScreen from './components/UpgradeScreen';
import PvpLobby from './components/PvpLobby';
import PvpBattleScreen from './components/PvpBattleScreen';
import InfoScreen from './components/InfoScreen';
import LanguageSelector from './components/LanguageSelector';
import Leaderboard from './components/Leaderboard';
import type { Game } from './services/pvpService';

type Screen = 'menu' | 'battle' | 'shop' | 'wallet' | 'mining' | 'deck' | 'upgrade' | 'pvp' | 'pvp_battle' | 'info' | 'lang' | 'leaderboard';

function AppInner() {
  const { t } = useI18n();
  const {
    collection,
    deck,
    setDeck,
    credits,
    battlesWon,
    battlesLost,
    addCard,
    addCredits,
    upgradeCard,
    saveToStorage,
    recordWin,
    recordLoss,
  } = useGameState();

  const [screen, setScreen] = useState<Screen>('menu');
  const [walletConnection, setWalletConnection] = useState<WalletConnection | null>(() =>
    getStoredSession()
  );
  const [pvpGame, setPvpGame] = useState<Game | null>(null);
  const [pvpIsHost, setPvpIsHost] = useState(false);

  useEffect(() => {
    saveToStorage();
  }, [collection, deck, credits, battlesWon, battlesLost, saveToStorage]);

  const handleBattleEnd = useCallback((result: 'win' | 'loss' | 'draw') => {
    if (result === 'win') recordWin();
    else if (result === 'loss') recordLoss();
    setScreen('menu');
  }, [recordWin, recordLoss]);

  const handleBuyPack = useCallback((packId: string) => {
    const pack = getPackById(packId);
    if (!pack || credits < pack.price) return;
    addCredits(-pack.price);
    const newCards = openPackCards(packId);
    newCards.forEach((c) => addCard(c));
  }, [credits, addCredits, addCard]);

  const handleToggleDeck = useCallback((card: Card) => {
    setDeck((prev) => {
      if (!card.uid) return prev;
      const inDeck = prev.some((c) => c.uid === card.uid);
      if (inDeck) {
        return prev.filter((c) => c.uid !== card.uid);
      }
      if (prev.length >= 8) return prev;
      return [...prev, card];
    });
  }, [setDeck]);

  const handleWalletConnected = useCallback((conn: WalletConnection) => {
    setWalletConnection(conn);
  }, []);

  return (
    <div className="min-h-screen w-full overflow-x-hidden overflow-y-auto bg-game-menu text-white flex flex-col relative">
      {screen === 'menu' && (
        <div className="relative flex flex-col items-center min-h-screen w-full overflow-hidden">
          {/* Aurora background effects */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute animate-aurora-1 rounded-full" style={{ width: 300, height: 300, top: '-80px', left: '-80px', background: 'radial-gradient(circle, rgba(183,66,255,0.25) 0%, transparent 70%)' }} />
            <div className="absolute animate-aurora-2 rounded-full" style={{ width: 350, height: 350, bottom: '10%', right: '-100px', background: 'radial-gradient(circle, rgba(0,212,255,0.2) 0%, transparent 70%)', animationDelay: '3s' }} />
            <div className="absolute animate-aurora-3 rounded-full" style={{ width: 250, height: 250, top: '40%', left: '60%', background: 'radial-gradient(circle, rgba(255,45,149,0.15) 0%, transparent 70%)', animationDelay: '6s' }} />
            {/* Grid pattern */}
            <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'linear-gradient(rgba(0,212,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            {/* Sparkles */}
            {[{ top: '18%', left: '12%', delay: '0s' }, { top: '30%', right: '8%', delay: '0.7s' }, { top: '55%', left: '6%', delay: '1.4s' }, { top: '72%', right: '14%', delay: '2.1s' }, { top: '85%', left: '30%', delay: '0.3s' }].map((pos, i) => (
              <div key={i} className="absolute text-white/30 animate-sparkle text-xs" style={{ ...pos, animationDelay: pos.delay }}>&#10022;</div>
            ))}
          </div>

          {/* Floating cards */}
          <div className="absolute menu-card-preview pointer-events-none animate-card-float-1" style={{ width: 64, height: 86, top: '6%', left: '2%', opacity: 0.35, zIndex: 0, transform: 'rotate(-10deg)' }}>
            <img src="/cards/card-acki-nacki.jpeg" alt="" className="block w-full h-full" style={{ objectFit: 'cover', objectPosition: 'top' }} />
          </div>
          <div className="absolute menu-card-preview pointer-events-none animate-card-float-2" style={{ width: 60, height: 80, top: '8%', right: '2%', opacity: 0.32, zIndex: 0, transform: 'rotate(8deg)' }}>
            <img src="/cards/card-cyber-wolf.png" alt="" className="block w-full h-full" style={{ objectFit: 'cover', objectPosition: 'top' }} />
          </div>
          <div className="absolute menu-card-preview pointer-events-none animate-card-float-3" style={{ width: 56, height: 75, bottom: '15%', left: '5%', opacity: 0.3, zIndex: 0, transform: 'rotate(-5deg)' }}>
            <img src="/cards/card-block-keeper.jpeg" alt="" className="block w-full h-full" style={{ objectFit: 'cover', objectPosition: 'top' }} />
          </div>
          <div className="absolute menu-card-preview pointer-events-none animate-card-float-1" style={{ width: 52, height: 70, bottom: '20%', right: '4%', opacity: 0.28, zIndex: 0, transform: 'rotate(12deg)', animationDelay: '1.5s' }}>
            <img src="/cards/card-neon-sniper.png" alt="" className="block w-full h-full" style={{ objectFit: 'cover', objectPosition: 'top' }} />
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center w-full px-5 pt-12 pb-8 gap-5">
            {/* Title */}
            <div className="flex flex-col items-center animate-slide-down" style={{ animationDelay: '0.05s' }}>
              <div className="text-4xl font-black tracking-tight animate-title-glow" style={{ background: 'linear-gradient(90deg, #00d4ff 0%, #b742ff 50%, #ff2d95 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                ACKI RIVALS
              </div>
              <div className="text-[10px] text-white/30 tracking-[0.3em] uppercase mt-1">{t('menu.subtitle')}</div>
              {/* Stats bar with glow */}
              <div className="flex items-center gap-2 mt-3 px-3 py-1.5 rounded-full animate-counter-glow" style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)' }}>
                <span className="text-[10px] text-neon-blue font-bold">💰 {credits}</span>
                <span className="text-[10px] text-white/40">|</span>
                <span className="text-[10px] text-white/60">🏆 {battlesWon}W / {battlesLost}L</span>
                {walletConnection && <><span className="text-[10px] text-white/40">|</span><span className="text-[10px] text-neon-green">🔗</span></>}
              </div>
            </div>

            {/* Main actions - 2 columns */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
              <button onClick={() => setScreen('pvp')} disabled={deck.length !== 8}
                className={`py-3 rounded-xl font-bold text-sm flex flex-col items-center gap-0.5 transition-all ${deck.length === 8 ? 'bg-gradient-to-br from-red-600 to-orange-500 text-white shadow-lg active:scale-95' : 'bg-white/5 text-white/20'}`}>
                <span className="text-lg">🌐</span>
                <span>{t('menu.pvp')}</span>
              </button>
              <button onClick={() => setScreen('battle')} disabled={deck.length !== 8}
                className={`py-3 rounded-xl font-bold text-sm flex flex-col items-center gap-0.5 transition-all ${deck.length === 8 ? 'bg-gradient-to-br from-neon-red to-orange-500 text-white shadow-lg active:scale-95' : 'bg-white/5 text-white/20'}`}>
                <span className="text-lg">⚔️</span>
                <span>{t('menu.ai')}</span>
              </button>
              <button onClick={() => setScreen('deck')}
                className="py-3 rounded-xl font-bold text-sm flex flex-col items-center gap-0.5 bg-gradient-to-br from-neon-purple to-neon-blue text-white shadow-lg active:scale-95 transition-all">
                <span className="text-lg">📚</span>
                <span>{t('menu.deck')}</span>
              </button>
              <button onClick={() => setScreen('shop')}
                className="py-3 rounded-xl font-bold text-sm flex flex-col items-center gap-0.5 bg-gradient-to-br from-neon-pink to-purple-500 text-white shadow-lg active:scale-95 transition-all">
                <span className="text-lg">🛒</span>
                <span>{t('menu.shop')}</span>
              </button>
            </div>

            {deck.length !== 8 && (
              <div className="text-[10px] text-white/30">{t('menu.buildDeck')}</div>
            )}

            {/* Secondary actions - 3 columns */}
            <div className="grid grid-cols-3 gap-2 w-full max-w-xs mt-1">
              <button onClick={() => setScreen('upgrade')}
                className="py-2.5 rounded-lg font-bold text-[11px] flex flex-col items-center gap-0.5 bg-white/5 border border-white/10 text-white/60 active:scale-95 transition-all">
                <span>⚒️</span>
                <span>{t('menu.upgrade')}</span>
              </button>
              <button onClick={() => setScreen('wallet')}
                className="py-2.5 rounded-lg font-bold text-[11px] flex flex-col items-center gap-0.5 bg-white/5 border border-white/10 text-white/60 active:scale-95 transition-all">
                <span>👛</span>
                <span>{t('menu.wallet')}</span>
              </button>
              <button onClick={() => setScreen('mining')}
                className="py-2.5 rounded-lg font-bold text-[11px] flex flex-col items-center gap-0.5 bg-white/5 border border-white/10 text-white/60 active:scale-95 transition-all">
                <span>⛏️</span>
                <span>{t('menu.mining')}</span>
              </button>
            </div>

            {/* Info + Lang + Reset + Leaderboard row */}
            <div className="grid grid-cols-4 gap-1.5 w-full max-w-xs mt-1">
              <button onClick={() => setScreen('info')}
                className="py-2 rounded-lg font-bold text-[9px] flex flex-col items-center gap-0.5 bg-white/5 border border-white/10 text-white/50 active:scale-95 transition-all">
                📖<span>{t('menu.rules')}</span>
              </button>
              <button onClick={() => setScreen('lang')}
                className="py-2 rounded-lg font-bold text-[9px] flex flex-col items-center gap-0.5 bg-white/5 border border-white/10 text-white/50 active:scale-95 transition-all">
                🌐<span>Язык</span>
              </button>
              <button onClick={() => setScreen('leaderboard')}
                className="py-2 rounded-lg font-bold text-[9px] flex flex-col items-center gap-0.5 bg-white/5 border border-white/10 text-white/50 active:scale-95 transition-all">
                🏆<span>Топ</span>
              </button>
              <button onClick={() => { localStorage.clear(); location.reload(); }}
                className="py-2 rounded-lg font-bold text-[9px] flex flex-col items-center gap-0.5 bg-white/5 border border-white/10 text-white/50 active:scale-95 transition-all">
                🔄<span>{t('menu.reset')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'battle' && (
        <BattleScreen playerDeck={deck} onBattleEnd={handleBattleEnd} />
      )}

      {screen === 'shop' && (
        <div className="flex-1 flex items-center justify-center">
          <Shop credits={credits} onBuyPack={handleBuyPack} onBack={() => setScreen('menu')} />
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
            Подключите кошелек для майнинга
          </div>
          <button
            onClick={() => setScreen('wallet')}
            className="py-3 px-6 rounded-lg font-bold text-sm
              bg-gradient-to-r from-neon-blue to-neon-purple text-white
              active:scale-95 transition-all"
          >
            Подключить кошелек
          </button>
          <button onClick={() => setScreen('menu')} className="text-xs text-white/30">
            Назад
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
            playerId={walletConnection?.walletName || 'player_' + Date.now()}
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
            playerId={walletConnection?.walletName || 'player_' + Date.now()}
            isHost={pvpIsHost}
            onBattleEnd={(result) => {
              if (result === 'win') recordWin();
              else if (result === 'loss') recordLoss();
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

      {screen === 'lang' && (
        <div className="flex-1">
          <LanguageSelector onBack={() => setScreen('menu')} />
        </div>
      )}

      {screen === 'leaderboard' && (
        <div className="flex-1">
          <Leaderboard
            walletAddress={walletConnection?.walletName || null}
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
