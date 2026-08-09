import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Card, RoundResult } from '../types';
import { resolvePvpRound, roundResultForView, applyRoundDamage, winnerFromHP } from '../services/pvpResolution';
import CardComponent from './CardComponent';
import { useI18n } from '../i18n';
import CardSelector from './CardSelector';
import { useHaptic } from '../hooks/useHaptic';
import { playCardSwoosh, playVS, playHit, playVictory, playDefeat, playDraw, playHeal, playPoison, playLifeSteal } from '../utils/soundEffects';
import {
  submitMove,
  getRoundMoves,
  getGame,
  updateGameState,
  subscribeToGame,
  abandonGame,
  settlePvpStake,
  type Game,
  type GameState,
  type Move,
} from '../services/pvpService';
import Icon from './Icon';

interface Props {
  game: Game;
  playerId: string;
  playerName?: string;
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

export default function PvpBattleScreen({ game, playerId, playerName, isHost, onBattleEnd, onSurrender }: Props) {
  const { t } = useI18n();
  const { impactOccurred } = useHaptic();

  const rawMyDeck: Card[] = isHost ? (game.host_deck || []) : (game.guest_deck || []);
  const rawOppDeck: Card[] = isHost ? (game.guest_deck || []) : (game.host_deck || []);

  // Ensure all cards have UIDs (Supabase may not preserve them). Use deterministic
  // UIDs so lookups stay stable across renders and re-joins.
  const ensureUids = (deck: Card[]) => deck.map((c, i) => c.uid ? c : { ...c, uid: `pvp-${c.id}-${i}` });
  const myDeck = useMemo(() => ensureUids(rawMyDeck), [rawMyDeck]);
  const oppDeck = useMemo(() => ensureUids(rawOppDeck), [rawOppDeck]);

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
  const [opponentMoveTimer, setOpponentMoveTimer] = useState(0);
  const [damageFlash, setDamageFlash] = useState<'none' | 'player' | 'opponent'>('none');
  const [screenShake, setScreenShake] = useState(false);

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
  const animatedRoundsRef = useRef<Set<number>>(new Set());
  const lastRoundResultRef = useRef<GameState['roundResult'] | null>(null);

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

  const findCardById = useCallback((deck: Card[], id: number, excludeUids: string[]): Card | undefined => {
    return deck.find((c) => c.id === id && c.uid && !excludeUids.includes(c.uid));
  }, []);

  const runRoundAnimation = useCallback((myCard: Card, myPillz: number, oppCard: Card, oppPillz: number, result: RoundResult) => {
    if (animatedRoundsRef.current.has(roundRef.current)) return;
    animatedRoundsRef.current.add(roundRef.current);
    setCurrentPlayerCard(myCard);
    setCurrentPlayerPillz(myPillz);
    setCurrentOpponentCard(oppCard);
    setCurrentOpponentPillz(oppPillz);

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

    setPlayerPillz((p) => Math.max(0, p - myPillz));
    setOpponentPillz((p) => Math.max(0, p - oppPillz));

    if (myCard.uid) setPlayerCardsUsed((prev) => [...prev, myCard.uid!]);
    if (oppCard.uid) setOpponentCardsUsed((prev) => [...prev, oppCard.uid!]);

    setRoundLog((prev) => [...prev, {
      round: roundRef.current,
      playerCard: myCard,
      playerPillz: myPillz,
      aiCard: oppCard,
      aiPillz: oppPillz,
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

    playVS();
    setBattlePhase('vs');

    vsTimerRef.current = setTimeout(() => {
      setBattlePhase('damage');

      damageTimerRef.current = setTimeout(() => {
        // Pure HP resolution via pvpResolution.ts
        const outcome = applyRoundDamage(playerHPRef.current, opponentHPRef.current, result, TOTAL_HP);
        const newMyHP = outcome.myHP;
        const newOppHP = outcome.oppHP;

        // ─── Visual effects: screen shake + damage flash ───
        if (mappedResult.winner === 'player' && mappedResult.damageDealt > 0) {
          playHit();
          setDamageFlash('opponent');
          setScreenShake(true);
          setTimeout(() => setScreenShake(false), 500);
        } else if (mappedResult.winner === 'opponent' && mappedResult.damageDealt > 0) {
          playHit();
          setDamageFlash('player');
          setScreenShake(true);
          setTimeout(() => setScreenShake(false), 500);
        }
        setTimeout(() => setDamageFlash('none'), 800);
        if (mappedResult.healAmount > 0) playHeal();
        if (mappedResult.lifeStealAmount > 0) playLifeSteal();
        if (mappedResult.poisonAmount > 0) playPoison();

        setPlayerHP(newMyHP);
        setOpponentHP(newOppHP);

        // KO check
        if (outcome.ended) {
          const r = winnerFromHP(newMyHP, newOppHP);
          if (r === 'win') playVictory();
          else if (r === 'loss') playDefeat();
          else playDraw();
          setBattleResult(r);
          setBattlePhase('ended');
          const koState: GameState = { phase: 'ended', round: roundRef.current, hostHP: isHost ? newMyHP : newOppHP, guestHP: isHost ? newOppHP : newMyHP, hostPillz: isHost ? playerPillzRef.current : opponentPillzRef.current, guestPillz: isHost ? opponentPillzRef.current : playerPillzRef.current, lastResolvedRound: roundRef.current, roundResult: lastRoundResultRef.current ?? undefined };
          if (isHost) {
            updateGameState(game.id, koState).catch(console.error);
            abandonGame(game.id).catch(console.error);
          }
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
          lastResolvedRound: roundRef.current,
          roundResult: lastRoundResultRef.current ?? undefined,
        };

        if (isHost) {
          updateGameState(game.id, newState).catch(console.error);
        }

        if (nextRound > TOTAL_ROUNDS) {
          const r = winnerFromHP(newMyHP, newOppHP);
          if (r === 'win') playVictory();
          else if (r === 'loss') playDefeat();
          else playDraw();
          setBattleResult(r);
          setBattlePhase('ended');
          if (isHost) abandonGame(game.id).catch(console.error);
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
  }, [game.id, isHost]);

  // ─── Helper: animate round from GameState.roundResult (for guest or after host resolves) ───
  const animateFromRoundResult = useCallback((rr: NonNullable<GameState['roundResult']>) => {
    if (animatedRoundsRef.current.has(roundRef.current)) return;

    const isPlayerGuest = !isHost;
    const myCard = findCardById(myDeck, isPlayerGuest ? rr.guestCardId : rr.hostCardId, playerCardsUsedRef.current);
    const oppCard = findCardById(oppDeck, isPlayerGuest ? rr.hostCardId : rr.guestCardId, opponentCardsUsedRef.current);
    if (!myCard || !oppCard) return;

    const myPillz = isPlayerGuest ? rr.guestPillzUsed : rr.hostPillzUsed;
    const oppPillz = isPlayerGuest ? rr.hostPillzUsed : rr.guestPillzUsed;
    const view = roundResultForView(rr, isPlayerGuest ? 'guest' : 'host');
    runRoundAnimation(myCard, myPillz, oppCard, oppPillz, view);
  }, [isHost, myDeck, oppDeck, findCardById, runRoundAnimation]);

  // ─── Host: resolve round authoritatively and write to game state ───
  const resolveAndAnimate = useCallback((myMove: Move, oppMove: Move) => {
    if (!isHost) return;
    if (animatedRoundsRef.current.has(roundRef.current)) return;

    const myCard = findCardById(myDeck, myMove.card_id, playerCardsUsedRef.current);
    const oppCard = findCardById(oppDeck, oppMove.card_id, opponentCardsUsedRef.current);
    if (!myCard || !oppCard) {
      console.error('resolveAndAnimate: cards not found', { myCard, oppCard, myMove, oppMove });
      return;
    }

    const roundResult = resolvePvpRound({
      hostCard: myCard, hostPillz: myMove.pillz,
      guestCard: oppCard, guestPillz: oppMove.pillz,
      hostDeck: myDeck, guestDeck: oppDeck,
    });
    lastRoundResultRef.current = roundResult;

    updateGameState(game.id, {
      phase: 'resolve',
      round: roundRef.current,
      hostHP: playerHPRef.current,
      guestHP: opponentHPRef.current,
      hostPillz: playerPillzRef.current,
      guestPillz: opponentPillzRef.current,
      lastResolvedRound: roundRef.current,
      roundResult,
    }).catch(console.error);

    runRoundAnimation(myCard, myMove.pillz, oppCard, oppMove.pillz, roundResultForView(roundResult, 'host'));
  }, [isHost, myDeck, oppDeck, findCardById, game.id, runRoundAnimation]);

  // ─── Primary loop: polling-based resolution (works WITHOUT Realtime subscriptions) ───
  useEffect(() => {
    if (battlePhase !== 'waiting_opponent') return;

    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      try {
        const currentRound = roundRef.current;
        const moves = await getRoundMoves(game.id, currentRound);
        const myMove = moves.find((m) => m.player_id === playerId);
        const oppMove = moves.find((m) => m.player_id !== playerId);

        // Host: if both moves are present, resolve
        if (isHost && myMove && oppMove) {
          resolveAndAnimate(myMove, oppMove);
          return; // host resolved, done for this round
        }

        // Guest (or host already resolved on previous poll): check game state
        if (myMove && oppMove) {
          const freshGame = await getGame(game.id);
          const state = freshGame?.state;
          if (state?.lastResolvedRound === currentRound && state?.roundResult) {
            animateFromRoundResult(state.roundResult);
          }
        }
      } catch (e) {
        console.error('PvP poll error:', e);
      }
    };

    poll(); // immediate check
    const interval = setInterval(poll, 1500);
    return () => { cancelled = true; clearInterval(interval); };
  }, [battlePhase, game.id, playerId, isHost, resolveAndAnimate, animateFromRoundResult]);

  // ─── Realtime subscription (optimization — fires faster than polling when it works) ───
  useEffect(() => {
    const cleanup = subscribeToGame(
      game.id,
      (_move: Move) => {
        // Subscription is just a hint — polling handles actual resolution.
        // We ignore individual moves here to keep logic simple and reliable.
      },
      (updatedGame: Game) => {
        const state = updatedGame.state;

        // Handle finished game
        if (updatedGame.status === 'finished' && state?.phase === 'ended') {
          const myHP = isHost ? state.hostHP : state.guestHP;
          const oppHP = isHost ? state.guestHP : state.hostHP;
          let r: 'win' | 'loss' | 'draw' = 'draw';
          if (myHP > oppHP) r = 'win';
          else if (oppHP > myHP) r = 'loss';
          setBattleResult(r);
          setBattlePhase('ended');
          abandonGame(game.id).catch(console.error);
          return;
        }

        // Handle mid-game round result via subscription (faster than polling)
        if (state?.lastResolvedRound === roundRef.current && state?.roundResult) {
          animateFromRoundResult(state.roundResult);
        }

        if (!updatedGame.guest_id && !isHost) {
          setOpponentDisconnected(true);
        }
      },
    );

    return cleanup;
  }, [game.id, playerId, isHost, animateFromRoundResult]);

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

  const handleOpponentAbandon = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (vsTimerRef.current) clearTimeout(vsTimerRef.current);
    if (damageTimerRef.current) clearTimeout(damageTimerRef.current);

    const myHP = playerHPRef.current;
    const newState: GameState = {
      phase: 'ended',
      round,
      hostHP: isHost ? myHP : 0,
      guestHP: isHost ? 0 : myHP,
      hostPillz: isHost ? playerPillzRef.current : 0,
      guestPillz: isHost ? 0 : playerPillzRef.current,
    };
    updateGameState(game.id, newState).catch(console.error);
    abandonGame(game.id).catch(console.error);

    setBattleResult('win');
    setBattlePhase('ended');
  };

  // Opponent move timeout (40s) — if no move received, treat as abandonment
  useEffect(() => {
    if (battlePhase !== 'waiting_opponent') {
      setOpponentMoveTimer(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setOpponentMoveTimer(elapsed);
      if (elapsed >= 40) {
        handleOpponentAbandon();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [battlePhase]);

  // PvP ставка: при собственной победе победитель забирает банк
  useEffect(() => {
    if (battleResult === 'win') {
      settlePvpStake(playerId, game.id).then((r) => {
        if (!r.success) console.warn('[pvp] settle stake:', r.error);
      });
    }
  }, [battleResult, playerId, game.id]);

  const handleSelect = useCallback(async (card: Card, pillz: number) => {
    if (battlePhase !== 'select') return;
    if (timerRef.current) clearInterval(timerRef.current);

    playCardSwoosh();

    setBattlePhase('submitting');

    try {
      await submitMove(game.id, playerId, round, card.id, pillz);
      setBattlePhase('waiting_opponent');
      // Polling will pick up both moves and resolve the round
    } catch (e) {
      console.error('Failed to submit move:', e);
      setBattlePhase('select');
    }
  }, [battlePhase, game.id, playerId, round]);

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

  const youLabel = playerName || t('pvp.youShort');
  const opponentLabel = isHost
    ? (game.guest_name || t('pvp.opponent'))
    : (game.host_name || t('pvp.opponent'));

  return (
    <div className={`flex flex-col h-full w-full max-w-lg mx-auto overflow-hidden bg-battle relative ${screenShake ? 'animate-damage-shake' : ''}`}>
      {/* Damage Flash Overlay */}
      {damageFlash !== 'none' && (
        <div className={`absolute inset-0 pointer-events-none z-50 ${damageFlash === 'player' ? 'animate-red-flash' : 'animate-green-flash'}`} />
      )}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-1 h-1 bg-neon-blue/20 rounded-full animate-drift" style={{ top: '10%', left: '20%' }} />
        <div className="absolute w-1.5 h-1.5 bg-neon-purple/15 rounded-full animate-drift" style={{ top: '30%', right: '15%', animationDelay: '2s' }} />
        <div className="absolute w-1 h-1 bg-neon-pink/10 rounded-full animate-drift" style={{ top: '60%', left: '10%', animationDelay: '4s' }} />
        <div className="absolute w-1.5 h-1.5 bg-neon-green/10 rounded-full animate-drift" style={{ top: '80%', right: '25%', animationDelay: '6s' }} />
      </div>

      <div className="flex justify-between items-center px-3 py-2 bg-dark-card/80 border-b border-dark-border shrink-0">
        <span className="text-xs text-white/60">{t('pvp.roundShort')} {round}/{TOTAL_ROUNDS}</span>
        <span className="text-[10px] text-neon-red/70 truncate max-w-[120px]">{opponentLabel}: {opponentPillz} {t('battle.pillzShort')}</span>

        <button onClick={() => { impactOccurred('heavy'); handleSurrender(); }}
          className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-white/40 active:text-white/70 active:bg-white/10 transition-all">
          {t('battle.surrender')}
        </button>

        {battlePhase === 'select' && (
          <div className={`text-xl font-bold tabular-nums ${timerColor}`}>{timer}s</div>
        )}
        {battlePhase === 'waiting_opponent' && (
          <div className="text-[10px] text-yellow-400 animate-pulse">{t('pvp.waiting')}</div>
        )}
        {battlePhase === 'submitting' && (
          <div className="text-[10px] text-neon-blue animate-pulse">{t('pvp.sending')}</div>
        )}
        {battlePhase !== 'select' && battlePhase !== 'waiting_opponent' && battlePhase !== 'submitting' && (
          <span className="text-xl font-bold tabular-nums text-white/20">—</span>
        )}

        <span className="text-xs text-white/60">{t('battle.pillzShort')}: {playerPillz}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 py-1.5 shrink-0">
        <div className="flex flex-col gap-0.5">
          <div className="text-[9px] text-neon-green font-bold truncate">{youLabel}</div>
          <div className="h-2.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800 relative">
            <div className={`h-full rounded-full transition-all duration-1000 ease-out ${damageFlash === 'player' ? 'bg-gradient-to-r from-red-500 to-orange-400' : 'bg-gradient-to-r from-neon-green to-emerald-400'}`}
              style={{ width: `${(playerHP / TOTAL_HP) * 100}%`, boxShadow: damageFlash === 'player' ? 'none' : '0 0 8px rgba(0,230,118,0.3)' }} />
            {currentResult?.winner === 'opponent' && battlePhase === 'damage' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-red-400 animate-damage-float">-{currentResult.damageDealt}</span>
              </div>
            )}
            {currentResult?.winner === 'player' && currentResult?.lifeStealAmount > 0 && battlePhase === 'damage' && (
              <div className="absolute inset-0 flex items-center justify-start ml-1">
                <span className="text-[8px] font-bold text-purple-400 animate-damage-float">+{currentResult.lifeStealAmount}</span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-white font-bold">{playerHP}</span>
            <span className="text-[8px] text-white/20">{TOTAL_HP}</span>
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="text-[9px] text-neon-red font-bold text-right truncate">{opponentLabel}</div>
          <div className="h-2.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800 relative">
            <div className={`h-full rounded-full transition-all duration-1000 ease-out ${damageFlash === 'opponent' ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-neon-red to-orange-400'}`}
              style={{ width: `${(opponentHP / TOTAL_HP) * 100}%`, boxShadow: damageFlash === 'opponent' ? 'none' : '0 0 8px rgba(255,61,0,0.3)' }} />
            {currentResult?.winner === 'player' && battlePhase === 'damage' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-green-400 animate-damage-float">-{currentResult.damageDealt}</span>
              </div>
            )}
            {currentResult?.winner === 'opponent' && currentResult?.lifeStealAmount > 0 && battlePhase === 'damage' && (
              <div className="absolute inset-0 flex items-center justify-end mr-1">
                <span className="text-[8px] font-bold text-purple-400 animate-damage-float">+{currentResult.lifeStealAmount}</span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[8px] text-white/20">{TOTAL_HP}</span>
            <span className="text-[10px] text-white font-bold">{opponentHP}</span>
          </div>
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
            <div className="text-lg font-bold text-white/60">{t('pvp.waiting')}</div>
            <div className="text-xs text-white/30">{t('pvp.gameCode')}:</div>
            <div className="text-sm font-mono font-bold text-neon-green break-all text-center px-4 py-2 rounded-lg bg-white/5 border border-neon-green/30">
              {game.id}
            </div>
            <div className="text-[10px] text-white/30 text-center">{t('pvp.shareCodeHint')}</div>
          </div>
        )}

        {battlePhase === 'waiting' && game.guest_id && (
          <div className="text-sm text-white/50 animate-pulse">{t('pvp.battleStart')}</div>
        )}

        {battlePhase === 'select' && (
          <CardSelector cards={playerCardsRemaining} onSelect={handleSelect} maxPillz={playerPillz} />
        )}

        {battlePhase === 'submitting' && (
          <div className="flex flex-col items-center gap-2">
            <div className="text-sm text-neon-blue animate-pulse">{t('pvp.sendingMove')}</div>
          </div>
        )}

        {battlePhase === 'waiting_opponent' && (
          <div className="flex flex-col items-center gap-3 px-4">
            <div className="flex flex-col items-center gap-1">
              <div className="text-sm text-yellow-400 animate-pulse">{t('pvp.waitingMove')}</div>
              <div className="flex items-center gap-1 text-xs text-white/40">
                <span>{t('pvp.opponentMoveTimer')}</span>
                <span className={`font-bold tabular-nums ${opponentMoveTimer > 30 ? 'text-neon-red' : 'text-white/60'}`}>{opponentMoveTimer}s / 40s</span>
              </div>
            </div>
            {currentPlayerCard && (
              <div className="flex flex-col items-center">
                <div className="text-[9px] text-neon-green mb-0.5">{t('pvp.yourTurn')}</div>
                <CardComponent card={currentPlayerCard} compact />
                <div className="text-[10px] text-white/60 mt-0.5">{t('battle.pillzShort')}: {currentPlayerPillz}</div>
              </div>
            )}
          </div>
        )}

        {battlePhase === 'vs' && currentPlayerCard && currentOpponentCard && currentResult && (
          <div className="flex flex-col items-center gap-3 w-full animate-fade-in px-3">
            {/* VS Banner — dramatic impact */}
            <div className="text-5xl font-black animate-vs-impact" style={{
              background: 'linear-gradient(90deg, #FF3D00, #FFD700, #FF3D00)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '0.2em',
            }}>
              VS
            </div>
            <div className="flex items-center gap-3 justify-center w-full">
              {/* Player Card */}
              <div className={`flex flex-col items-center ${currentResult.winner === 'player' ? 'animate-card-win' : currentResult.winner === 'opponent' ? 'animate-card-loss' : ''}`}>
                <div className="text-[9px] text-neon-green mb-0.5 truncate">{youLabel}</div>
                <CardComponent card={currentPlayerCard} compact />
                <div className="text-[10px] text-white/60 mt-0.5">{t('battle.pillzShort')}: {currentPlayerPillz}</div>
              </div>

              {/* Battle Stats Center */}
              <div className="flex flex-col items-center gap-1">
                <div className="text-2xl font-black text-white animate-pulse">
                  {currentResult.playerAttack}
                </div>
                <div className="text-[10px] text-white/30">VS</div>
                <div className="text-2xl font-black text-white animate-pulse" style={{ animationDelay: '0.3s' }}>
                  {currentResult.opponentAttack}
                </div>
                <div className={`
                  text-sm font-black px-3 py-0.5 rounded-full animate-card-pop
                  ${currentResult.winner === 'player' ? 'text-neon-green bg-neon-green/10 border border-neon-green/30' : ''}
                  ${currentResult.winner === 'opponent' ? 'text-neon-red bg-neon-red/10 border border-neon-red/30' : ''}
                  ${currentResult.winner === 'draw' ? 'text-white/50 bg-white/5 border border-white/10' : ''}
                `}>
                  {currentResult.winner === 'player' && <span className="inline-flex items-center gap-1.5"><Icon name="sword" size={14} /> {t('battle.victory')}</span>}
                  {currentResult.winner === 'opponent' && <span className="inline-flex items-center gap-1.5"><Icon name="sword" size={14} /> {t('battle.defeat')}</span>}
                  {currentResult.winner === 'draw' && <span className="inline-flex items-center gap-1.5"><Icon name="sword" size={14} /> {t('battle.draw')}</span>}
                </div>
                {/* Ability effect badges */}
                <div className="flex flex-wrap gap-1 justify-center mt-1">
                  {currentResult.damageDealt > 0 && (
                    <span className="inline-flex items-center gap-1 animate-card-pop text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/20"><Icon name="boom" size={10} /> -{currentResult.damageDealt} HP</span>
                  )}
                  {currentResult.healAmount > 0 && (
                    <span className="inline-flex items-center gap-1 animate-card-pop text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/20" style={{ animationDelay: '0.2s' }}><Icon name="heart" size={10} /> +{currentResult.healAmount} HP</span>
                  )}
                  {currentResult.lifeStealAmount > 0 && (
                    <span className="inline-flex items-center gap-1 animate-card-pop text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/20" style={{ animationDelay: '0.3s' }}><Icon name="drop" size={10} /> +{currentResult.lifeStealAmount} HP</span>
                  )}
                  {currentResult.poisonAmount > 0 && (
                    <span className="inline-flex items-center gap-1 animate-card-pop text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/20" style={{ animationDelay: '0.4s' }}><Icon name="skull" size={10} /> {currentResult.poisonAmount}</span>
                  )}
                </div>
              </div>

              {/* Opponent Card */}
              <div className={`flex flex-col items-center ${currentResult.winner === 'opponent' ? 'animate-card-win' : currentResult.winner === 'player' ? 'animate-card-loss' : ''}`}>
                <div className="text-[9px] text-neon-red mb-0.5 truncate">{opponentLabel}</div>
                <CardComponent card={currentOpponentCard} compact />
                <div className="text-[10px] text-white/60 mt-0.5">{t('battle.pillzShort')}: {currentOpponentPillz}</div>
              </div>
            </div>
          </div>
        )}

        {battlePhase === 'damage' && currentResult && (
          <div className="flex flex-col items-center gap-3 w-full px-3">
            {/* Main damage number — big and dramatic */}
            <div className={`
              text-6xl font-black animate-card-pop
              ${currentResult.winner === 'player' ? 'text-neon-red drop-shadow-[0_0_20px_rgba(255,61,0,0.6)]' : ''}
              ${currentResult.winner === 'opponent' ? 'text-red-500 drop-shadow-[0_0_20px_rgba(255,0,0,0.6)]' : ''}
              ${currentResult.winner === 'draw' ? 'text-white/30' : ''}
            `}>
              {currentResult.winner === 'draw' && t('pvp.nichya')}
              {currentResult.winner === 'player' && `-${currentResult.damageDealt}`}
              {currentResult.winner === 'opponent' && `-${currentResult.damageDealt}`}
            </div>
            <div className={`
              text-base font-bold animate-card-pop
              ${currentResult.winner === 'player' ? 'text-neon-red' : ''}
              ${currentResult.winner === 'opponent' ? 'text-red-400' : ''}
              ${currentResult.winner === 'draw' ? 'text-white/30' : ''}
            `} style={{ animationDelay: '0.2s' }}>
              {currentResult.winner === 'player' && <span className="inline-flex items-center gap-1.5"><Icon name="boom" size={14} /> {t('pvp.hpOpponent')}</span>}
              {currentResult.winner === 'opponent' && <span className="inline-flex items-center gap-1.5"><Icon name="boom" size={14} /> {t('pvp.hpYour')}</span>}
              {currentResult.winner === 'draw' && t('pvp.draw')}
            </div>
            {/* Additional effects */}
            <div className="flex gap-2 animate-card-pop" style={{ animationDelay: '0.3s' }}>
              {currentResult.healAmount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-300 border border-green-500/20"><Icon name="heart" size={11} /> +{currentResult.healAmount}</span>
              )}
              {currentResult.poisonAmount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/20"><Icon name="skull" size={11} /> {currentResult.poisonAmount}</span>
              )}
              {currentResult.lifeStealAmount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/20"><Icon name="drop" size={11} /> +{currentResult.lifeStealAmount}</span>
              )}
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

            {(battleResult === 'win' && game.stake_nano && Number(game.stake_nano) > 0) && (
              <div className="text-sm font-black text-neon-green bg-neon-green/10 border border-neon-green/30 rounded-xl px-4 py-2">
                +{(Number(game.stake_nano) * 2 / 1e9).toFixed(2)} NACKL 🎯
              </div>
            )}

            <div className="flex flex-col gap-1.5 w-full max-w-xs">
              <div className="inline-flex items-center gap-1 text-[8px] text-white/30 uppercase tracking-wider mb-0.5"><Icon name="book" size={9} /> {t('pvp.log')}</div>
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
                    <span className="text-white/30">{entry.playerPillz} {t('battle.pillzShort')}</span>
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
                    <span className="text-white/30">{entry.aiPillz} {t('battle.pillzShort')}</span>
                  </div>

                  <div className="border-t border-white/5 pt-1.5 mt-1 flex items-center justify-between">
                    <span className="text-white/40">{t('battle.total')}:</span>
                    <div className="flex items-center gap-2">
                      {entry.damageDealt > 0 && <span className="inline-flex items-center gap-0.5 text-red-300 font-bold"><Icon name="boom" size={10} />{entry.damageDealt}</span>}
                      {entry.healAmount > 0 && <span className="inline-flex items-center gap-0.5 text-green-300"><Icon name="heart" size={10} />+{entry.healAmount}</span>}
                      {entry.lifeStealAmount > 0 && <span className="inline-flex items-center gap-0.5 text-purple-300"><Icon name="drop" size={10} />+{entry.lifeStealAmount}</span>}
                      {entry.poisonAmount > 0 && <span className="inline-flex items-center gap-0.5 text-yellow-300"><Icon name="skull" size={10} />{entry.poisonAmount}</span>}
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
