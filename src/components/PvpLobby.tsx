import { useState, useEffect } from 'react';
import type { Card } from '../types';
import {
  createGame,
  joinGame,
  getWaitingGames,
  getMyGames,
  getGame,
  abandonGame,
  type Game,
} from '../services/pvpService';

interface Props {
  playerId: string;
  deck: Card[];
  onStartBattle: (game: Game, isHost: boolean) => void;
  onBack: () => void;
}

export default function PvpLobby({ playerId, deck, onStartBattle, onBack }: Props) {
  const [tab, setTab] = useState<'create' | 'join' | 'active'>('join');
  const [waitingGames, setWaitingGames] = useState<Game[]>([]);
  const [myGames, setMyGames] = useState<Game[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadGames = async () => {
    try {
      setLoading(true);
      const [waiting, active] = await Promise.all([
        getWaitingGames(),
        getMyGames(playerId),
      ]);
      setWaitingGames(waiting.filter((g) => g.host_id !== playerId));
      setMyGames(active);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGames();
    const interval = setInterval(loadGames, 10000);
    return () => clearInterval(interval);
  }, [playerId]);

  const handleCreate = async () => {
    if (deck.length !== 4) return;
    try {
      setIsCreating(true);
      setError(null);
      const game = await createGame(playerId, deck);
      if (game) {
        setJoinCode(game.id);
        setTab('join');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinById = async () => {
    if (!joinCode.trim()) return;
    try {
      setIsJoining(true);
      setError(null);
      const game = await getGame(joinCode.trim());
      if (!game) {
        setError('Игра не найдена');
        return;
      }
      if (game.host_id === playerId) {
        setError('Нельзя присоединиться к своей игре');
        return;
      }
      if (game.status !== 'waiting') {
        setError('Игра уже начата');
        return;
      }
      const updated = await joinGame(joinCode.trim(), playerId, deck);
      if (updated) {
        onStartBattle(updated, false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoinGame = async (game: Game) => {
    try {
      setIsJoining(true);
      setError(null);
      const updated = await joinGame(game.id, playerId, deck);
      if (updated) {
        onStartBattle(updated, false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsJoining(false);
    }
  };

  const handleContinueGame = async (game: Game) => {
    const full = await getGame(game.id);
    if (full) onStartBattle(full, full.host_id === playerId);
  };

  const handleAbandon = async (game: Game) => {
    try {
      await abandonGame(game.id);
      loadGames();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-dark-border shrink-0">
        {(['join', 'create', 'active'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
              tab === t ? 'text-neon-blue border-b-2 border-neon-blue' : 'text-white/40'
            }`}
          >
            {t === 'join' && '🔍 Найти'}
            {t === 'create' && '➕ Создать'}
            {t === 'active' && `⚔️ Мои (${myGames.length})`}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mt-2 px-3 py-2 rounded-lg text-xs bg-neon-red/10 text-neon-red border border-neon-red/30">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {/* Join tab */}
        {tab === 'join' && (
          <div className="flex flex-col gap-3">
            {/* Join by code */}
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Код игры или ID"
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-neon-blue"
              />
              <button
                onClick={handleJoinById}
                disabled={!joinCode.trim() || isJoining}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-neon-blue text-white disabled:opacity-50 active:scale-95 transition-all"
              >
                {isJoining ? '...' : 'Войти'}
              </button>
            </div>

            {/* Waiting games */}
            <div className="text-xs text-white/40 font-bold uppercase">Доступные игры</div>
            {loading && <div className="text-xs text-white/30 text-center py-4">Загрузка...</div>}
            {!loading && waitingGames.length === 0 && (
              <div className="text-xs text-white/30 text-center py-4">Нет доступных игр</div>
            )}
            {waitingGames.map((game) => (
              <div
                key={game.id}
                className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"
              >
                <div>
                  <div className="text-sm font-bold text-white">{game.host_id}</div>
                  <div className="text-[10px] text-white/30">{game.host_deck.length}/4 карт</div>
                </div>
                <button
                  onClick={() => handleJoinGame(game)}
                  disabled={isJoining}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-neon-green text-white active:scale-95 transition-all disabled:opacity-50"
                >
                  Присоединиться
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Create tab */}
        {tab === 'create' && (
          <div className="flex flex-col items-center gap-4 py-6">
            {deck.length !== 4 ? (
              <div className="text-sm text-white/50 text-center">
                Сначала соберите колоду из 4 карт
              </div>
            ) : (
              <>
                <div className="text-sm text-white/50 text-center">
                  Создайте игру и поделитесь кодом с другом
                </div>
                <button
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="w-full max-w-xs py-3 rounded-xl font-bold text-sm
                    bg-gradient-to-r from-neon-purple to-neon-blue text-white
                    active:scale-95 transition-all disabled:opacity-50"
                >
                  {isCreating ? 'Создание...' : '🎮 Создать игру'}
                </button>
                {joinCode && (
                  <div className="w-full max-w-xs p-3 rounded-xl bg-white/5 border border-neon-green/30">
                    <div className="text-[10px] text-white/40 mb-1">Код игры (отправь другу):</div>
                    <div className="text-sm font-mono font-bold text-neon-green text-center break-all">
                      {joinCode}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Active games tab */}
        {tab === 'active' && (
          <div className="flex flex-col gap-2">
            {loading && <div className="text-xs text-white/30 text-center py-4">Загрузка...</div>}
            {!loading && myGames.length === 0 && (
              <div className="text-xs text-white/30 text-center py-4">Нет активных игр</div>
            )}
            {myGames.map((game) => {
              const isHost = game.host_id === playerId;
              const opponent = isHost ? game.guest_id : game.host_id;
              return (
                <div key={game.id} className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/5">
                  <button
                    onClick={() => handleContinueGame(game)}
                    className="flex-1 text-left"
                  >
                    <div className="text-sm font-bold text-white">
                      {isHost ? '🏠 Хост' : '👤 Гость'} vs {opponent || 'Ожидание...'}
                    </div>
                    <div className="text-[10px] text-white/30">
                      {game.status === 'waiting' ? 'Ожидание соперника' : `Раунд ${game.state?.round || 0}/4`}
                    </div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAbandon(game); }}
                    className="text-[10px] px-2 py-1 rounded border border-neon-red/30 text-neon-red/70 active:bg-neon-red/20 transition-all"
                  >
                    Выйти
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Back button */}
      <div className="shrink-0 px-3 pb-3">
        <button
          onClick={onBack}
          className="w-full py-2.5 rounded-lg font-bold text-sm
            bg-white/5 border border-white/10 text-white/60
            active:bg-white/10 active:scale-[0.98]
            transition-all duration-150"
        >
          Назад
        </button>
      </div>
    </div>
  );
}
