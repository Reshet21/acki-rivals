import { useState, useEffect } from 'react';
import type { Card } from '../types';
import {
  createGame,
  joinGame,
  getWaitingGames,
  abandonGame,
  subscribeToGame,
  type Game,
} from '../services/pvpService';

interface Props {
  playerId: string;
  deck: Card[];
  onStartBattle: (game: Game, isHost: boolean) => void;
  onBack: () => void;
}

export default function PvpLobby({ playerId, deck, onStartBattle, onBack }: Props) {
  const [mode, setMode] = useState<'menu' | 'random' | 'room'>('menu');
  const [room, setRoom] = useState<Game | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Random matchmaking
  const [randomQueue, setRandomQueue] = useState(false);
  const [searchTimer, setSearchTimer] = useState(0);

  // Subscribe to room changes
  useEffect(() => {
    if (!room) return;
    const unsub = subscribeToGame(room.id, () => {}, (updated) => {
      setRoom(updated);
      if (updated.guest_id && updated.status === 'active') {
        const isHost = updated.host_id === playerId;
        onStartBattle(updated, isHost);
      }
    });
    return unsub;
  }, [room?.id, playerId, onStartBattle]);

  // Random search timer
  useEffect(() => {
    if (!randomQueue) return;
    const interval = setInterval(() => setSearchTimer((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, [randomQueue]);

  // Random matchmaking — check for waiting games every 3s
  useEffect(() => {
    if (!randomQueue) return;
    const check = async () => {
      try {
        const games = await getWaitingGames();
        const available = games.filter((g) => g.host_id !== playerId);
        if (available.length > 0) {
          // Join first available game
          const game = available[0];
          const updated = await joinGame(game.id, playerId, deck);
          if (updated) {
            setRandomQueue(false);
            onStartBattle(updated, false);
          }
        }
      } catch (e) {
        console.error('Random match error:', e);
      }
    };
    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, [randomQueue, playerId, deck, onStartBattle]);

  // Create room
  const handleCreate = async () => {
    if (deck.length !== 4) return;
    try {
      setWaiting(true);
      setError(null);
      const game = await createGame(playerId, deck);
      if (game) {
        setRoom(game);
        setMode('room');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWaiting(false);
    }
  };

  // Random battle
  const handleRandom = async () => {
    if (deck.length !== 4) return;
    setRandomQueue(true);
    setSearchTimer(0);
    setMode('random');
  };

  const cancelRandom = () => {
    setRandomQueue(false);
    setMode('menu');
    setSearchTimer(0);
  };

  // Copy room code
  const handleCopy = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Enter room
  const handleEnter = () => {
    if (!room) return;
    const isHost = room.host_id === playerId;
    onStartBattle(room, isHost);
  };

  // Abandon room
  const handleAbandon = async () => {
    if (!room) return;
    try {
      await abandonGame(room.id);
    } catch (e) {
      console.error(e);
    }
    setRoom(null);
    setMode('menu');
  };

  if (deck.length !== 4) {
    return (
      <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto items-center justify-center p-4">
        <div className="text-white/50 text-center">
          <div className="text-lg mb-2">⚠️</div>
          <div className="text-sm">Сначала соберите колоду из 4 карт</div>
        </div>
        <button onClick={onBack} className="mt-4 px-6 py-2 rounded-lg text-sm font-bold bg-white/5 border border-white/10 text-white/60 active:bg-white/10 transition-all">
          Назад
        </button>
      </div>
    );
  }

  // ═══ RANDOM MATCHMAKING ═══
  if (mode === 'random') {
    return (
      <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto items-center justify-center p-4 gap-6">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin" style={{ animationDuration: '3s' }}>⚔️</div>
          <div className="text-lg font-bold text-white mb-2">Подбор соперника...</div>
          <div className="text-sm text-white/40">{searchTimer}с</div>
        </div>
        <div className="flex flex-col gap-1.5 text-xs text-white/30 text-center">
          <div>Ищем игрока с такой же колодой</div>
          <div>Обычно занимает 5-15 секунд</div>
        </div>
        <button onClick={cancelRandom} className="px-6 py-2.5 rounded-lg text-sm font-bold bg-white/5 border border-white/10 text-white/60 active:bg-white/10 transition-all">
          Отмена
        </button>
      </div>
    );
  }

  // ═══ ROOM CREATED — show popup ═══
  if (mode === 'room' && room) {
    const hasGuest = !!room.guest_id;
    return (
      <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto items-center justify-center p-4 gap-4">
        {/* Room popup */}
        <div className="w-full max-w-xs bg-dark-card border border-dark-border rounded-2xl p-5 flex flex-col items-center gap-4">
          <div className="text-lg font-bold text-white">
            {hasGuest ? '🎮 Соперник найден!' : '⏳ Ожидание...'}
          </div>

          {/* Room code */}
          <div className="w-full">
            <div className="text-[10px] text-white/40 text-center mb-1">Код комнаты</div>
            <div className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-center font-mono text-sm text-neon-green break-all select-all">
              {room.id}
            </div>
          </div>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all ${
              copied
                ? 'bg-neon-green/20 text-neon-green border border-neon-green/30'
                : 'bg-white/5 border border-white/10 text-white/60 active:bg-white/10'
            }`}
          >
            {copied ? '✓ Скопировано' : '📋 Скопировать код'}
          </button>

          {/* Share */}
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: 'ACKI RIVALS', text: `Присоединяйся к бою! Код: ${room.id}`, url: window.location.href });
              }
            }}
            className="w-full py-2.5 rounded-lg text-sm font-bold bg-white/5 border border-white/10 text-white/60 active:bg-white/10 transition-all"
          >
            📤 Поделиться
          </button>

          {/* Enter button */}
          <button
            onClick={handleEnter}
            className="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-neon-blue to-neon-purple text-white active:scale-95 transition-all shadow-[0_0_12px_rgba(0,212,255,0.3)]"
          >
            {hasGuest ? '⚔️ Войти в бой' : '⏳ Войти в комнату'}
          </button>

          {/* Abandon */}
          <button onClick={handleAbandon} className="text-[10px] text-neon-red/50 active:text-neon-red transition-colors">
            Закрыть комнату
          </button>
        </div>

        {/* Back */}
        <button onClick={onBack} className="text-xs text-white/30 active:text-white/60 transition-colors">
          Назад
        </button>
      </div>
    );
  }

  // ═══ MAIN MENU ═══
  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto items-center justify-center p-4 gap-4">
      {/* Title */}
      <div className="text-center mb-2">
        <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-blue via-neon-purple to-neon-pink">
          PvP
        </div>
        <div className="text-[10px] text-white/30 mt-1">Сражайся с реальными игроками</div>
      </div>

      {error && (
        <div className="w-full max-w-xs px-3 py-2 rounded-lg text-xs bg-neon-red/10 text-neon-red border border-neon-red/30 text-center">
          {error}
        </div>
      )}

      {/* Buttons */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {/* Random battle */}
        <button
          onClick={handleRandom}
          disabled={waiting}
          className="py-4 rounded-xl font-bold text-sm flex flex-col items-center gap-1 bg-gradient-to-br from-neon-red to-orange-500 text-white shadow-lg active:scale-95 transition-all disabled:opacity-50"
        >
          <span className="text-2xl">🎲</span>
          <span>Случайный бой</span>
          <span className="text-[10px] text-white/60 font-normal">Найдём соперника автоматически</span>
        </button>

        {/* Create room */}
        <button
          onClick={handleCreate}
          disabled={waiting}
          className="py-4 rounded-xl font-bold text-sm flex flex-col items-center gap-1 bg-gradient-to-br from-neon-purple to-neon-blue text-white shadow-lg active:scale-95 transition-all disabled:opacity-50"
        >
          <span className="text-2xl">🏠</span>
          <span>Создать комнату</span>
          <span className="text-[10px] text-white/60 font-normal">Пригласи друга по коду</span>
        </button>
      </div>

      {/* Back */}
      <button onClick={onBack} className="text-xs text-white/30 active:text-white/60 transition-colors mt-2">
        Назад
      </button>
    </div>
  );
}
