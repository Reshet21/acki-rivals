import { useState, useEffect, useCallback, useRef } from 'react';
import type { Card } from '../types';
import { cards as allCards } from '../data/cards';
import { resolveRound } from '../utils/battleLogic';
import { playCardSwoosh, playVS, playHit, playVictory, playDefeat, playDraw, playHeal, playPoison, playLifeSteal, playAbility } from '../utils/soundEffects';
import CardComponent from './CardComponent';
import { useI18n } from '../i18n';
import CardSelector from './CardSelector';
import { useTelegram } from '../telegram';
import { abilityInfo, abilityNames, abilityDescriptions } from '../data/abilityVisuals';
import Icon from './Icon';

interface Props {
  playerDeck: Card[];
  onBattleEnd: (result: 'win' | 'loss' | 'draw') => void;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface RoundLogEntry {
  round: number;
  playerCard: Card;
  playerPillz: number;
  aiCard: Card;
  aiPillz: number;
  winner: 'player' | 'ai' | 'draw';
  damageDealt: number;
  playerAttack: number;
  aiAttack: number;
  playerBasePower: number;
  playerFinalPower: number;
  aiBasePower: number;
  aiFinalPower: number;
  healAmount: number;
  poisonAmount: number;
  lifeStealAmount: number;
  opponentDamageReduction: number;
}

const TOTAL_HP = 50;
const TOTAL_ROUNDS = 5;
const TURN_TIME = 30;
const STARTING_PILLZ = 12;
const FREE_PILLZ_PER_ROUND = 1;
const VS_DURATION = 2000;
const DAMAGE_DURATION = 2000;

export default function BattleScreen({ playerDeck, onBattleEnd }: Props) {
  const { t } = useI18n();
  const { haptic } = useTelegram();
  const [playerHP, setPlayerHP] = useState(TOTAL_HP);
  const [aiHP, setAiHP] = useState(TOTAL_HP);
  const [playerPillz, setPlayerPillz] = useState(STARTING_PILLZ);
  const [aiPillz, setAiPillz] = useState(STARTING_PILLZ);
  const [round, setRound] = useState(1);

  // Deal 4 random cards from player's 8-card deck
  const [playerHand] = useState<Card[]>(() => shuffleArray(playerDeck.filter((c) => c.uid)).slice(0, TOTAL_ROUNDS));
  // AI picks 4 random from all cards
  const [aiDeck] = useState<Card[]>(() =>
    shuffleArray(allCards).slice(0, TOTAL_ROUNDS).map((c, i) => ({
      ...c,
      uid: c.uid || `ai-${c.id}-${i}-${Date.now()}`,
    }))
  );

  const [playerCardsUsed, setPlayerCardsUsed] = useState<string[]>([]);
  const [aiCardsUsed, setAiCardsUsed] = useState<string[]>([]);

  const [roundLog, setRoundLog] = useState<RoundLogEntry[]>([]);
  const [battlePhase, setBattlePhase] = useState<'select' | 'vs' | 'damage' | 'ended'>('select');

  const [currentPlayerCard, setCurrentPlayerCard] = useState<Card | null>(null);
  const [currentPlayerPillz, setCurrentPlayerPillz] = useState(0);
  const [currentAiCard, setCurrentAiCard] = useState<Card | null>(null);
  const [currentAiPillz, setCurrentAiPillz] = useState(0);
  const [currentResult, setCurrentResult] = useState<{
    winner: 'player' | 'ai' | 'draw';
    damageDealt: number;
    playerAttack: number;
    aiAttack: number;
    healAmount: number;
    poisonAmount: number;
    lifeStealAmount: number;
    opponentDamageReduction: number;
  } | null>(null);

  const [battleResult, setBattleResult] = useState<'win' | 'loss' | 'draw'>('draw');
  const [damageFlash, setDamageFlash] = useState<'none' | 'player' | 'ai'>('none');
  const [screenShake, setScreenShake] = useState(false);
  const [timer, setTimer] = useState(TURN_TIME);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const damageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerHPRef = useRef(TOTAL_HP);
  const aiHPRef = useRef(TOTAL_HP);

  playerHPRef.current = playerHP;
  aiHPRef.current = aiHP;

  const playerCardsRemaining = playerHand.filter((c) => c.uid && !playerCardsUsed.includes(c.uid));
  const aiCardsRemaining = aiDeck.filter((c) => c.uid && !aiCardsUsed.includes(c.uid));

  useEffect(() => {
    if (battlePhase !== 'select') return;
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
  }, [battlePhase, round]);

  const pickAiCard = useCallback(() => {
    const available = aiDeck.filter((c) => c.uid && !aiCardsUsed.includes(c.uid));
    const card = pickRandom(available);
    const maxPillz = aiPillz;
    const pillz = Math.floor(Math.random() * (maxPillz + 1));
    return { card, pillz };
  }, [aiDeck, aiCardsUsed, aiPillz]);

  const handleSelectRef = useRef<(card: Card, pillz: number) => void>(() => {});

  const handleSelect = useCallback((card: Card, pillz: number) => {
    if (battlePhase !== 'select') return;
    if (timerRef.current) clearInterval(timerRef.current);

    const ai = pickAiCard();

    setCurrentPlayerCard(card);
    setCurrentPlayerPillz(pillz);
    setCurrentAiCard(ai.card);
    setCurrentAiPillz(ai.pillz);

    const result = resolveRound(card, pillz, ai.card, ai.pillz, playerHand, aiDeck);
    setCurrentResult(result);

    setPlayerPillz((p) => Math.max(0, p - pillz));
    setAiPillz((p) => Math.max(0, p - ai.pillz));

    if (card.uid) setPlayerCardsUsed((prev) => [...prev, card.uid!]);
    if (ai.card.uid) setAiCardsUsed((prev) => [...prev, ai.card.uid!]);

    setRoundLog((prev) => [
      ...prev,
      {
        round,
        playerCard: card,
        playerPillz: pillz,
        aiCard: ai.card,
        aiPillz: ai.pillz,
        winner: result.winner,
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
      },
    ]);

    // Play card swoosh
    playCardSwoosh();

    setBattlePhase('vs');

    vsTimerRef.current = setTimeout(() => {
      // Play VS dramatic sound
      playVS();
      // Play ability activation sound
      playAbility();

      setBattlePhase('damage');

      damageTimerRef.current = setTimeout(() => {
        let newPlayerHP = playerHPRef.current;
        let newAiHP = aiHPRef.current;

        // Apply main damage with visual effects
        if (result.winner === 'player') {
          newAiHP = Math.max(0, newAiHP - result.damageDealt);
          if (result.damageDealt > 0) playHit();
          setDamageFlash('ai');
          setScreenShake(true);
          setTimeout(() => setScreenShake(false), 500);
        } else if (result.winner === 'ai') {
          newPlayerHP = Math.max(0, newPlayerHP - result.damageDealt);
          if (result.damageDealt > 0) playHit();
          setDamageFlash('player');
          setScreenShake(true);
          setTimeout(() => setScreenShake(false), 500);
        }

        setTimeout(() => setDamageFlash('none'), 800);

        // Apply heal on loss (loser heals)
        if (result.winner === 'ai') {
          newPlayerHP = Math.min(TOTAL_HP, newPlayerHP + result.healAmount);
          if (result.healAmount > 0) playHeal();
        } else if (result.winner === 'player') {
          newAiHP = Math.min(TOTAL_HP, newAiHP + result.healAmount);
          if (result.healAmount > 0) playHeal();
        }

        // Apply life steal on win (winner heals)
        if (result.winner === 'player') {
          newPlayerHP = Math.min(TOTAL_HP, newPlayerHP + result.lifeStealAmount);
          if (result.lifeStealAmount > 0) playLifeSteal();
        } else if (result.winner === 'ai') {
          newAiHP = Math.min(TOTAL_HP, newAiHP + result.lifeStealAmount);
          if (result.lifeStealAmount > 0) playLifeSteal();
        }

        // Apply poison on loss (extra damage to loser)
        if (result.winner === 'player') {
          newAiHP = Math.max(0, newAiHP - result.poisonAmount);
          if (result.poisonAmount > 0) playPoison();
        } else if (result.winner === 'ai') {
          newPlayerHP = Math.max(0, newPlayerHP - result.poisonAmount);
          if (result.poisonAmount > 0) playPoison();
        }

        setPlayerHP(newPlayerHP);
        setAiHP(newAiHP);

        // KO check — immediate victory if HP reaches 0
        if (newPlayerHP <= 0 || newAiHP <= 0) {
          let r: 'win' | 'loss' | 'draw' = 'draw';
          if (newPlayerHP > newAiHP) { r = 'win'; playVictory(); }
          else if (newAiHP > newPlayerHP) { r = 'loss'; playDefeat(); }
          else if (newPlayerHP <= 0 && newAiHP <= 0) { r = 'draw'; playDraw(); }
          else if (newAiHP <= 0) { r = 'win'; playVictory(); }
          else { r = 'loss'; playDefeat(); }
          setBattleResult(r);
          setBattlePhase('ended');
          if (r === 'win') haptic.notificationOccurred('success');
          else if (r === 'loss') haptic.notificationOccurred('error');
          else haptic.notificationOccurred('warning');
          return;
        }

        const nextRound = round + 1;

        if (nextRound > TOTAL_ROUNDS) {
          let r: 'win' | 'loss' | 'draw' = 'draw';
          if (newPlayerHP > newAiHP) { r = 'win'; playVictory(); }
          else if (newAiHP > newPlayerHP) { r = 'loss'; playDefeat(); }
          else { r = 'draw'; playDraw(); }
          setBattleResult(r);
          setBattlePhase('ended');
          if (r === 'win') haptic.notificationOccurred('success');
          else if (r === 'loss') haptic.notificationOccurred('error');
          else haptic.notificationOccurred('warning');
        } else {
          setRound(nextRound);
          // Urban Rivals: +1 free pillz per round
          setPlayerPillz((p) => Math.min(STARTING_PILLZ, p + FREE_PILLZ_PER_ROUND));
          setAiPillz((p) => Math.min(STARTING_PILLZ, p + FREE_PILLZ_PER_ROUND));
          setCurrentPlayerCard(null);
          setCurrentAiCard(null);
          setCurrentResult(null);
          setBattlePhase('select');
        }
      }, DAMAGE_DURATION);
    }, VS_DURATION);
  }, [pickAiCard, round, battlePhase]);

  handleSelectRef.current = handleSelect;

  useEffect(() => {
    if (timer === 0 && battlePhase === 'select') {
      const firstCard = playerCardsRemaining[0];
      if (firstCard) {
        handleSelectRef.current(firstCard, 0);
      }
    }
  }, [timer, battlePhase, playerCardsRemaining]);

  useEffect(() => {
    return () => {
      if (vsTimerRef.current) clearTimeout(vsTimerRef.current);
      if (damageTimerRef.current) clearTimeout(damageTimerRef.current);
    };
  }, []);

  const handleSurrender = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (vsTimerRef.current) clearTimeout(vsTimerRef.current);
    if (damageTimerRef.current) clearTimeout(damageTimerRef.current);
    setBattleResult('loss');
    setBattlePhase('ended');
  };

  const timerColor =
    timer > 15 ? 'text-neon-green' :
    timer > 5 ? 'text-yellow-400' :
    'text-neon-red';

  return (
    <div className={`flex flex-col h-full w-full max-w-lg mx-auto overflow-hidden relative ${screenShake ? 'animate-damage-shake' : ''}`}>
      {/* Damage Flash Overlay */}
      {damageFlash !== 'none' && (
        <div className={`absolute inset-0 pointer-events-none z-50 ${damageFlash === 'player' ? 'animate-red-flash' : 'animate-green-flash'}`} />
      )}

      {/* Header */}
      <div className="flex justify-between items-center px-3 py-2 shrink-0 relative z-10" style={{
        background: 'rgba(10,10,20,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span className="text-xs text-white/60 font-stats">{t('battle.roundShort')} <span className="text-white font-bold">{round}</span>/{TOTAL_ROUNDS}</span>
        <span className="text-[10px] text-neon-red/70 font-stats">{t('battle.ai')}: <span className="font-bold">{aiPillz}</span> {t('battle.pillzShort')}</span>

        <button
          onClick={handleSurrender}
          className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-white/40 active:text-white/70 active:bg-white/10 transition-all"
        >
          {t('battle.surrender')}
        </button>

        {battlePhase === 'select' && (
          <div className={`text-xl font-bold tabular-nums ${timerColor}`}>
            {timer}s
          </div>
        )}

        {battlePhase !== 'select' && (
          <span className="text-xl font-bold tabular-nums text-white/20">—</span>
        )}

        <span className="text-xs text-white/60">{t('battle.pillzShort')}: {playerPillz}</span>
      </div>

      {/* HP Bars - Urban Rivals Style */}
      <div className="grid grid-cols-2 gap-2 px-3 py-2 shrink-0 relative z-10">
        <div className="flex flex-col gap-1">
          <div className="text-[9px] text-neon-green font-bold flex items-center gap-1 font-display uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
            {t('battle.player')}
          </div>
          <div className="h-4 health-bar-container" style={{
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: damageFlash === 'player' ? '0 0 16px rgba(255,61,0,0.4), inset 0 0 8px rgba(255,61,0,0.2)' : '0 0 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${Math.max(0, (playerHP / TOTAL_HP) * 100)}%`,
                background: 'transparent',
                border: `2px solid ${damageFlash === 'player' ? 'rgba(244,63,94,1)' : 'rgba(0,230,118,1)'}`,
                boxShadow: damageFlash === 'player'
                  ? '0 0 20px rgba(244,63,94,0.9), 0 0 8px rgba(244,63,94,0.8), inset 0 0 10px rgba(244,63,94,0.45)'
                  : '0 0 20px rgba(0,230,118,0.85), 0 0 8px rgba(0,230,118,0.8), inset 0 0 10px rgba(0,230,118,0.4)',
              }}
            />
            {/* Damage number animation */}
            {currentResult?.winner === 'ai' && battlePhase === 'damage' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-black text-red-400 animate-damage-float" style={{ textShadow: '0 0 8px rgba(255,61,0,0.8)' }}>
                  -{currentResult.damageDealt}
                </span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-white font-bold tabular-nums">{playerHP}</span>
            <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.2)' }}>{TOTAL_HP}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-[9px] text-neon-red font-bold flex items-center justify-end gap-1 font-display uppercase tracking-wider">
            {t('battle.ai')}
            <span className="w-1.5 h-1.5 rounded-full bg-neon-red animate-pulse" />
          </div>
          <div className="h-4 health-bar-container" style={{
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: damageFlash === 'ai' ? '0 0 16px rgba(0,230,118,0.4), inset 0 0 8px rgba(0,230,118,0.2)' : '0 0 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${Math.max(0, (aiHP / TOTAL_HP) * 100)}%`,
                background: 'transparent',
                border: `2px solid ${damageFlash === 'ai' ? 'rgba(0,230,118,1)' : 'rgba(244,63,94,1)'}`,
                boxShadow: damageFlash === 'ai'
                  ? '0 0 20px rgba(0,230,118,0.9), 0 0 8px rgba(0,230,118,0.8), inset 0 0 10px rgba(0,230,118,0.45)'
                  : '0 0 20px rgba(244,63,94,0.85), 0 0 8px rgba(244,63,94,0.8), inset 0 0 10px rgba(244,63,94,0.4)',
              }}
            />
            {currentResult?.winner === 'player' && battlePhase === 'damage' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-black text-green-400 animate-damage-float" style={{ textShadow: '0 0 8px rgba(0,230,118,0.8)' }}>
                  -{currentResult.damageDealt}
                </span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.2)' }}>{TOTAL_HP}</span>
            <span className="text-[10px] text-white font-bold tabular-nums">{aiHP}</span>
          </div>
        </div>
      </div>

      {/* AI remaining cards (face down) — веер */}
      {battlePhase === 'select' && (
        <div className="flex justify-center items-end pb-1 shrink-0" style={{ height: 54 }}>
          {(() => {
            const n = aiCardsRemaining.length;
            const mid = (n - 1) / 2;
            const step = n > 1 ? Math.min(12, 40 / (n - 1)) : 0;
            const overlap = n > 5 ? -11 : n > 3 ? -8 : -5;
            return aiCardsRemaining.map((c, i) => {
              const angle = (i - mid) * step;
              const arc = Math.abs(i - mid) * 3;
              return (
                <div
                  key={c.uid}
                  style={{
                    width: 30, height: 42, margin: `0 ${overlap}px`, flexShrink: 0,
                    transformOrigin: '50% 100%',
                    transform: `rotate(${angle}deg) translateY(${arc}px)`,
                    background: '#0a0a0d',
                    border: '1px solid rgba(255,255,255,0.25)',
                    borderRadius: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'rgba(255,255,255,0.35)', fontSize: 14, fontWeight: 700, lineHeight: 1,
                  }}
                >?</div>
              );
            });
          })()}
        </div>
      )}

      {/* Center area */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative z-10">
        {battlePhase === 'select' && (
          <CardSelector cards={playerCardsRemaining} onSelect={handleSelect} maxPillz={playerPillz} />
        )}

        {/* VS screen — Urban Rivals style dramatic reveal */}
        {battlePhase === 'vs' && currentPlayerCard && currentAiCard && currentResult && (
          <div className="flex flex-col items-center gap-3 w-full animate-fade-in px-3 relative">
            {/* Lightning particles during VS */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="absolute w-0.5 h-8 animate-sparkle" style={{
                  background: 'linear-gradient(to bottom, transparent, rgba(0,212,255,0.8), transparent)',
                  left: `${10 + (i * 11) % 80}%`,
                  top: `${20 + (i * 7) % 60}%`,
                  animationDelay: `${i * 0.15}s`,
                  transform: `rotate(${-30 + (i * 15)}deg)`,
                }} />
              ))}
            </div>
            {/* VS Banner */}
            <div className="text-6xl font-black animate-battle-vs relative z-10 font-display" style={{
              color: '#6fb0d6',
              letterSpacing: '0.3em',
              filter: 'drop-shadow(0 0 12px rgba(0,180,255,0.35)) drop-shadow(0 0 24px rgba(0,150,255,0.18))',
            }}>
              VS
            </div>
            <div className="flex items-center gap-3 justify-center w-full">
              {/* Player Card */}
              <div className={`flex flex-col items-center ${currentResult.winner === 'player' ? 'animate-card-win' : currentResult.winner === 'ai' ? 'animate-card-loss' : ''}`}>
                <div className="text-[9px] font-bold text-neon-green mb-1">{t('battle.you')}</div>
                <div className="w-28">
                  <CardComponent card={currentPlayerCard} />
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] text-white/60">{t('battle.pillzShort')}:</span>
                  <span className="text-sm font-bold text-neon-blue">{currentPlayerPillz}</span>
                </div>
              </div>

              {/* Battle Stats Center */}
              <div className="flex flex-col items-center gap-1 min-w-[80px]">
                <div className="text-2xl font-black text-white animate-pulse">
                  {currentResult.playerAttack}
                </div>
                <div className="text-[10px] text-white/30">VS</div>
                <div className="text-2xl font-black text-white animate-pulse" style={{ animationDelay: '0.5s' }}>
                  {currentResult.aiAttack}
                </div>
              </div>

              {/* AI Card */}
              <div className={`flex flex-col items-center ${currentResult.winner === 'ai' ? 'animate-card-win' : currentResult.winner === 'player' ? 'animate-card-loss' : ''}`}>
                <div className="text-[9px] font-bold text-neon-red mb-1">{t('battle.ai')}</div>
                <div className="w-28">
                  <CardComponent card={currentAiCard} />
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] text-white/60">{t('battle.pillzShort')}:</span>
                  <span className="text-sm font-bold text-neon-red">{currentAiPillz}</span>
                </div>
              </div>
            </div>

            {/* Round Result Badge */}
            <div className={`
              text-lg font-black px-4 py-1 rounded-full animate-card-pop
              ${currentResult.winner === 'player' ? 'text-neon-green bg-neon-green/10 border border-neon-green/30' : ''}
              ${currentResult.winner === 'ai' ? 'text-neon-red bg-neon-red/10 border border-neon-red/30' : ''}
              ${currentResult.winner === 'draw' ? 'text-white/50 bg-white/5 border border-white/10' : ''}
            `}>
              {currentResult.winner === 'player' && <span className="inline-flex items-center gap-1.5"><Icon name="fire" size={16} /> {t('battle.victory')}</span>}
              {currentResult.winner === 'ai' && <span className="inline-flex items-center gap-1.5"><Icon name="skull" size={16} /> {t('battle.defeat')}</span>}
              {currentResult.winner === 'draw' && <span className="inline-flex items-center gap-1.5"><Icon name="bolt" size={16} /> {t('battle.draw')}</span>}
            </div>

            {/* Abilities & Effects Row */}
            <div className="flex flex-col gap-2 justify-center w-full max-w-xs">
              <div className="flex flex-wrap gap-2 justify-center">
                {/* Player ability */}
                {currentPlayerCard && (() => {
                  const ab = abilityInfo[currentPlayerCard.ability];
                  const desc = abilityDescriptions[currentPlayerCard.ability];
                  return ab ? (
                    <div className="text-[9px] px-2 py-1 rounded-lg bg-white/5 border border-white/5" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center gap-1">
                        <span style={{ display: 'flex', color: ab.color }}><Icon name={ab.icon} size={11} /></span>
                        <span className="text-white/30 text-[8px]">{t('battle.yours')}</span>
                        <span style={{ color: ab.color, fontWeight: 700 }}>{abilityNames[currentPlayerCard.ability] || currentPlayerCard.ability}</span>
                      </div>
                      {desc && <div className="text-white/40 text-[8px] mt-0.5 leading-tight max-w-[200px]">{desc}</div>}
                    </div>
                  ) : null;
                })()}
                {/* AI ability */}
                {currentAiCard && (() => {
                  const ab = abilityInfo[currentAiCard.ability];
                  const desc = abilityDescriptions[currentAiCard.ability];
                  return ab ? (
                    <div className="text-[9px] px-2 py-1 rounded-lg bg-white/5 border border-white/5" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center gap-1">
                        <span style={{ display: 'flex', color: ab.color }}><Icon name={ab.icon} size={11} /></span>
                        <span className="text-white/30 text-[8px]">{t('battle.enemy')}</span>
                        <span style={{ color: ab.color, fontWeight: 700 }}>{abilityNames[currentAiCard.ability] || currentAiCard.ability}</span>
                      </div>
                      {desc && <div className="text-white/40 text-[8px] mt-0.5 leading-tight max-w-[200px]">{desc}</div>}
                    </div>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Damage Effects */}
            <div className="flex flex-wrap gap-2 justify-center animate-card-pop" style={{ animationDelay: '0.3s' }}>
              {currentResult.damageDealt > 0 && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 font-bold animate-pulse">
                  <Icon name="boom" size={12} /> -{currentResult.damageDealt} HP
                </span>
              )}
              {currentResult.healAmount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-300 border border-green-500/30 font-bold animate-pulse">
                  <Icon name="heart" size={12} /> +{currentResult.healAmount} HP
                </span>
              )}
              {currentResult.lifeStealAmount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                  <Icon name="drop" size={12} /> +{currentResult.lifeStealAmount} HP
                </span>
              )}
              {currentResult.poisonAmount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-lime-500/20 text-lime-300 border border-lime-500/30 font-bold">
                  <Icon name="skull" size={12} /> {currentResult.poisonAmount}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Damage phase — Urban Rivals style impact */}
        {battlePhase === 'damage' && currentResult && (
          <div className="flex flex-col items-center gap-3 w-full px-3 animate-fade-in relative">
            {/* Impact burst */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 rounded-full animate-glow-burst" style={{
                background: currentResult.winner === 'player'
                  ? 'radial-gradient(circle, rgba(0,230,118,0.3) 0%, transparent 70%)'
                  : currentResult.winner === 'ai'
                    ? 'radial-gradient(circle, rgba(255,61,0,0.3) 0%, transparent 70%)'
                    : 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
              }} />
            </div>
            {/* Big Damage Number */}
            <div className={`text-8xl font-black animate-damage-float relative z-10 font-display
              ${currentResult.winner === 'player' ? 'text-neon-green' : ''}
              ${currentResult.winner === 'ai' ? 'text-neon-red' : ''}
              ${currentResult.winner === 'draw' ? 'text-white/50' : ''}
            `} style={{
              textShadow: currentResult.winner === 'player'
                ? '0 0 30px rgba(0,230,118,0.9), 0 0 60px rgba(0,230,118,0.5), 0 4px 8px rgba(0,0,0,0.5)'
                : currentResult.winner === 'ai'
                  ? '0 0 30px rgba(255,61,0,0.9), 0 0 60px rgba(255,61,0,0.5), 0 4px 8px rgba(0,0,0,0.5)'
                  : '0 0 15px rgba(255,255,255,0.4), 0 4px 8px rgba(0,0,0,0.5)',
              letterSpacing: '0.05em',
            }}>
              {currentResult.winner === 'draw' ? 'BLOCK' : `-${currentResult.damageDealt}`}
            </div>
            {/* HP bar flash */}
            <div className={`animate-health-flash text-sm font-bold px-4 py-1.5 rounded-full relative z-10
              ${currentResult.winner === 'player' ? 'text-neon-green bg-neon-green/10 border border-neon-green/30' : ''}
              ${currentResult.winner === 'ai' ? 'text-neon-red bg-neon-red/10 border border-neon-red/30' : ''}
              ${currentResult.winner === 'draw' ? 'text-white/50 bg-white/5 border border-white/10' : ''}
            `}>
              {currentResult.winner === 'player' && <span className="inline-flex items-center gap-1.5"><Icon name="sword" size={14} /> {t('battle.hpAi')} ↓</span>}
              {currentResult.winner === 'ai' && <span className="inline-flex items-center gap-1.5"><Icon name="sword" size={14} /> {t('battle.hpPlayer')} ↓</span>}
              {currentResult.winner === 'draw' && t('battle.draw')}
            </div>
            {/* Skill effects summary */}
            <div className="flex gap-2 text-[10px]">
              {currentResult.healAmount > 0 && (
                <span className="inline-flex items-center gap-1 text-green-300 bg-green-500/10 px-2 py-0.5 rounded-full"><Icon name="heart" size={11} /> +{currentResult.healAmount}</span>
              )}
              {currentResult.lifeStealAmount > 0 && (
                <span className="inline-flex items-center gap-1 text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full"><Icon name="drop" size={11} /> +{currentResult.lifeStealAmount}</span>
              )}
              {currentResult.poisonAmount > 0 && (
                <span className="inline-flex items-center gap-1 text-lime-300 bg-lime-500/10 px-2 py-0.5 rounded-full"><Icon name="skull" size={11} /> {currentResult.poisonAmount}</span>
              )}
            </div>
          </div>
        )}

        {battlePhase === 'ended' && (
          <div className="flex flex-col items-center gap-3 px-4 w-full overflow-y-auto max-h-full relative">
            {/* Victory/Defeat ambient effects */}
            {battleResult === 'win' && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute w-96 h-96 rounded-full animate-pulse-glow" style={{
                  top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                  background: 'radial-gradient(circle, rgba(0,230,118,0.15) 0%, transparent 70%)',
                }} />
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="absolute animate-sparkle" style={{
                    color: ['#00d4ff', '#a855f7', '#00E676', '#7ac7de'][i % 4],
                    top: `${15 + (i * 7) % 70}%`,
                    left: `${5 + (i * 8) % 90}%`,
                    animationDelay: `${i * 0.2}s`,
                    fontSize: `${10 + (i % 3) * 4}px`,
                  }}>✦</div>
                ))}
              </div>
            )}
            {battleResult === 'loss' && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute w-96 h-96 rounded-full" style={{
                  top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                  background: 'radial-gradient(circle, rgba(255,61,0,0.1) 0%, transparent 70%)',
                }} />
              </div>
            )}

            <div className={`
              text-3xl font-black py-5 px-10 rounded-2xl relative z-10 font-display
              ${battleResult === 'win' ? 'text-neon-green bg-neon-green/10 border border-neon-green/30' : ''}
              ${battleResult === 'loss' ? 'text-neon-red bg-neon-red/10 border border-neon-red/30' : ''}
              ${battleResult === 'draw' ? 'text-white bg-white/5 border border-white/10' : ''}
            `} style={{
              boxShadow: battleResult === 'win'
                ? '0 0 40px rgba(0,230,118,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                : battleResult === 'loss'
                  ? '0 0 40px rgba(255,61,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.05)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              letterSpacing: '0.1em',
            }}>
              {battleResult === 'win' && <span className="inline-flex items-center gap-2"><Icon name="trophy" size={20} /> {t('battle.victory')}!</span>}
              {battleResult === 'loss' && <span className="inline-flex items-center gap-2"><Icon name="skull" size={20} /> {t('battle.defeat')}</span>}
              {battleResult === 'draw' && <span className="inline-flex items-center gap-2"><Icon name="bolt" size={20} /> {t('battle.draw')}</span>}
            </div>

            <div className="text-xs text-white/50 text-center relative z-10">
              {playerHP} HP vs {aiHP} HP
            </div>

            <div className="flex flex-col gap-1.5 w-full max-w-xs relative z-10">
              <div className="inline-flex items-center gap-1 text-[8px] text-white/30 uppercase tracking-wider mb-0.5"><Icon name="book" size={9} /> {t('battle.log')}</div>
              {roundLog.map((entry, i) => (
                <div key={i} className="rounded-lg px-2 py-2 text-[10px] animate-card-pop" style={{
                  background: 'rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  animationDelay: `${i * 0.1}s`,
                }}>
                  {/* Header: round + result */}
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

                  {/* Player side */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-neon-green font-bold">{entry.playerCard.name}</span>
                      <span className="text-white/20 inline-flex"><Icon name="bolt" size={10} /></span>
                      <span className="text-white/50">
                        {entry.playerBasePower}
                        {entry.playerFinalPower !== entry.playerBasePower && (
                          <span className="text-neon-blue">→{entry.playerFinalPower}</span>
                        )}
                      </span>
                    </div>
                    <span className="text-white/30">{entry.playerPillz} {t('battle.pillzShort')}</span>
                  </div>
                  <div className="flex items-center justify-between mb-1.5 pl-2">
                    <span className="text-white/30">{t('battle.attack')}:</span>
                    <span className="text-white/60 font-bold">{entry.playerAttack}</span>
                    <span className="text-white/20 text-[8px]">
                      ({entry.playerFinalPower}×(1+{entry.playerPillz})×0.9–1.1)
                    </span>
                  </div>

                  {/* AI side */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-neon-red font-bold">{entry.aiCard.name}</span>
                      <span className="text-white/20 inline-flex"><Icon name="bolt" size={10} /></span>
                      <span className="text-white/50">
                        {entry.aiBasePower}
                        {entry.aiFinalPower !== entry.aiBasePower && (
                          <span className="text-neon-blue">→{entry.aiFinalPower}</span>
                        )}
                      </span>
                    </div>
                    <span className="text-white/30">{entry.aiPillz} {t('battle.pillzShort')}</span>
                  </div>
                  <div className="flex items-center justify-between mb-1.5 pl-2">
                    <span className="text-white/30">{t('battle.attack')}:</span>
                    <span className="text-white/60 font-bold">{entry.aiAttack}</span>
                    <span className="text-white/20 text-[8px]">
                      ({entry.aiFinalPower}×(1+{entry.aiPillz})×0.9–1.1)
                    </span>
                  </div>

                  {/* Result */}
                  <div className="border-t border-white/5 pt-1.5 mt-1 flex items-center justify-between">
                    <span className="text-white/40">{t('battle.total')}:</span>
                    <div className="flex items-center gap-2">
                      {entry.damageDealt > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-red-300 font-bold"><Icon name="boom" size={10} />{entry.damageDealt}</span>
                      )}
                      {entry.healAmount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-green-300"><Icon name="heart" size={10} />+{entry.healAmount}</span>
                      )}
                      {entry.lifeStealAmount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-purple-300"><Icon name="drop" size={10} />+{entry.lifeStealAmount}</span>
                      )}
                      {entry.poisonAmount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-lime-300"><Icon name="skull" size={10} />{entry.poisonAmount}</span>
                      )}
                      {entry.damageDealt === 0 && entry.healAmount === 0 && entry.lifeStealAmount === 0 && entry.poisonAmount === 0 && (
                        <span className="text-white/20">—</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => onBattleEnd(battleResult)}
              className="w-full max-w-xs py-2.5 rounded-lg font-bold text-sm bg-white/5 border border-white/10 text-white/70 active:bg-white/10 active:scale-[0.98] transition-all"
            >
              {t('deck.back')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
