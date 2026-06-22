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

type Screen = 'menu' | 'battle' | 'shop' | 'wallet' | 'mining' | 'deck' | 'upgrade' | 'pvp';

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
        <div className="flex flex-col items-center justify-center flex-1 gap-4 p-6">
          <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-blue via-neon-purple to-neon-pink mb-4">
            ACKI RIVALS
          </div>

          <div className="text-xs text-white/30 mb-4">
            💰 {credits} кредитов · 🏆 {battlesWon}W / {battlesLost}L
            {walletConnection && (
              <span className="ml-2 text-neon-green">· 🔗 {walletConnection.walletName}</span>
            )}
          </div>

          <button
            onClick={() => setScreen('pvp')}
            disabled={deck.length !== 4}
            className={`w-full max-w-xs py-4 rounded-xl font-bold text-lg
              transition-all duration-150
              ${deck.length === 4
                ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-[0_0_20px_rgba(255,0,0,0.3)] hover:opacity-90 active:scale-95'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
          >
            🌐 PvP Бой
          </button>

          <button
            onClick={() => setScreen('battle')}
            disabled={deck.length !== 4}
            className={`
              w-full max-w-xs py-4 rounded-xl font-bold text-lg
              transition-all duration-150
              ${deck.length === 4
                ? 'bg-gradient-to-r from-neon-red to-orange-500 text-white shadow-[0_0_20px_rgba(255,51,51,0.3)] hover:opacity-90 active:scale-95'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            ⚔️ Бой с ИИ
          </button>
          {deck.length !== 4 && (
            <div className="text-[10px] text-white/30 -mt-2">Сначала соберите колоду из 4 карт</div>
          )}

          <button
            onClick={() => setScreen('deck')}
            className="w-full max-w-xs py-4 rounded-xl font-bold text-lg
              bg-gradient-to-r from-neon-purple to-neon-blue text-white
              shadow-[0_0_20px_rgba(183,66,255,0.3)]
              hover:opacity-90 active:scale-95
              transition-all duration-150"
          >
            📚 Колода
          </button>

          <button
            onClick={() => setScreen('shop')}
            className="w-full max-w-xs py-4 rounded-xl font-bold text-lg
              bg-gradient-to-r from-neon-pink to-purple-500 text-white
              shadow-[0_0_20px_rgba(255,45,149,0.3)]
              hover:opacity-90 active:scale-95
              transition-all duration-150"
          >
            🛒 Магазин
          </button>

          <button
            onClick={() => setScreen('upgrade')}
            className="w-full max-w-xs py-4 rounded-xl font-bold text-lg
              bg-gradient-to-r from-yellow-400 to-orange-500 text-black
              shadow-[0_0_20px_rgba(255,165,0,0.3)]
              hover:opacity-90 active:scale-95
              transition-all duration-150"
          >
            ⚒️ Улучшить карты
          </button>

          <button
            onClick={() => setScreen('wallet')}
            className="w-full max-w-xs py-4 rounded-xl font-bold text-lg
              bg-gradient-to-r from-neon-blue to-cyan-500 text-white
              shadow-[0_0_20px_rgba(0,212,255,0.3)]
              hover:opacity-90 active:scale-95
              transition-all duration-150"
          >
            👛 Кошелек {walletConnection && '✅'}
          </button>

          <button
            onClick={() => setScreen('mining')}
            className="w-full max-w-xs py-4 rounded-xl font-bold text-lg
              bg-gradient-to-r from-neon-green to-emerald-500 text-white
              shadow-[0_0_20px_rgba(0,255,159,0.3)]
              hover:opacity-90 active:scale-95
              transition-all duration-150"
          >
            ⛏️ Майнинг
          </button>
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
    </div>
  );
}

export default App;
