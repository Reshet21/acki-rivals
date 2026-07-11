import { useState, useEffect, useCallback, useRef } from 'react';
import type { Card } from '../types';
import { resolveRound } from '../utils/battleLogic';
import CardComponent from './CardComponent';
import { useI18n } from '../i18n';
import CardSelector from './CardSelector';
import { useHaptic } from '../hooks/useHaptic';
import {
  submitMove,
  getRoundMoves,
  updateGameState,
  subscribeToGame,
  abandonGame,
  type Game,
  type GameState,
  type Move,
} from '../services/pvpService';

interface Props {
  game: Game;
  playerId: string;
  isHost: boolean;
  onBattleEnd: (result: 'win' | 'loss' | 'draw') => void;
  onSurrender: () => void;
}

const TOTAL_HP = 12;
const TOTAL_ROUNDS = 4;
const TURN_TIME = 30;
const STARTING_PILLZ = 12;
const FREE_PILLZ_PER_ROUND = 1;
const VS_DURATION = 2500;
const DAMAGE_DURATION = 2000;

type BattlePhase = 'waiting' | 'select' | 'submitting' | 'waiting_opponent' | 'vs' | 'damage' | 'ended';

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PvpBattleScreen({ game, playerId, isHost, onBattleEnd, onSurrender }: Props) {
  const { t } = useI18n();
  const { impactOccurred } = useHaptic();

  const rawMyDeck: Card[] = isHost ? (game.host_deck || []) : (game.guest_deck || []);
  const rawOppDeck: Card[] = isHost ? (game.guest_deck || []) : (game.host_deck || []);

  // Ensure all cards have UIDs (Supabase may not preserve them)
  const ensureUids = (deck: Card[]) => deck.map((c, i) => c.uid ? c : { ...c, uid: `pvp-${c.id}-${i}-${Date.now()}` });
  const myDeck = ensureUids(rawMyDeck);
  const oppDeck = ensureUids(rawOppDeck);

  // Deal 4 random cards from 8-card deck
  const [myHand] = useState<Card[]>(() => shuffleArray(myDeck).slice(0, TOTAL_ROUNDS));
  const [oppHand] = useState<Card[]>(() => shuffleArray(oppDeck).slice(0, TOTAL_ROUNDS));

  const [playerHP, setPlayerHP] = useState(TOTAL_HP);
  const [opponentHP, setOpponentHP] = useState(TOTAL_HP);
  const [playerPillz, setPlayerPillz] = useState(STARTING_PILLZ);
  const [opponentPillz, setOpponentPillz] = useState(STARTING_PILLZ);
  const [round, setRound] = useState(1);

  const [playerCardsUsed, setPlayerCardsUsed] = useState<string[]>([]);
  const [opponentCardsUsed, setOpponentCardsUsed] = useState<string[]>([]);

  const [battlePhase, setBattlePhase] = useState<BattlePhase>('waiting');
  const [timer, setTimer] = useState(TURN_TIME);

  const [currentPlayerCard, setCurrentPlayerCard] = useState<Card | null>(null);
  const [currentPlayerPillz, setCurrentPlayerPillz] = useState(0);
  const [currentOpponentCard, setCurrentOpponentCard] = useState<Card | null>(null);
  const [currentOpponentPillz, setCurrentOpponentPillz] = useState(0);
  const [currentResult, setCurrentResult] = useState<{
    winner: 'player' | 'opponent' | 'draw';
    damageDealt: number;
    playerAttack: number;
    opponentAttack: number;
    healAmount: number;
    poisonAmount: number;
    lifeStealAmount: number;
  } | null>(null);

  const [battleResult, setBattleResult] = useState<'win' | 'loss' | 'draw'>('draw');
  const [roundLog, setRoundLog] = useState<any[]>([]);
  const [, setOpponentDisconnected] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const damageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerHPRef = useRef(TOTAL_HP);
  const opponentHPRef = useRef(TOTAL_HP);
  const roundRef = useRef(1);
  const battlePhaseRef = useRef<BattlePhase>('waiting');
  const playerPillzRef = useRef(12);
  const opponentPillzRef = useRef(12);
  const playerCardsUsedRef = useRef<string[]>([]);
  const opponentCardsUsedRef = useRef<string[]>([]);

  playerHPRef.current = playerHP;
  opponentHPRef.current = opponentHP;
  roundRef.current = round;
  battlePhaseRef.current = battlePhase;
  playerPillzRef.current = playerPillz;
  opponentPillzRef.current = opponentPillz;
  playerCardsUsedRef.current = playerCardsUsed;
  opponentCardsUsedRef.current = opponentCardsUsed;

  const playerCardsRemaining = myHand.filter((c) => c.uid && !playerCardsUsed.includes(c.uid));
  const opponentCardsRemaining = oppHand.filter((c) => c.uid && !opponentCardsUsed.includes(c.uid));

  const findCardByUid = useCallback((deck: Card[], uid: string): Card | undefined => {
    return deck.find((c) => c.uid === uid);
  }, []);

  const findCardById = useCallback((deck: Card[], id: number, excludeUids: string[]): Card | undefined => {
    return deck.find((c) => c.id === id && c.uid && !excludeUids.includes(c.uid));
  }, []);

  const resolveAndAnimate = useCallback((myMove: Move, oppMove: Move) => {
    const myCard = findCardById(myDeck, myMove.card_id, playerCardsUsedRef.current);
    const oppCard = findCardById(oppDeck, oppMove.card_id, opponentCardsUsedRef.current);

    if (!myCard || !oppCard) return;

    setCurrentPlayerCard(myCard);
    setCurrentPlayerPillz(myMove.pillz);
    setCurrentOpponentCard(oppCard);
    setCurrentOpponentPillz(oppMove.pillz);

    const result = resolveRound(myCard, myMove.pillz, oppCard, oppMove.pillz, myDeck, oppDeck);

    const mappedResult = {
      winner: result.winner === 'player' ? ('player' as const) : result.winner === 'ai' ? ('opponent' as const) : ('draw' as const),
      damageDealt: result.damageDealt,
      playerAttack: result.playerAttack,
      opponentAttack: result.aiAttack,
      healAmount: result.healAmount,
      poisonAmount: result.poisonAmount,
      lifeStealAmount: result.lifeStealAmount,
    };
    setCurrentResult(mappedResult);

    setPlayerPillz((p) => Math.max(0, p - myMove.pillz));
    setOpponentPillz((p) => Math.max(0, p - oppMove.pillz));

    if (myCard.uid) setPlayerCardsUsed((prev) => [...prev, myCard.uid!]);
    if (oppCard.uid) setOpponentCardsUsed((prev) => [...prev, oppCard.uid!]);

    setRoundLog((prev) => [...prev, {
      round: roundRef.current,
      playerCard: myCard,
      playerPillz: myMove.pillz,
      aiCard: oppCard,
      aiPillz: oppMove.pillz,
      winner: mappedResult.winner === 'player' ? 'player' : mappedResult.winner === 'opponent' ? 'ai' : 'draw',
      damageDealt: result.damageDealt,
      playerAttack: result.playerAttack,
      aiAttack: result.aiAttack,
      playerBasePower: result.playerBasePower,
      playerFinalPower: result.playerFinalPower,
      aiBasePower: result.aiBasePower,
      aiFinalPower: result.aiFinalPower,
      healAmount: result.healAmount,
      poisonAmount: result.poisonAmount,
      lifeStealAmount: result.lifeStealAmount,
      opponentDamageReduction: result.opponentDamageReduction,
    }]);

    setBattlePhase('vs');

    vsTimerRef.current = setTimeout(() => {
      setBattlePhase('damage');

      damageTimerRef.current = setTimeout(() => {
        let newMyHP = playerHPRef.current;
        let newOppHP = opponentHPRef.current;

        if (mappedResult.winner === 'player') {
          newOppHP = Math.max(0, newOppHP - mappedResult.damageDealt);
        } else if (mappedResult.winner === 'opponent') {
          newMyHP = Math.max(0, newMyHP - mappedResult.damageDealt);
        }

        if (mappedResult.winner === 'opponent') {
          newMyHP = Math.min(TOTAL_HP, newMyHP + mappedResult.healAmount);
        } else if (mappedResult.winner === 'player') {
          newOppHP = Math.min(TOTAL_HP, newOppHP + mappedResult.healAmount);
        }

        if (mappedResult.winner === 'player') {
          newMyHP = Math.min(TOTAL_HP, newMyHP + mappedResult.lifeStealAmount);
        } else if (mappedResult.winner === 'opponent') {
          newOppHP = Math.min(TOTAL_HP, newOppHP + mappedResult.lifeStealAmount);
        }

        if (mappedResult.winner === 'player') {
          newOppHP = Math.max(0, newOppHP - mappedResult.poisonAmount);
        } else if (mappedResult.winner === 'opponent') {
          newMyHP = Math.max(0, newMyHP - mappedResult.poisonAmount);
        }

        setPlayerHP(newMyHP);
        setOpponentHP(newOppHP);

        // KO check
        if (newMyHP <= 0 || newOppHP <= 0) {
          let r: 'win' | 'loss' | 'draw' = 'draw';
          if (newMyHP > newOppHP) r = 'win';
          else if (newOppHP > newMyHP) r = 'loss';
          else if (newMyHP <= 0 && newOppHP <= 0) r = 'draw';
          else if (newOppHP <= 0) r = 'win';
          else r = 'loss';
          setBattleResult(r);
          setBattlePhase('ended');
          const koState: GameState = { phase: 'ended', round: roundRef.current, hostHP: isHost ? newMyHP : newOppHP, guestHP: isHost ? newOppHP : newMyHP, hostPillz: isHost ? playerPillzRef.current : opponentPillzRef.current, guestPillz: isHost ? opponentPillzRef.current : playerPillzRef.current };
          updateGameState(game.id, koState).catch(console.error);
          abandonGame(game.id).catch(console.error);
          return;
        }

        const nextRound = roundRef.current + 1;

        const newState: GameState = {
          phase: nextRound > TOTAL_ROUNDS ? 'ended' : 'select',
          round: nextRound,
          hostHP: isHost ? newMyHP : newOppHP,
          guestHP: isHost ? newOppHP : newMyHP,
          hostPillz: isHost ? playerPillzRef.current : opponentPillzRef.current,
          guestPillz: isHost ? opponentPillzRef.current : playerPillzRef.current,
        };

        updateGameState(game.id, newState).catch(console.error);

        if (nextRound > TOTAL_ROUNDS) {
          let r: 'win' | 'loss' | 'draw' = 'draw';
          if (newMyHP > newOppHP) r = 'win';
          else if (newOppHP > newMyHP) r = 'loss';
          setBattleResult(r);
          setBattlePhase('ended');
          abandonGame(game.id).catch(console.error);
        } else {
          setRound(nextRound);
          setPlayerPillz((p) => Math.min(STARTING_PILLZ, p + FREE_PILLZ_PER_ROUND));
          setOpponentPillz((p) => Math.min(STARTING_PILLZ, p + FREE_PILLZ_PER_ROUND));
          setCurrentPlayerCard(null);
          setCurrentOpponentCard(null);
          setCurrentResult(null);
          setBattlePhase('select');
        }
      }, DAMAGE_DURATION);
    }, VS_DURATION);
  }, [game.id, isHost, myDeck, oppDeck, findCardByUid, findCardById]);

  useEffect(() => {
    const cleanup = subscribeToGame(
      game.id,
      (move: Move) => {
        if (move.player_id === playerId) return;

        const currentRound = roundRef.current;
        if (move.round !== currentRound) return;
        if (battlePhaseRef.current !== 'waiting_opponent') return;

        const myMoveKey = `move_${currentRound}_${playerId}`;
        const storedMove = sessionStorage.getItem(myMoveKey);

        if (storedMove) {
          const myMove = JSON.parse(storedMove);
          sessionStorage.removeItem(myMoveKey);
          resolveAndAnimate(myMove, move);
        }
      },
      (updatedGame: Game) => {
        if (updatedGame.status === 'finished') {
          const state = updatedGame.state;
          if (state?.phase === 'ended') {
            const myHP = isHost ? state.hostHP : state.guestHP;
            const oppHP = isHost ? state.guestHP : state.hostHP;
            let r: 'win' | 'loss' | 'draw' = 'draw';
            if (myHP > oppHP) r = 'win';
            else if (oppHP > myHP) r = 'loss';
            setBattleResult(r);
            setBattlePhase('ended');
            abandonGame(game.id).catch(console.error);
          }
        }
        if (!updatedGame.guest_id && !isHost) {
          setOpponentDisconnected(true);
        }
      },
    );

    return cleanup;
  }, [game.id, playerId, isHost, resolveAndAnimate]);

  useEffect(() => {
    const fetchOpponentMoves = async () => {
      if (battlePhase !== 'waiting_opponent') return;
      try {
        const moves = await getRoundMoves(game.id, roundRef.current);
        const oppMove = moves.find((m) => m.player_id !== playerId);
        if (!oppMove) return;

        const myMoveKey = `move_${roundRef.current}_${playerId}`;
        const storedMove = sessionStorage.getItem(myMoveKey);
        if (storedMove) {
          const myMove = JSON.parse(storedMove);
          sessionStorage.removeItem(myMoveKey);
          resolveAndAnimate(myMove, oppMove);
        }
      } catch (e) {
        console.error('Failed to fetch opponent moves:', e);
      }
    };

    const pollInterval = setInterval(fetchOpponentMoves, 2000);
    return () => clearInterval(pollInterval);
  }, [battlePhase, game.id, playerId, resolveAndAnimate]);

  useEffect(() => {
    if (battlePhase === 'select') {
      setTimer(TURN_TIME);
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [battlePhase, round]);

  const handleSelect = useCallback(async (card: Card, pillz: number) => {
    if (battlePhase !== 'select') return;
    if (timerRef.current) clearInterval(timerRef.current);

    setBattlePhase('submitting');

    try {
      await submitMove(game.id, playerId, round, card.id, pillz);

      const myMoveData = { card_id: card.id, pillz, round, player_id: playerId };
      const myMoveKey = `move_${round}_${playerId}`;
      sessionStorage.setItem(myMoveKey, JSON.stringify(myMoveData));

      setBattlePhase('waiting_opponent');

      // Check immediately if opponent already played
      const moves = await getRoundMoves(game.id, round);
      const oppMove = moves.find((m) => m.player_id !== playerId);

      if (oppMove) {
        sessionStorage.removeItem(myMoveKey);
        resolveAndAnimate({ ...myMoveData, game_id: game.id, id: '' } as Move, oppMove);
      }
      // Otherwise the polling/subscription will pick it up
    } catch (e) {
      console.error('Failed to submit move:', e);
      setBattlePhase('select');
    }
  }, [battlePhase, game.id, playerId, round, resolveAndAnimate]);

  const handleAutoSelect = useCallback(() => {
    const firstCard = playerCardsRemaining[0];
    if (firstCard) {
      handleSelect(firstCard, 0);
    }
  }, [playerCardsRemaining, handleSelect]);

  useEffect(() => {
    if (timer === 0 && battlePhase === 'select') {
      handleAutoSelect();
    }
  }, [timer, battlePhase, handleAutoSelect]);

  useEffect(() => {
    if (!game.guest_id && isHost && battlePhase === 'waiting') {
      setBattlePhase('waiting');
    }
    if (game.guest_id && battlePhase === 'waiting') {
      setBattlePhase('select');
    }
  }, [game.guest_id, isHost, battlePhase]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (vsTimerRef.current) clearTimeout(vsTimerRef.current);
      if (damageTimerRef.current) clearTimeout(damageTimerRef.current);
    };
  }, []);

  const handleSurrender = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (vsTimerRef.current) clearTimeout(vsTimerRef.current);
    if (damageTimerRef.current) clearTimeout(damageTimerRef.current);

    const newState: GameState = {
      phase: 'ended',
      round,
      hostHP: isHost ? 0 : playerHP,
      guestHP: isHost ? playerHP : 0,
      hostPillz: isHost ? 0 : playerPillz,
      guestPillz: isHost ? playerPillz : 0,
    };
    updateGameState(game.id, newState).catch(console.error);
    abandonGame(game.id).catch(console.error);

    setBattleResult('loss');
    setBattlePhase('ended');
    onSurrender();
  };

  const timerColor =
    timer > 15 ? 'text-neon-green' :
    timer > 5 ? 'text-yellow-400' :
    'text-neon-red';

  const opponentName = isHost ? (game.guest_id || 'Ожидание...') : game.host_id;

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto overflow-hidden bg-battle relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-1 h-1 bg-neon-blue/20 rounded-full animate-drift" style={{ top: '10%', left: '20%' }} />
        <div className="absolute w-1.5 h-1.5 bg-neon-purple/15 rounded-full animate-drift" style={{ top: '30%', right: '15%', animationDelay: '2s' }} />
        <div className="absolute w-1 h-1 bg-neon-pink/10 rounded-full animate-drift" style={{ top: '60%', left: '10%', animationDelay: '4s' }} />
        <div className="absolute w-1.5 h-1.5 bg-neon-green/10 rounded-full animate-drift" style={{ top: '80%', right: '25%', animationDelay: '6s' }} />
      </div>

      <div className="flex justify-between items-center px-3 py-2 bg-dark-card/80 border-b border-dark-border shrink-0">
        <span className="text-xs text-white/60">Р {round}/{TOTAL_ROUNDS}</span>
        <span className="text-[10px] text-neon-red/70">{opponentName}: {opponentPillz} п</span>

        <button onClick={() => { impactOccurred('heavy'); handleSurrender(); }}
          className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-white/40 active:text-white/70 active:bg-white/10 transition-all">
          {t('battle.surrender')}
        </button>

        {battlePhase === 'select' && (
          <div className={`text-xl font-bold tabular-nums ${timerColor}`}>{timer}s</div>
        )}
        {battlePhase === 'waiting_opponent' && (
          <div className="text-[10px] text-yellow-400 animate-pulse">Ожидание соперника...</div>
        )}
        {battlePhase === 'submitting' && (
          <div className="text-[10px] text-neon-blue animate-pulse">Отправка...</div>
        )}
        {battlePhase !== 'select' && battlePhase !== 'waiting_opponent' && battlePhase !== 'submitting' && (
          <span className="text-xl font-bold tabular-nums text-white/20">—</span>
        )}

        <span className="text-xs text-white/60">П: {playerPillz}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 py-1.5 shrink-0">
        <div className="flex flex-col gap-0.5">
          <div className="text-[9px] text-neon-green font-bold">ВЫ</div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-neon-green to-emerald-400 rounded-full transition-all duration-700"
              style={{ width: `${(playerHP / TOTAL_HP) * 100}%` }} />
          </div>
          <div className="text-[10px] text-white font-bold text-right">{playerHP}</div>
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="text-[9px] text-neon-red font-bold text-right">ПРОТИВНИК</div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-neon-red to-orange-400 rounded-full transition-all duration-700"
              style={{ width: `${(opponentHP / TOTAL_HP) * 100}%` }} />
          </div>
          <div className="text-[10px] text-white font-bold">{opponentHP}</div>
        </div>
      </div>

      {battlePhase === 'select' && (
        <div className="flex justify-center gap-1 pb-1 shrink-0">
          {opponentCardsRemaining.map((c) => (
            <div key={c.uid}
              className="w-8 h-11 rounded bg-gradient-to-b from-gray-700 to-gray-900 border border-gray-600 flex items-center justify-center text-[8px] text-white/30">
              ???
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        {battlePhase === 'waiting' && !game.guest_id && (
          <div className="flex flex-col items-center gap-3 px-4 animate-fade-in">
            <div className="text-lg font-bold text-white/60">Ожидание соперника...</div>
            <div className="text-xs text-white/30">Код игры:</div>
            <div className="text-sm font-mono font-bold text-neon-green break-all text-center px-4 py-2 rounded-lg bg-white/5 border border-neon-green/30">
              {game.id}
            </div>
            <div className="text-[10px] text-white/30 text-center">Поделитесь кодом с другом</div>
          </div>
        )}

        {battlePhase === 'waiting' && game.guest_id && (
          <div className="text-sm text-white/50 animate-pulse">Начало боя...</div>
        )}

        {battlePhase === 'select' && (
          <CardSelector cards={playerCardsRemaining} onSelect={handleSelect} maxPillz={playerPillz} />
        )}

        {battlePhase === 'submitting' && (
          <div className="flex flex-col items-center gap-2">
            <div className="text-sm text-neon-blue animate-pulse">Отправка хода...</div>
          </div>
        )}

        {battlePhase === 'waiting_opponent' && (
          <div className="flex flex-col items-center gap-3 px-4">
            <div className="text-sm text-yellow-400 animate-pulse">Ожидание хода соперника...</div>
            {currentPlayerCard && (
              <div className="flex flex-col items-center">
                <div className="text-[9px] text-neon-green mb-0.5">Ваш ход</div>
                <CardComponent card={currentPlayerCard} compact />
                <div className="text-[10px] text-white/60 mt-0.5">П: {currentPlayerPillz}</div>
              </div>
            )}
          </div>
        )}

        {battlePhase === 'vs' && currentPlayerCard && currentOpponentCard && currentResult && (
          <div className="flex flex-col items-center gap-3 w-full animate-fade-in px-3">
            <div className="flex items-center gap-4 justify-center">
              <div className="flex flex-col items-center">
                <div className="text-[9px] text-neon-green mb-0.5">Вы</div>
                <CardComponent card={currentPlayerCard} compact />
                <div className="text-[10px] text-white/60 mt-0.5">П: {currentPlayerPillz}</div>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="text-3xl font-black text-white">
                  {currentResult.playerAttack} <span className="text-white/30">vs</span> {currentResult.opponentAttack}
                </div>
                <div className={`
                  text-lg font-black
                  ${currentResult.winner === 'player' ? 'text-neon-green' : ''}
                  ${currentResult.winner === 'opponent' ? 'text-neon-red' : ''}
                  ${currentResult.winner === 'draw' ? 'text-white/50' : ''}
                `}>
                  {currentResult.winner === 'player' && `⚔️ ${t('battle.victory')}`}
                  {currentResult.winner === 'opponent' && `⚔️ ${t('battle.defeat')}`}
                  {currentResult.winner === 'draw' && `⚔️ ${t('battle.draw')}`}
                </div>
                <div className="flex flex-wrap gap-1 justify-center">
                  {currentResult.damageDealt > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">-{currentResult.damageDealt} HP</span>
                  )}
                  {currentResult.healAmount > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-300">+{currentResult.healAmount} HP</span>
                  )}
                  {currentResult.lifeStealAmount > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">+{currentResult.lifeStealAmount} HP</span>
                  )}
                  {currentResult.poisonAmount > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300">☠️ {currentResult.poisonAmount}</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-center">
                <div className="text-[9px] text-neon-red mb-0.5">Противник</div>
                <CardComponent card={currentOpponentCard} compact />
                <div className="text-[10px] text-white/60 mt-0.5">П: {currentOpponentPillz}</div>
              </div>
            </div>
          </div>
        )}

        {battlePhase === 'damage' && currentResult && (
          <div className="flex flex-col items-center gap-2 w-full px-3">
            <div className={`
              text-4xl font-black animate-bounce
              ${currentResult.winner === 'player' ? 'text-neon-red' : ''}
              ${currentResult.winner === 'opponent' ? 'text-red-500' : ''}
              ${currentResult.winner === 'draw' ? 'text-white/30' : ''}
            `}>
              {currentResult.winner === 'draw' && '0'}
              {currentResult.winner === 'player' && `-${currentResult.damageDealt}`}
              {currentResult.winner === 'opponent' && `-${currentResult.damageDealt}`}
            </div>
            <div className={`
              text-sm font-bold
              ${currentResult.winner === 'player' ? 'text-neon-red' : ''}
              ${currentResult.winner === 'opponent' ? 'text-red-400' : ''}
              ${currentResult.winner === 'draw' ? 'text-white/30' : ''}
            `}>
              {currentResult.winner === 'player' && 'HP Противника'}
              {currentResult.winner === 'opponent' && 'HP Ваша'}
              {currentResult.winner === 'draw' && 'Ничья'}
            </div>
          </div>
        )}

        {battlePhase === 'ended' && (
          <div className="flex flex-col items-center gap-3 px-4 w-full overflow-y-auto max-h-full">
            <div className={`
              text-2xl font-black py-3 px-6 rounded-xl
              ${battleResult === 'win' ? 'text-neon-green bg-neon-green/10 border border-neon-green/30' : ''}
              ${battleResult === 'loss' ? 'text-neon-red bg-neon-red/10 border border-neon-red/30' : ''}
              ${battleResult === 'draw' ? 'text-white bg-white/5 border border-white/10' : ''}
            `}>
              {battleResult === 'win' && t('battle.victory') + '!'}
              {battleResult === 'loss' && t('battle.defeat')}
              {battleResult === 'draw' && t('battle.draw')}
            </div>

            <div className="text-xs text-white/50 text-center">
              {playerHP} HP vs {opponentHP} HP
            </div>

            <div className="flex flex-col gap-1.5 w-full max-w-xs">
              <div className="text-[8px] text-white/30 uppercase tracking-wider mb-0.5">📜 Лог боя</div>
              {roundLog.map((entry, i) => (
                <div key={i} className="bg-white/5 rounded-lg px-2 py-2 text-[10px]">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-white/40 font-bold">{t('battle.round')} {entry.round}</span>
                    <span className={`
                      font-bold text-[9px] px-1.5 py-0.5 rounded
                      ${entry.winner === 'player' ? 'text-neon-green bg-neon-green/10' : ''}
                      ${entry.winner === 'ai' ? 'text-neon-red bg-neon-red/10' : ''}
                      ${entry.winner === 'draw' ? 'text-white/40 bg-white/5' : ''}
                    `}>
                      {entry.winner === 'player' ? t('battle.victory') : entry.winner === 'ai' ? t('battle.defeat') : t('battle.draw')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-neon-green font-bold">{entry.playerCard.name}</span>
                      <span className="text-white/50">
                        {entry.playerBasePower}
                        {entry.playerFinalPower !== entry.playerBasePower && (
                          <span className="text-neon-blue">→{entry.playerFinalPower}</span>
                        )}
                      </span>
                    </div>
                    <span className="text-white/30">{entry.playerPillz} п</span>
                  </div>

                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-neon-red font-bold">{entry.aiCard.name}</span>
                      <span className="text-white/50">
                        {entry.aiBasePower}
                        {entry.aiFinalPower !== entry.aiBasePower && (
                          <span className="text-neon-blue">→{entry.aiFinalPower}</span>
                        )}
                      </span>
                    </div>
                    <span className="text-white/30">{entry.aiPillz} п</span>
                  </div>

                  <div className="border-t border-white/5 pt-1.5 mt-1 flex items-center justify-between">
                    <span className="text-white/40">Итого:</span>
                    <div className="flex items-center gap-2">
                      {entry.damageDealt > 0 && <span className="text-red-300 font-bold">💥{entry.damageDealt}</span>}
                      {entry.healAmount > 0 && <span className="text-green-300">💚+{entry.healAmount}</span>}
                      {entry.lifeStealAmount > 0 && <span className="text-purple-300">💜+{entry.lifeStealAmount}</span>}
                      {entry.poisonAmount > 0 && <span className="text-yellow-300">☠️{entry.poisonAmount}</span>}
                      {entry.damageDealt === 0 && entry.healAmount === 0 && entry.lifeStealAmount === 0 && entry.poisonAmount === 0 && (
                        <span className="text-white/20">—</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => { impactOccurred('soft'); onBattleEnd(battleResult); }}
              className="w-full max-w-xs py-2.5 rounded-lg font-bold text-base
                bg-gradient-to-r from-neon-purple to-neon-blue
                active:scale-95 transition-all duration-150
                shadow-[0_0_16px_rgba(183,66,255,0.3)] text-white"
            >
              {t('deck.back')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
