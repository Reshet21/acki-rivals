import { useState, useEffect, useCallback, useRef } from 'react';
import type { Card } from '../types';
import { cards as allCards } from '../data/cards';
import { resolveRound } from '../utils/battleLogic';
import CardComponent from './CardComponent';
import { useI18n } from '../i18n';
import CardSelector from './CardSelector';
import { useTelegram } from '../telegram';
import { abilityInfo, abilityNames } from '../data/abilityVisuals';

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

const TOTAL_HP = 12;
const TOTAL_ROUNDS = 4;
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

    setBattlePhase('vs');

    vsTimerRef.current = setTimeout(() => {
      setBattlePhase('damage');

      damageTimerRef.current = setTimeout(() => {
        let newPlayerHP = playerHPRef.current;
        let newAiHP = aiHPRef.current;

        // Apply main damage
        if (result.winner === 'player') {
          newAiHP = Math.max(0, newAiHP - result.damageDealt);
        } else if (result.winner === 'ai') {
          newPlayerHP = Math.max(0, newPlayerHP - result.damageDealt);
        }

        // Apply heal on loss (loser heals)
        if (result.winner === 'ai') {
          newPlayerHP = Math.min(TOTAL_HP, newPlayerHP + result.healAmount);
        } else if (result.winner === 'player') {
          newAiHP = Math.min(TOTAL_HP, newAiHP + result.healAmount);
        }

        // Apply life steal on win (winner heals)
        if (result.winner === 'player') {
          newPlayerHP = Math.min(TOTAL_HP, newPlayerHP + result.lifeStealAmount);
        } else if (result.winner === 'ai') {
          newAiHP = Math.min(TOTAL_HP, newAiHP + result.lifeStealAmount);
        }

        // Apply poison on loss (extra damage to loser)
        if (result.winner === 'player') {
          newAiHP = Math.max(0, newAiHP - result.poisonAmount);
        } else if (result.winner === 'ai') {
          newPlayerHP = Math.max(0, newPlayerHP - result.poisonAmount);
        }

        setPlayerHP(newPlayerHP);
        setAiHP(newAiHP);

        // KO check — immediate victory if HP reaches 0
        if (newPlayerHP <= 0 || newAiHP <= 0) {
          let r: 'win' | 'loss' | 'draw' = 'draw';
          if (newPlayerHP > newAiHP) r = 'win';
          else if (newAiHP > newPlayerHP) r = 'loss';
          else if (newPlayerHP <= 0 && newAiHP <= 0) r = 'draw';
          else if (newAiHP <= 0) r = 'win';
          else r = 'loss';
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
          if (newPlayerHP > newAiHP) r = 'win';
          else if (newAiHP > newPlayerHP) r = 'loss';
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
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto overflow-hidden bg-battle relative">
      {/* Ambient particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-1 h-1 bg-neon-blue/20 rounded-full animate-drift" style={{ top: '10%', left: '20%' }} />
        <div className="absolute w-1.5 h-1.5 bg-neon-purple/15 rounded-full animate-drift" style={{ top: '30%', right: '15%', animationDelay: '2s' }} />
        <div className="absolute w-1 h-1 bg-neon-pink/10 rounded-full animate-drift" style={{ top: '60%', left: '10%', animationDelay: '4s' }} />
        <div className="absolute w-1.5 h-1.5 bg-neon-green/10 rounded-full animate-drift" style={{ top: '80%', right: '25%', animationDelay: '6s' }} />
        <div className="absolute w-1 h-1 bg-yellow-400/10 rounded-full animate-drift" style={{ top: '45%', left: '80%', animationDelay: '3s' }} />
      </div>

      {/* Header */}
      <div className="flex justify-between items-center px-3 py-2 bg-dark-card/80 border-b border-dark-border shrink-0">
        <span className="text-xs text-white/60">Р {round}/{TOTAL_ROUNDS}</span>
        <span className="text-[10px] text-neon-red/70">ИИ: {aiPillz} п</span>

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

        <span className="text-xs text-white/60">П: {playerPillz}</span>
      </div>

      {/* HP Bars */}
      <div className="grid grid-cols-2 gap-2 px-3 py-1.5 shrink-0">
        <div className="flex flex-col gap-0.5">
          <div className="text-[9px] text-neon-green font-bold">ИГРОК</div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-neon-green to-emerald-400 rounded-full transition-all duration-700"
              style={{ width: `${(playerHP / TOTAL_HP) * 100}%` }}
            />
          </div>
          <div className="text-[10px] text-white font-bold text-right">{playerHP}</div>
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="text-[9px] text-neon-red font-bold text-right">ИИ</div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-neon-red to-orange-400 rounded-full transition-all duration-700"
              style={{ width: `${(aiHP / TOTAL_HP) * 100}%` }}
            />
          </div>
          <div className="text-[10px] text-white font-bold">{aiHP}</div>
        </div>
      </div>

      {/* AI remaining cards (face down) */}
      {battlePhase === 'select' && (
        <div className="flex justify-center gap-1 pb-1 shrink-0">
          {aiCardsRemaining.map((c) => (
            <div
              key={c.uid}
              className="w-8 h-11 rounded bg-gradient-to-b from-gray-700 to-gray-900 border border-gray-600 flex items-center justify-center text-[8px] text-white/30"
            >
              ???
            </div>
          ))}
        </div>
      )}

      {/* Center area */}
      <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        {battlePhase === 'select' && (
          <CardSelector cards={playerCardsRemaining} onSelect={handleSelect} maxPillz={playerPillz} />
        )}

        {/* VS screen — first 2 seconds */}
        {battlePhase === 'vs' && currentPlayerCard && currentAiCard && currentResult && (
          <div className="flex flex-col items-center gap-3 w-full animate-fade-in px-3">
            <div className="flex items-center gap-4 justify-center">
              <div className="flex flex-col items-center">
                <div className="text-[9px] text-neon-green mb-0.5">Вы</div>
                <CardComponent card={currentPlayerCard} compact />
                <div className="text-[10px] text-white/60 mt-0.5">П: {currentPlayerPillz}</div>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="text-3xl font-black text-white">
                  {currentResult.playerAttack} <span className="text-white/30">vs</span> {currentResult.aiAttack}
                </div>
                <div className={`
                  text-lg font-black
                  ${currentResult.winner === 'player' ? 'text-neon-green' : ''}
                  ${currentResult.winner === 'ai' ? 'text-neon-red' : ''}
                  ${currentResult.winner === 'draw' ? 'text-white/50' : ''}
                `}>
                  {currentResult.winner === 'player' && `⚔️ ${t('battle.victory')}`}
                  {currentResult.winner === 'ai' && `⚔️ ${t('battle.defeat')}`}
                  {currentResult.winner === 'draw' && `⚔️ ${t('battle.draw')}`}
                </div>
                {/* Ability display */}
                <div className="flex flex-col gap-1 mt-1 w-full max-w-[200px]">
                  {currentPlayerCard && (() => {
                    const ab = abilityInfo[currentPlayerCard.ability];
                    return ab ? (
                      <div className="flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded bg-white/5">
                        <span>{ab.icon}</span>
                        <span className="text-white/40">Ваша:</span>
                        <span style={{ color: ab.color }}>{abilityNames[currentPlayerCard.ability] || currentPlayerCard.ability}</span>
                      </div>
                    ) : null;
                  })()}
                  {currentAiCard && (() => {
                    const ab = abilityInfo[currentAiCard.ability];
                    return ab ? (
                      <div className="flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded bg-white/5">
                        <span>{ab.icon}</span>
                        <span className="text-white/40">Врага:</span>
                        <span style={{ color: ab.color }}>{abilityNames[currentAiCard.ability] || currentAiCard.ability}</span>
                      </div>
                    ) : null;
                  })()}
                </div>

                {/* Secondary effects */}
                <div className="flex flex-wrap gap-1 justify-center">
                  {currentResult.damageDealt > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">
                      -{currentResult.damageDealt} HP
                    </span>
                  )}
                  {currentResult.healAmount > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-300">
                      +{currentResult.healAmount} HP
                    </span>
                  )}
                  {currentResult.lifeStealAmount > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                      +{currentResult.lifeStealAmount} HP
                    </span>
                  )}
                  {currentResult.poisonAmount > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300">
                      ☠️ {currentResult.poisonAmount}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-center">
                <div className="text-[9px] text-neon-red mb-0.5">ИИ</div>
                <CardComponent card={currentAiCard} compact />
                <div className="text-[10px] text-white/60 mt-0.5">П: {currentAiPillz}</div>
              </div>
            </div>
          </div>
        )}

        {/* Damage phase — next 2 seconds */}
        {battlePhase === 'damage' && currentResult && (
          <div className="flex flex-col items-center gap-2 w-full px-3">
            <div className={`
              text-4xl font-black animate-bounce
              ${currentResult.winner === 'player' ? 'text-neon-red' : ''}
              ${currentResult.winner === 'ai' ? 'text-red-500' : ''}
              ${currentResult.winner === 'draw' ? 'text-white/30' : ''}
            `}>
              {currentResult.winner === 'draw' && '0'}
              {currentResult.winner === 'player' && `-${currentResult.damageDealt}`}
              {currentResult.winner === 'ai' && `-${currentResult.damageDealt}`}
            </div>
            <div className={`
              text-sm font-bold
              ${currentResult.winner === 'player' ? 'text-neon-red' : ''}
              ${currentResult.winner === 'ai' ? 'text-red-400' : ''}
              ${currentResult.winner === 'draw' ? 'text-white/30' : ''}
            `}>
              {currentResult.winner === 'player' && 'HP ИИ'}
              {currentResult.winner === 'ai' && 'HP ИГРОКА'}
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
              {playerHP} HP vs {aiHP} HP
            </div>

            <div className="flex flex-col gap-1.5 w-full max-w-xs">
              <div className="text-[8px] text-white/30 uppercase tracking-wider mb-0.5">📜 Лог боя</div>
              {roundLog.map((entry, i) => (
                <div key={i} className="bg-white/5 rounded-lg px-2 py-2 text-[10px]">
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
                      <span className="text-white/20">⚡</span>
                      <span className="text-white/50">
                        {entry.playerBasePower}
                        {entry.playerFinalPower !== entry.playerBasePower && (
                          <span className="text-neon-blue">→{entry.playerFinalPower}</span>
                        )}
                      </span>
                    </div>
                    <span className="text-white/30">{entry.playerPillz} п</span>
                  </div>
                  <div className="flex items-center justify-between mb-1.5 pl-2">
                    <span className="text-white/30">Атака:</span>
                    <span className="text-white/60 font-bold">{entry.playerAttack}</span>
                    <span className="text-white/20 text-[8px]">
                      ({entry.playerFinalPower}×(1+{entry.playerPillz})×0.9–1.1)
                    </span>
                  </div>

                  {/* AI side */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-neon-red font-bold">{entry.aiCard.name}</span>
                      <span className="text-white/20">⚡</span>
                      <span className="text-white/50">
                        {entry.aiBasePower}
                        {entry.aiFinalPower !== entry.aiBasePower && (
                          <span className="text-neon-blue">→{entry.aiFinalPower}</span>
                        )}
                      </span>
                    </div>
                    <span className="text-white/30">{entry.aiPillz} п</span>
                  </div>
                  <div className="flex items-center justify-between mb-1.5 pl-2">
                    <span className="text-white/30">Атака:</span>
                    <span className="text-white/60 font-bold">{entry.aiAttack}</span>
                    <span className="text-white/20 text-[8px]">
                      ({entry.aiFinalPower}×(1+{entry.aiPillz})×0.9–1.1)
                    </span>
                  </div>

                  {/* Result */}
                  <div className="border-t border-white/5 pt-1.5 mt-1 flex items-center justify-between">
                    <span className="text-white/40">Итого:</span>
                    <div className="flex items-center gap-2">
                      {entry.damageDealt > 0 && (
                        <span className="text-red-300 font-bold">💥{entry.damageDealt}</span>
                      )}
                      {entry.healAmount > 0 && (
                        <span className="text-green-300">💚+{entry.healAmount}</span>
                      )}
                      {entry.lifeStealAmount > 0 && (
                        <span className="text-purple-300">💜+{entry.lifeStealAmount}</span>
                      )}
                      {entry.poisonAmount > 0 && (
                        <span className="text-yellow-300">☠️{entry.poisonAmount}</span>
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
              className="w-full max-w-xs py-2.5 rounded-lg font-bold text-base
                bg-gradient-to-r from-neon-purple to-neon-blue
                active:scale-95
                transition-all duration-150
                shadow-[0_0_16px_rgba(183,66,255,0.3)]
                text-white"
            >
              {t('deck.back')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
