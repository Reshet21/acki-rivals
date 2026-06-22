import { useState, useEffect, useCallback } from 'react';
import { useGameState } from './hooks/useGameState';
import { openPack as openPackCards } from './utils/packGenerator';
import { getPackById } from './data/packs';
import type { Card } from './types';
import type { WalletConnection } from './services/beeEngine';
import { getStoredSession } from './services/beeEngine';
import BattleScreen from './components/BattleScreen';
import Shop from './components/Shop';
import WalletPanel from './components/WalletPanel';
import MiningPanel from './components/MiningPanel';
import DeckBuilder from './components/DeckBuilder';
import UpgradeScreen from './components/UpgradeScreen';
import PvpLobby from './components/PvpLobby';
import InfoScreen from './components/InfoScreen';

type Screen = 'menu' | 'battle' | 'shop' | 'wallet' | 'mining' | 'deck' | 'upgrade' | 'pvp' | 'info';

function App() {
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
    <div className="min-h-screen w-full overflow-x-hidden overflow-y-auto bg-dark-bg text-white flex flex-col">
      {screen === 'menu' && (
        <div className="flex flex-col items-center flex-1 gap-3 p-4 pt-10 overflow-y-auto">
          {/* Title */}
          <div className="text-center mb-2">
            <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-blue via-neon-purple to-neon-pink">
              ACKI RIVALS
            </div>
            <div className="text-[10px] text-white/30 mt-1">CARD BATTLE</div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center justify-center gap-3 text-[10px] text-white/40 mb-2">
            <span>💰 {credits}</span>
            <span>🏆 {battlesWon}W / {battlesLost}L</span>
            {walletConnection && <span className="text-neon-green">🔗</span>}
          </div>

          {/* Main actions - 2 columns */}
          <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
            <button onClick={() => setScreen('pvp')} disabled={deck.length !== 4}
              className={`py-3 rounded-xl font-bold text-sm flex flex-col items-center gap-0.5 transition-all ${deck.length === 4 ? 'bg-gradient-to-br from-red-600 to-orange-500 text-white shadow-lg active:scale-95' : 'bg-white/5 text-white/20'}`}>
              <span className="text-lg">🌐</span>
              <span>PvP</span>
            </button>
            <button onClick={() => setScreen('battle')} disabled={deck.length !== 4}
              className={`py-3 rounded-xl font-bold text-sm flex flex-col items-center gap-0.5 transition-all ${deck.length === 4 ? 'bg-gradient-to-br from-neon-red to-orange-500 text-white shadow-lg active:scale-95' : 'bg-white/5 text-white/20'}`}>
              <span className="text-lg">⚔️</span>
              <span>Бой ИИ</span>
            </button>
            <button onClick={() => setScreen('deck')}
              className="py-3 rounded-xl font-bold text-sm flex flex-col items-center gap-0.5 bg-gradient-to-br from-neon-purple to-neon-blue text-white shadow-lg active:scale-95 transition-all">
              <span className="text-lg">📚</span>
              <span>Колода</span>
            </button>
            <button onClick={() => setScreen('shop')}
              className="py-3 rounded-xl font-bold text-sm flex flex-col items-center gap-0.5 bg-gradient-to-br from-neon-pink to-purple-500 text-white shadow-lg active:scale-95 transition-all">
              <span className="text-lg">🛒</span>
              <span>Магазин</span>
            </button>
          </div>

          {deck.length !== 4 && (
            <div className="text-[10px] text-white/30">Соберите колоду из 4 карт</div>
          )}

          {/* Secondary actions - 3 columns */}
          <div className="grid grid-cols-3 gap-2 w-full max-w-xs mt-1">
            <button onClick={() => setScreen('upgrade')}
              className="py-2.5 rounded-lg font-bold text-[11px] flex flex-col items-center gap-0.5 bg-white/5 border border-white/10 text-white/60 active:scale-95 transition-all">
              <span>⚒️</span>
              <span>Улучшить</span>
            </button>
            <button onClick={() => setScreen('wallet')}
              className="py-2.5 rounded-lg font-bold text-[11px] flex flex-col items-center gap-0.5 bg-white/5 border border-white/10 text-white/60 active:scale-95 transition-all">
              <span>👛</span>
              <span>Кошелёк</span>
            </button>
            <button onClick={() => setScreen('mining')}
              className="py-2.5 rounded-lg font-bold text-[11px] flex flex-col items-center gap-0.5 bg-white/5 border border-white/10 text-white/60 active:scale-95 transition-all">
              <span>⛏️</span>
              <span>Майнинг</span>
            </button>
          </div>

          {/* Info + Reset row */}
          <div className="flex gap-2 w-full max-w-xs mt-1">
            <button onClick={() => setScreen('info')}
              className="flex-1 py-2 rounded-lg font-bold text-[10px] flex items-center justify-center gap-1 bg-white/5 border border-white/10 text-white/50 active:scale-95 transition-all">
              📖 Правила
            </button>
            <button onClick={() => { localStorage.clear(); location.reload(); }}
              className="flex-1 py-2 rounded-lg font-bold text-[10px] flex items-center justify-center gap-1 bg-white/5 border border-white/10 text-white/50 active:scale-95 transition-all">
              🔄 Сброс
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
            onStartBattle={(_game, _isHost) => {
              // TODO: start PvP battle with game state
              setScreen('battle');
            }}
            onBack={() => setScreen('menu')}
          />
        </div>
      )}

      {screen === 'info' && (
        <div className="flex-1">
          <InfoScreen onBack={() => setScreen('menu')} />
        </div>
      )}
    </div>
  );
}

export default App;
