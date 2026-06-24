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
      if (prev.length >= 4) return prev;
      return [...prev, card];
    });
  }, [setDeck]);

  const handleWalletConnected = useCallback((conn: WalletConnection) => {
    setWalletConnection(conn);
  }, []);

  return (
    <div className="min-h-screen w-full overflow-x-hidden overflow-y-auto bg-game-menu text-white flex flex-col relative">
      {/* Ambient particles for menu */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-1 h-1 bg-neon-purple/20 rounded-full animate-drift" style={{ top: '15%', left: '10%' }} />
        <div className="absolute w-1.5 h-1.5 bg-neon-blue/15 rounded-full animate-drift" style={{ top: '40%', right: '20%', animationDelay: '3s' }} />
        <div className="absolute w-1 h-1 bg-neon-pink/10 rounded-full animate-drift" style={{ top: '70%', left: '85%', animationDelay: '5s' }} />
        <div className="absolute w-1 h-1 bg-neon-green/10 rounded-full animate-drift" style={{ top: '25%', right: '80%', animationDelay: '1s' }} />
      </div>
      {screen === 'menu' && (
        <div className="flex flex-col items-center flex-1 gap-3 p-4 pt-10 overflow-y-auto">
          {/* Title */}
          <div className="text-center mb-2">
            <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-blue via-neon-purple to-neon-pink">
              ACKI RIVALS
            </div>
            <div className="text-[10px] text-white/30 mt-1">{t('menu.subtitle')}</div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center justify-center gap-3 text-[10px] text-white/40 mb-2">
            <span>💰 {credits} {t('menu.credits')}</span>
            <span>🏆 {battlesWon}W / {battlesLost}L</span>
            {walletConnection && <span className="text-neon-green">🔗</span>}
          </div>

          {/* Main actions - 2 columns */}
          <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
            <button onClick={() => setScreen('pvp')} disabled={deck.length !== 4}
              className={`py-3 rounded-xl font-bold text-sm flex flex-col items-center gap-0.5 transition-all ${deck.length === 4 ? 'bg-gradient-to-br from-red-600 to-orange-500 text-white shadow-lg active:scale-95' : 'bg-white/5 text-white/20'}`}>
              <span className="text-lg">🌐</span>
              <span>{t('menu.pvp')}</span>
            </button>
            <button onClick={() => setScreen('battle')} disabled={deck.length !== 4}
              className={`py-3 rounded-xl font-bold text-sm flex flex-col items-center gap-0.5 transition-all ${deck.length === 4 ? 'bg-gradient-to-br from-neon-red to-orange-500 text-white shadow-lg active:scale-95' : 'bg-white/5 text-white/20'}`}>
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

          {deck.length !== 4 && (
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
