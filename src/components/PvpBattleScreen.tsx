import { useState, useEffect, useCallback, useRef } from 'react';
import type { Card, RoundResult } from '../types';
import CardComponent from './CardComponent';
import { useI18n } from '../i18n';
import CardSelector from './CardSelector';
import { useHaptic } from '../hooks/useHaptic';
import { playCardSwoosh, playVS, playHit, playVictory, playDefeat, playDraw, playHeal, playPoison, playLifeSteal } from '../utils/soundEffects';
import {
  submitMove,
  getGame,
  surrenderGame,
  abandonGame,
  type Game,
  type PvpRoundResult,
} from '../services/pvpService';
import Icon from './Icon';

interface Props {
  game: Game;
  playerId: string;
  playerName?: string;
  isHost: boolean;
  myDeck: Card[];
  onBattleEnd: (result: 'win' | 'loss' | 'draw') => void;
  onSurrender: () => void;
}

const TOTAL_HP = 50;
const TOTAL_ROUNDS = 5;
const TURN_TIME = 30;
const VS_DURATION = 2500;
const DAMAGE_DURATION = 2000;
const OPPONENT_TIMEOUT = 40;

type BattlePhase = 'waiting' | 'select' | 'submitting' | 'waiting_opponent' | 'vs' | 'damage' | 'ended';

const MY_DECK_KEY = (gameId: string) => `pvp_my_deck_${gameId}`;

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Конвертация результата серверного раунда в представление клиента. */
function rrToView(rr: PvpRoundResult, isPlayerHost: boolean): RoundResult {
  const playerIsHost = isPlayerHost;
  const pBase = playerIsHost ? rr.hostBasePower : rr.guestBasePower;
  const pFinal = playerIsHost ? rr.hostFinalPower : rr.guestFinalPower;
  const aBase = playerIsHost ? rr.guestBasePower : rr.hostBasePower;
  const aFinal = playerIsHost ? rr.guestFinalPower : rr.hostFinalPower;
  return {
    winner: rr.winner === 'draw' ? 'draw' : rr.winner === 'host' ? (playerIsHost ? 'player' : 'ai') : (playerIsHost ? 'ai' : 'player'),
    damageDealt: rr.damage,
    playerAttack: playerIsHost ? rr.hostAttack : rr.guestAttack,
    aiAttack: playerIsHost ? rr.guestAttack : rr.hostAttack,
    playerBasePower: pBase,
    playerFinalPower: pFinal,
    aiBasePower: aBase,
    aiFinalPower: aFinal,
    healAmount: rr.healAmount,
    poisonAmount: rr.poisonAmount,
    lifeStealAmount: rr.lifeStealAmount,
    opponentDamageReduction: rr.opponentDamageReduction,
  };
}

export default function PvpBattleScreen({ game, playerId, playerName, isHost, myDeck, onBattleEnd, onSurrender }: Props) {
  const { t } = useI18n();
  const { impactOccurred } = useHaptic();

  // Моя колода: пропс (из лобби) или восстановленная из localStorage
  const [deck] = useState<Card[]>(() => {
    if (myDeck.length > 0) return myDeck;
    try {
      const raw = localStorage.getItem(MY_DECK_KEY(game.id));
      if (raw) return JSON.parse(raw) as Card[];
    } catch {}
    return [];
  });
  useEffect(() => {
    if (deck.length > 0) localStorage.setItem(MY_DECK_KEY(game.id), JSON.stringify(deck));
  }, [deck, game.id]);

  // Синхронизация с сервером (единственный источник истины)
  const [serverState, setServerState] = useState(game.state);

  // 4 случайные карты из 10 — как и у соперника (сервер хранит все колоды)
  const [myHand] = useState<Card[]>(() => shuffleArray(deck).slice(0, TOTAL_ROUNDS));

  const [playerHP, setPlayerHP] = useState(() => (isHost ? serverState.hostHP : serverState.guestHP));
  const [opponentHP, setOpponentHP] = useState(() => (isHost ? serverState.guestHP : serverState.hostHP));
  const [playerPillz, setPlayerPillz] = useState(() => (isHost ? serverState.hostPillz : serverState.guestPillz));
  const [round, setRound] = useState(() => serverState.round);

  const [playerCardsUsed, setPlayerCardsUsed] = useState<string[]>([]);

  const [battlePhase, setBattlePhase] = useState<BattlePhase>(
    serverState.phase === 'ended' ? 'ended' : (game.guest_id ? 'select' : 'waiting'),
  );
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
  const [opponentMoveTimer, setOpponentMoveTimer] = useState(0);
  const [damageFlash, setDamageFlash] = useState<'none' | 'player' | 'opponent'>('none');
  const [screenShake, setScreenShake] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const damageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundRef = useRef(round);
  const battlePhaseRef = useRef<BattlePhase>(battlePhase);
  const animatedRoundsRef = useRef<Set<number>>(new Set());
  const serverStateRef = useRef(serverState);
  const endedRef = useRef(false);
  const animatingRef = useRef(false); // true, пока идёт VS/damage-анимация раунда

  roundRef.current = round;
  battlePhaseRef.current = battlePhase;
  serverStateRef.current = serverState;

  const playerCardsRemaining = myHand.filter((c) => c.uid && !playerCardsUsed.includes(c.uid));

  const finishBattle = useCallback((r: 'win' | 'loss' | 'draw') => {
    if (endedRef.current) return;
    endedRef.current = true;
    animatingRef.current = false;
    if (r === 'win') playVictory();
    else if (r === 'loss') playDefeat();
    else playDraw();
    setBattleResult(r);
    setBattlePhase('ended');
  }, []);

  const applyServerState = useCallback((st: Game['state']) => {
    if (st.phase === 'ended') {
      setPlayerHP(isHost ? st.hostHP : st.guestHP);
      setOpponentHP(isHost ? st.guestHP : st.hostHP);
      const myHP = isHost ? st.hostHP : st.guestHP;
      const oppHP = isHost ? st.guestHP : st.hostHP;
      if (myHP > oppHP) finishBattle('win');
      else if (oppHP > myHP) finishBattle('loss');
      else finishBattle('draw');
      return;
    }
    setServerState(st);
    if (st.round !== roundRef.current) {
      // Новый раунд — синхронизируем ресурсы
      setRound(st.round);
      setPlayerPillz(isHost ? st.hostPillz : st.guestPillz);
      setCurrentPlayerCard(null);
      setCurrentOpponentCard(null);
      setCurrentResult(null);
      if (battlePhaseRef.current === 'waiting_opponent' || battlePhaseRef.current === 'vs' || battlePhaseRef.current === 'damage') {
        setBattlePhase('select');
      }
    }
  }, [isHost, finishBattle]);

  // ─── Анимация раунда из серверного roundResult ───
  const animateRound = useCallback((rr: PvpRoundResult, freshState: Game['state']) => {
    if (endedRef.current) return;
    const myCard: Card | null = rr.hostCard && rr.guestCard
      ? (isHost ? rr.hostCard : rr.guestCard)
      : null;
    const oppCard: Card | null = rr.hostCard && rr.guestCard
      ? (isHost ? rr.guestCard : rr.hostCard)
      : null;
    if (!myCard || !oppCard) return;
    if (animatedRoundsRef.current.has(roundRef.current)) return;
    animatedRoundsRef.current.add(roundRef.current);
    animatingRef.current = true;

    const myWithUid: Card = { ...myCard, uid: `resolved-my-${rr.hostCardId}-${rr.guestCardId}` };
    const oppWithUid: Card = { ...oppCard, uid: `resolved-opp-${rr.hostCardId}-${rr.guestCardId}` };
    const myPillz = isHost ? rr.hostPillzUsed : rr.guestPillzUsed;
    const oppPillz = isHost ? rr.guestPillzUsed : rr.hostPillzUsed;

    setCurrentPlayerCard(myWithUid);
    setCurrentPlayerPillz(myPillz);
    setCurrentOpponentCard(oppWithUid);
    setCurrentOpponentPillz(oppPillz);

    const view = rrToView(rr, isHost);
    const mappedResult = {
      winner: view.winner === 'player' ? ('player' as const) : view.winner === 'ai' ? ('opponent' as const) : ('draw' as const),
      damageDealt: view.damageDealt,
      playerAttack: view.playerAttack,
      opponentAttack: view.aiAttack,
      healAmount: view.healAmount,
      poisonAmount: view.poisonAmount,
      lifeStealAmount: view.lifeStealAmount,
    };
    setCurrentResult(mappedResult);

    setPlayerPillz((p) => Math.max(0, p - myPillz));
    // Карта помечается использованной в handleSelect при успешном submitMove
    // (там реальный uid из руки), а НЕ здесь — синтетический uid не совпадает
    // с uid карт в руке, и рука никогда бы не уменьшалась.

    setRoundLog((prev) => [...prev, {
      round: roundRef.current,
      playerCard: myWithUid,
      playerPillz: myPillz,
      aiCard: oppWithUid,
      aiPillz: oppPillz,
      winner: mappedResult.winner === 'player' ? 'player' : mappedResult.winner === 'opponent' ? 'ai' : 'draw',
      damageDealt: view.damageDealt,
      playerAttack: view.playerAttack,
      aiAttack: view.aiAttack,
      playerBasePower: view.playerBasePower,
      playerFinalPower: view.playerFinalPower,
      aiBasePower: view.aiBasePower,
      aiFinalPower: view.aiFinalPower,
      healAmount: view.healAmount,
      poisonAmount: view.poisonAmount,
      lifeStealAmount: view.lifeStealAmount,
      opponentDamageReduction: view.opponentDamageReduction,
    }]);

    playVS();
    setBattlePhase('vs');

    vsTimerRef.current = setTimeout(() => {
      setBattlePhase('damage');

      damageTimerRef.current = setTimeout(() => {
        // HP берём из серверного state — сервер уже применил урон/хил/яд.
        // Локально НЕ вычитаем (иначе двойное списание).
        const newMyHP = Math.max(0, isHost ? freshState.hostHP : freshState.guestHP);
        const newOppHP = Math.max(0, isHost ? freshState.guestHP : freshState.hostHP);
        animatingRef.current = false;

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
      }, DAMAGE_DURATION);
    }, VS_DURATION);
  }, [isHost]);

  // ─── Поллинг сервера (единственный источник истины) ───
  useEffect(() => {
    if (battlePhase !== 'waiting_opponent' && battlePhase !== 'vs' && battlePhase !== 'damage') return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled || endedRef.current) return;
      try {
        const fresh = await getGame(game.id);
        if (!fresh || cancelled) return;
        const st = fresh.state;
        if (st?.roundResult && st.lastResolvedRound === roundRef.current) {
          animateRound(st.roundResult, st);
        }
        // Пока анимация раунда идёт — не применяем серверный state,
        // иначе экран «пустеет», а таймеры доигрывают звуки/HP в фоне.
        if (animatingRef.current) return;
        if (st?.phase === 'ended' || fresh.status === 'finished') {
          applyServerState(st);
        } else if (st?.round !== roundRef.current && st?.phase === 'select') {
          applyServerState(st);
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 1500);
    return () => { cancelled = true; clearInterval(interval); };
  }, [battlePhase, game.id, animateRound, applyServerState]);

  // ─── Таймер хода ───
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

  // Автоход при таймауте
  useEffect(() => {
    if (timer === 0 && battlePhase === 'select') {
      const firstCard = playerCardsRemaining[0];
      if (firstCard) handleSelect(firstCard, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, battlePhase]);

  // ─── Таймаут оппонента (40с) → abandon ───
  useEffect(() => {
    if (battlePhase !== 'waiting_opponent') {
      setOpponentMoveTimer(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(async () => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setOpponentMoveTimer(elapsed);
      if (elapsed >= OPPONENT_TIMEOUT && !endedRef.current) {
        clearInterval(interval);
        try {
          await abandonGame(playerId, game.id);
          setPlayerHP(isHost ? (serverStateRef.current.hostHP || TOTAL_HP) : TOTAL_HP);
          setOpponentHP(isHost ? 0 : 0);
          finishBattle('win');
        } catch {}
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [battlePhase, playerId, game.id, isHost, finishBattle]);

  const handleSelect = useCallback(async (card: Card, pillz: number) => {
    if (battlePhase !== 'select') return;
    if (timerRef.current) clearInterval(timerRef.current);

    playCardSwoosh();
    setBattlePhase('submitting');
    setError(null);

    try {
      if (!card.uid) throw new Error('Карта без uid');
      await submitMove(game.id, playerId, round, card.uid, pillz);
      // Помечаем реальный uid карты — рука уменьшается, сервер отклонит
      // повторный ход этой карты (409 «карта уже использована»).
      setPlayerCardsUsed((prev) => [...prev, card.uid!]);
      setBattlePhase('waiting_opponent');
      // Поллинг подхватит результат, когда сервер срезолвит раунд
    } catch (e) {
      console.error('Failed to submit move:', e);
      setError(e instanceof Error ? e.message : 'Ошибка отправки хода');
      setBattlePhase('select');
    }
  }, [battlePhase, game.id, playerId, round]);

  const handleSurrender = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (vsTimerRef.current) clearTimeout(vsTimerRef.current);
    if (damageTimerRef.current) clearTimeout(damageTimerRef.current);
    if (endedRef.current) return;

    try {
      await surrenderGame(playerId, game.id);
      finishBattle('loss');
      onSurrender();
    } catch (e) {
      console.error('Surrender failed:', e);
    }
  };

  useEffect(() => {
    return () => {
      animatingRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (vsTimerRef.current) clearTimeout(vsTimerRef.current);
      if (damageTimerRef.current) clearTimeout(damageTimerRef.current);
    };
  }, []);

  // ─── Переход «ждём соперника» → «бой» ───
  useEffect(() => {
    if (battlePhase === 'waiting' && game.guest_id) {
      setBattlePhase('select');
    }
  }, [game.guest_id, battlePhase]);

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
        <span className="text-[10px] text-neon-red/70 truncate max-w-[120px]">{opponentLabel}</span>
        {error && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 rounded-lg text-[11px] font-bold text-red-300 bg-red-500/15 border border-red-500/40 z-50 animate-slide-down max-w-[90%] text-center">
            {error}
          </div>
        )}

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
              style={{ width: `${Math.min(100, (playerHP / TOTAL_HP) * 100)}%`, boxShadow: damageFlash === 'player' ? 'none' : '0 0 8px rgba(0,230,118,0.3)' }} />
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
              style={{ width: `${Math.min(100, (opponentHP / TOTAL_HP) * 100)}%`, boxShadow: damageFlash === 'opponent' ? 'none' : '0 0 8px rgba(255,61,0,0.3)' }} />
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
                <span className={`font-bold tabular-nums ${opponentMoveTimer > 30 ? 'text-neon-red' : 'text-white/60'}`}>{opponentMoveTimer}s / {OPPONENT_TIMEOUT}s</span>
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
