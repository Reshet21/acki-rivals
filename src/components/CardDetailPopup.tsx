import { useState } from 'react';
import type { Card } from '../types';
import { useI18n } from '../i18n';
import { getCardName, getAbilityName, getClanName, getRarityLabel } from '../i18n/cardTranslations';
import { clanBonuses, comboAbilities } from '../data/cards';

const abInfo: Record<string, { icon: string; color: string }> = {
  '+1 power': { icon: '⚔️', color: '#60a5fa' }, '+2 power': { icon: '⚔️', color: '#93c5fd' },
  '+3 power': { icon: '⚔️', color: '#bfdbfe' }, '+4 power': { icon: '⚔️', color: '#67e8f9' },
  '+1 damage': { icon: '💥', color: '#f87171' }, '+2 damage': { icon: '💥', color: '#fca5a5' },
  '+1 pillz': { icon: '💊', color: '#4ade80' }, '+3 pillz': { icon: '💊', color: '#86efac' },
  '-1 opponent power': { icon: '🛡️', color: '#fb923c' }, '-2 opponent power': { icon: '🛡️', color: '#fdba74' },
  '-2 opponent damage': { icon: '🛡️', color: '#fb923c' },
  'heal 1': { icon: '💚', color: '#4ade80' }, 'heal 2': { icon: '💚', color: '#86efac' }, 'heal 3': { icon: '💚', color: '#bbf7d0' },
  'poison 1': { icon: '☠️', color: '#facc15' }, 'poison 2': { icon: '☠️', color: '#fde047' }, 'poison 3': { icon: '☠️', color: '#fef08a' },
  'life steal 1': { icon: '🩸', color: '#c084fc' }, 'life steal 2': { icon: '🩸', color: '#d8b4fe' }, 'life steal 3': { icon: '🩸', color: '#e9d5ff' },
  'stop opponent ability': { icon: '🚫', color: '#f87171' }, 'double damage': { icon: '⚡', color: '#fde047' },
};

const cardArt: Record<number, string> = {
  1:'/cards/card-rusty-drone.png',2:'/cards/card-patrol.png',3:'/cards/card-hacker.png',
  4:'/cards/card-neon-sniper.png',5:'/cards/card-cyber-wolf.png',6:'/cards/card-circuit-guardian.jpeg',
  7:'/cards/card-phantom.png',8:'/cards/card-acki-nacki.jpeg',9:'/cards/card-mamabord.jpeg',
  10:'/cards/card-mamabord.jpeg',11:'/cards/card-block-keeper.jpeg',12:'/cards/card-block-keeper.jpeg',
  13:'/cards/card-block-keeper.jpeg',14:'/cards/card-block-manager.jpeg',15:'/cards/card-block-manager.jpeg',
  16:'/cards/card-block-manager.jpeg',17:'/cards/card-malicious-block.jpeg',18:'/cards/card-circuit-guardian.jpeg',
  19:'/cards/card-phantom.png',20:'/cards/card-cyber-killer.png',21:'/cards/card-mamabord.jpeg',
  22:'/cards/card-block-keeper.jpeg',23:'/cards/card-courier.png',24:'/cards/card-raider.png',
  25:'/cards/card-saboteur.png',26:'/cards/card-cyber-killer.png',27:'/cards/card-circuit-guardian.jpeg',
  28:'/cards/card-malicious-block.jpeg',29:'/cards/card-block-keeper.jpeg',30:'/cards/card-mamabord.jpeg',
  31:'/cards/card-saboteur.png',32:'/cards/card-block-keeper.jpeg',33:'/cards/card-circuit-guardian.jpeg',
  34:'/cards/card-malicious-block.jpeg',35:'/cards/card-rusty-drone.png',36:'/cards/card-saboteur.png',
  37:'/cards/card-neon-sniper.png',38:'/cards/card-malicious-block.jpeg',39:'/cards/card-cyber-wolf.png',
  40:'/cards/card-mamabord.jpeg',41:'/cards/card-block-keeper.jpeg',42:'/cards/card-circuit-guardian.jpeg',
  43:'/cards/card-block-manager.jpeg',44:'/cards/card-malicious-block.jpeg',
};

const rarityColor: Record<string, string> = {
  common: '#6b7280', uncommon: '#10b981', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b',
};

const abDesc: Record<string, string> = {
  '+1 power': 'Увеличивает силу на 1', '+2 power': 'Увеличивает силу на 2',
  '+3 power': 'Увеличивает силу на 3', '+4 power': 'Увеличивает силу на 4',
  '+1 damage': 'Увеличивает урон на 1', '+2 damage': 'Увеличивает урон на 2',
  '+1 pillz': 'Даёт 1 доп. пиллз', '+3 pillz': 'Даёт 3 доп. пиллза',
  '-1 opponent power': 'Ослабляет силу врага на 1', '-2 opponent power': 'Ослабляет силу врага на 2',
  '-2 opponent damage': 'Уменьшает урон врага на 2',
  'heal 1': 'Исцеляет 1 HP при поражении', 'heal 2': 'Исцеляет 2 HP при поражении',
  'heal 3': 'Исцеляет 3 HP при поражении',
  'poison 1': 'Наносит 1 доп. урон при поражении', 'poison 2': 'Наносит 2 доп. урона',
  'poison 3': 'Наносит 3 доп. урона',
  'life steal 1': 'Крадёт 1 HP при победе', 'life steal 2': 'Крадёт 2 HP при победе',
  'life steal 3': 'Крадёт 3 HP при победе',
  'stop opponent ability': 'Отменяет способность противника', 'double damage': 'Удваивает урон',
};

interface Props {
  card: Card;
  hand?: Card[];
  onClose: () => void;
}

export default function CardDetailPopup({ card, hand, onClose }: Props) {
  const { lang } = useI18n();
  const [tab, setTab] = useState<'info' | 'combo'>('info');
  const name = getCardName(lang, card.id);
  const abilityName = getAbilityName(lang, card.ability);
  const clanName = getClanName(lang, card.clan);
  const rarityLabel = getRarityLabel(lang, card.rarity);
  const rc = rarityColor[card.rarity || 'common'];
  const ab = abDesc[card.ability] || '';

  // Find combos for this card
  const combos = comboAbilities.filter((c) => c.card1 === card.id || c.card2 === card.id);
  const myHand = hand || [card];
  const activeCombos = combos.filter((c) => myHand.some((h) => h.id === c.card1) && myHand.some((h) => h.id === c.card2));

  // Clan bonus
  const clanCount = myHand.filter((h) => h.clan === card.clan).length;
  const clanBonus = clanCount >= 2 ? clanBonuses[card.clan] : null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ width: '90%', maxWidth: 320, background: 'linear-gradient(160deg, #0f0a05, #1a120a, #0f0a05)', borderRadius: 16, border: `2px solid ${rc}40`, overflow: 'hidden', boxShadow: `0 0 40px ${rc}30` }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ position: 'relative', width: '100%', height: 160, overflow: 'hidden', background: '#080503' }}>
          {cardArt[card.id] ? (
            <img src={cardArt[card.id]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, opacity: 0.2 }}>🃏</div>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0f0a05 0%, transparent 50%)' }} />
          <div style={{ position: 'absolute', top: 8, left: 8 }}>
            <div style={{ width: 18, height: 18, borderRadius: 4, background: `radial-gradient(circle at 35% 30%, ${rc}cc, ${rc} 50%, ${rc}80)`, boxShadow: `0 0 10px ${rc}60`, border: '1px solid rgba(255,255,255,0.1)' }} />
          </div>
          <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 8, fontWeight: 700, color: rc, background: 'rgba(0,0,0,0.7)', padding: '2px 8px', borderRadius: 4, border: `1px solid ${rc}40` }}>{rarityLabel}</div>
          <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#e5d5b0', textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>{name}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{clanName}</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Сила</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', textShadow: '0 0 12px rgba(255,255,255,0.3)' }}>{card.power + (card.stars ?? 0)}</div>
          </div>
          <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Урон</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#fca5a5', textShadow: '0 0 12px rgba(252,165,165,0.3)' }}>{card.damage + (card.stars ?? 0)}</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={() => setTab('info')} style={{ flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 700, color: tab === 'info' ? rc : 'rgba(255,255,255,0.4)', borderBottom: tab === 'info' ? `2px solid ${rc}` : '2px solid transparent', background: 'none', border: 'none', cursor: 'pointer' }}>Способность</button>
          <button onClick={() => setTab('combo')} style={{ flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 700, color: tab === 'combo' ? rc : 'rgba(255,255,255,0.4)', borderBottom: tab === 'combo' ? `2px solid ${rc}` : '2px solid transparent', background: 'none', border: 'none', cursor: 'pointer' }}>Комбо {combos.length > 0 && <span style={{ color: '#fbbf24' }}>({combos.length})</span>}</button>
        </div>

        {/* Content */}
        <div style={{ padding: '12px 16px', minHeight: 80 }}>
          {tab === 'info' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{abInfo[card.ability]?.icon || '❓'}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: abInfo[card.ability]?.color || '#fff' }}>{abilityName}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{ab}</div>
                </div>
              </div>
              {clanBonus && (
                <div style={{ padding: '6px 10px', borderRadius: 8, background: `${rc}15`, border: `1px solid ${rc}30`, marginTop: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: rc }}>🏰 {clanBonus.name}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{clanBonus.desc}</div>
                </div>
              )}
            </div>
          )}
          {tab === 'combo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {combos.length === 0 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 12 }}>Нет комбо для этой карты</div>}
              {combos.map((c, i) => {
                const partnerId = c.card1 === card.id ? c.card2 : c.card1;
                const isActive = activeCombos.includes(c);
                return (
                  <div key={i} style={{ padding: '8px 10px', borderRadius: 8, background: isActive ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.03)', border: isActive ? '1px solid rgba(251,191,36,0.3)' : '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>{isActive ? '🔥' : '💤'}</span>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: isActive ? '#fbbf24' : 'rgba(255,255,255,0.5)' }}>{c.name}</div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>С картой #{partnerId}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: isActive ? '#fde047' : 'rgba(255,255,255,0.5)', marginTop: 4 }}>{c.desc}</div>
                    {isActive && <div style={{ fontSize: 8, color: '#fbbf24', marginTop: 2 }}>⚡ Активно!</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Close */}
        <div style={{ padding: '8px 16px 16px' }}>
          <button onClick={onClose} style={{ width: '100%', padding: '10px 0', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}

// Re-export ability info for use in battle
export { abInfo };
