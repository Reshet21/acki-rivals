import { useState } from 'react';
import { useI18n } from '../i18n';
import { useHaptic } from '../hooks/useHaptic';

interface Props {
  onBack: () => void;
}

type Tab = 'about' | 'cards' | 'battle' | 'combos' | 'pvp' | 'wallet';

const tabMeta: { id: Tab; emoji: string; color: string }[] = [
  { id: 'about', emoji: '📜', color: '#00d4ff' },
  { id: 'cards', emoji: '🃏', color: '#a855f7' },
  { id: 'battle', emoji: '⚔️', color: '#FF6D00' },
  { id: 'combos', emoji: '🔗', color: '#fbbf24' },
  { id: 'pvp', emoji: '🌐', color: '#FF3D00' },
  { id: 'wallet', emoji: '👛', color: '#4ade80' },
];

export default function InfoScreen({ onBack }: Props) {
  const { t } = useI18n();
  const { selectionChanged, impactOccurred } = useHaptic();
  const [tab, setTab] = useState<Tab>('about');

  return (
    <div className="flex flex-col h-full w-full max-w-lg mx-auto overflow-hidden" style={{ background: '#050508' }}>
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-0">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => { impactOccurred('soft'); onBack(); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'rgba(255,255,255,0.05)' }}>
            ←
          </button>
          <h1 className="text-lg font-bold" style={{ color: '#FFD700' }}>{t('info.title')}</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto shrink-0 px-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {tabMeta.map(({ id, emoji, color }) => (
          <button
            key={id}
            onClick={() => { selectionChanged(); setTab(id); }}
            className="shrink-0 px-3 py-2 rounded-xl text-[10px] font-bold transition-all whitespace-nowrap active:scale-95"
            style={{
              background: tab === id ? `${color}15` : 'rgba(255,255,255,0.02)',
              border: `1px solid ${tab === id ? `${color}30` : 'rgba(255,255,255,0.05)'}`,
              color: tab === id ? color : 'rgba(255,255,255,0.4)',
            }}
          >
            {emoji} {t(`info.${id}Tab`)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
        {tab === 'about' && <AboutSection />}
        {tab === 'cards' && <CardsSection />}
        {tab === 'battle' && <BattleSection />}
        {tab === 'combos' && <CombosSection />}
        {tab === 'pvp' && <PvpSection />}
        {tab === 'wallet' && <WalletSection />}
      </div>

      {/* Back */}
      <div className="shrink-0 px-4 pb-4 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
        <button onClick={() => { impactOccurred('soft'); onBack(); }} className="w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
          {t('deck.back')}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children, accent }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="text-sm font-bold mb-3" style={{ color: accent || '#00d4ff' }}>{title}</div>
      <div className="text-xs leading-relaxed space-y-2" style={{ color: 'rgba(255,255,255,0.65)' }}>{children}</div>
    </div>
  );
}

function StatBadge({ emoji, label }: { emoji: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)' }}>
      {emoji} {label}
    </span>
  );
}

function AboutSection() {
  return (
    <>
      <Section title="🎯 Что такое ACKI RIVALS?" accent="#00d4ff">
        <p>Это PvP карточная баталия на блокчейне Acki Nacki. Собирай колоду из 8 уникальных карт двух кланов, сражайся с другими игроками и ставь реальные NACKL токены на кон!</p>
        <p className="mt-2 text-white/50 text-[10px]">Бой проходит 4 раунда. Из твоей колоды в 8 карт случайно выбираются 4 — с ними ты и будешь сражаться.</p>
      </Section>

      <Section title="🎮 Как играть" accent="#a855f7">
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-sm shrink-0">1️⃣</span>
            <div>
              <span className="text-white/80 font-bold">Собери колоду</span>
              <p className="text-[10px] text-white/40">Собери 8 карт в меню «Колода»</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-sm shrink-0">2️⃣</span>
            <div>
              <span className="text-white/80 font-bold">Подключи кошелёк</span>
              <p className="text-[10px] text-white/40">AN Wallet с NACKL для ставок</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-sm shrink-0">3️⃣</span>
            <div>
              <span className="text-white/80 font-bold">Создай комнату</span>
              <p className="text-[10px] text-white/40">Укажи ставку в NACKL, поделись кодом с другом</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-sm shrink-0">4️⃣</span>
            <div>
              <span className="text-white/80 font-bold">Сражайся и побеждай</span>
              <p className="text-[10px] text-white/40">Победитель забирает ставку!</p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="💰 Экономика" accent="#fbbf24">
        <p>В игре используется <b>реальный токен NACKL</b> из твоего кошелька AN Wallet.</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <StatBadge emoji="🪙" label="NACKL — токен ставок" />
          <StatBadge emoji="⛽" label="SHELL — газ" />
        </div>
        <p className="text-[10px] text-white/40 mt-2">Никаких фейковых кредитов, никаких наград от нас. Только PvP на реальные токены!</p>
      </Section>
    </>
  );
}

function CardsSection() {
  return (
    <>
      <Section title="🃏 Система карт" accent="#a855f7">
        <p>Всего 50+ уникальных карт в двух кланах. У каждой карты есть:</p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="p-2 rounded-xl" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}>
            <div className="text-xs font-bold" style={{ color: '#60a5fa' }}>⚔️ Сила</div>
            <div className="text-[10px] text-white/50">Определяет атаку в бою</div>
          </div>
          <div className="p-2 rounded-xl" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)' }}>
            <div className="text-xs font-bold" style={{ color: '#f87171' }}>💥 Урон</div>
            <div className="text-[10px] text-white/50">HP, наносимый проигравшему</div>
          </div>
          <div className="p-2 rounded-xl" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)' }}>
            <div className="text-xs font-bold" style={{ color: '#fbbf24' }}>⭐ Звёзды</div>
            <div className="text-[10px] text-white/50">+1 сила и +1 урон за звезду</div>
          </div>
          <div className="p-2 rounded-xl" style={{ background: 'rgba(192,132,252,0.08)', border: '1px solid rgba(192,132,252,0.15)' }}>
            <div className="text-xs font-bold" style={{ color: '#c084fc' }}>🛡️ Способность</div>
            <div className="text-[10px] text-white/50">Уникальный эффект в бою</div>
          </div>
        </div>
      </Section>

      <Section title="⚔️ Клан Неоновых Наемников" accent="#FF6D00">
        <p>Агрессивный клан. Специализируются на атаке и прямом уроне.</p>
        <p className="mt-1"><b>Бонус клана:</b> <span style={{ color: '#4ade80' }}>+1 к силе</span> всех карт клана, когда 2+ карты клана в руке.</p>
      </Section>

      <Section title="🧘 Клан Цифровых Монахов" accent="#00d4ff">
        <p>Защитный клан. Лечение, ослабление врага, контроль.</p>
        <p className="mt-1"><b>Бонус клана:</b> <span style={{ color: '#4ade80' }}>+1 к урону</span> всех карт клана, когда 2+ карты клана в руке.</p>
      </Section>

      <Section title="🌟 Редкость" accent="#fbbf24">
        <div className="space-y-1">
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded flex items-center justify-center text-[8px]" style={{ background: 'rgba(107,114,128,0.3)', color: '#9ca3af' }}>C</span><span style={{ color: '#9ca3af' }}>Обычная</span></div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded flex items-center justify-center text-[8px]" style={{ background: 'rgba(16,185,129,0.3)', color: '#10b981' }}>U</span><span style={{ color: '#10b981' }}>Необычная</span></div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded flex items-center justify-center text-[8px]" style={{ background: 'rgba(59,130,246,0.3)', color: '#3b82f6' }}>R</span><span style={{ color: '#3b82f6' }}>Редкая</span></div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded flex items-center justify-center text-[8px]" style={{ background: 'rgba(168,85,247,0.3)', color: '#a855f7' }}>E</span><span style={{ color: '#a855f7' }}>Эпическая</span></div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded flex items-center justify-center text-[8px]" style={{ background: 'rgba(245,158,11,0.3)', color: '#f59e0b' }}>L</span><span style={{ color: '#f59e0b' }}>Легендарная</span></div>
        </div>
        <p className="text-[10px] text-white/40 mt-2">Чем выше редкость — тем сильнее базовая карта.</p>
      </Section>

      <Section title="⭐ Улучшение карт" accent="#fbbf24">
        <p>Объединяй дубликаты, чтобы повышать звёздность карт. Каждая звезда даёт +1 к силе и +1 к урону.</p>
        <div className="grid grid-cols-5 gap-1 mt-2">
          {[
            { lv: '★0→1', copies: 1 },
            { lv: '★1→2', copies: 1 },
            { lv: '★2→3', copies: 2 },
            { lv: '★3→4', copies: 3 },
            { lv: '★4→5', copies: 4 },
          ].map(({ lv, copies }) => (
            <div key={lv} className="text-center p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="text-[9px] font-bold" style={{ color: '#fbbf24' }}>{lv}</div>
              <div className="text-[8px] text-white/40">{copies} коп.</div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-white/40 mt-1">Максимум ★5. Дубликаты карт получаются из наборов.</p>
      </Section>
    </>
  );
}

function BattleSection() {
  return (
    <>
      <Section title="⚔️ Механика боя" accent="#FF6D00">
        <p>Бой длится до 4 раундов. Твоя задача — снизить HP противника до 0, сохранив свои HP.</p>
        <div className="space-y-2 mt-2">
          <div className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <span className="text-base shrink-0">1️⃣</span>
            <div>
              <span className="text-white/80 text-[11px] font-bold">Выбери карту</span>
              <p className="text-[10px] text-white/40">Из 4 случайных карт своей колоды выбери одну</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <span className="text-base shrink-0">2️⃣</span>
            <div>
              <span className="text-white/80 text-[11px] font-bold">Распредели пиллзы</span>
              <p className="text-[10px] text-white/40">Каждый пиллз увеличивает атаку на 100% от силы карты</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <span className="text-base shrink-0">3️⃣</span>
            <div>
              <span className="text-white/80 text-[11px] font-bold">Узнай результат</span>
              <p className="text-[10px] text-white/40">Победитель наносит свой урон проигравшему</p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="🎯 Расчёт атаки" accent="#00d4ff">
        <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.1)' }}>
          <div className="text-xs font-bold" style={{ color: '#00d4ff' }}>Атака = Сила × (1 + Пиллзы) × (0.9 — 1.1)</div>
          <div className="text-[10px] text-white/40 mt-1">Случайный множитель 0.9–1.1 добавляет элемент удачи</div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="p-2 rounded-xl" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.1)' }}>
            <div className="text-xs font-bold" style={{ color: '#4ade80' }}>0 пиллз</div>
            <div className="text-[10px] text-white/50">Базовая атака силой × 0.9–1.1</div>
          </div>
          <div className="p-2 rounded-xl" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.1)' }}>
            <div className="text-xs font-bold" style={{ color: '#f87171' }}>3 пиллза</div>
            <div className="text-[10px] text-white/50">Атака ×4 (сила × 4 × 0.9–1.1)</div>
          </div>
        </div>
      </Section>

      <Section title="❤️ Пиллзы" accent="#4ade80">
        <p>У тебя есть <b>12 пиллз</b> на всё игру + 1 бесплатный каждый раунд (макс. 16). Трать их с умом!</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <StatBadge emoji="💊" label="12 + 1/раунд" />
          <StatBadge emoji="⚡" label="+100% атаки за пиллз" />
          <StatBadge emoji="⏱️" label="30 сек на ход" />
        </div>
      </Section>

      <Section title="🛡️ Способности" accent="#c084fc">
        <div className="grid grid-cols-1 gap-1.5">
          {[
            { icon: '⚔️', name: 'Укрепление', desc: 'Даёт +N к силе карты в раунде', color: '#60a5fa' },
            { icon: '🛡️', name: 'Ослабление', desc: 'Снижает силу карты противника на N', color: '#fb923c' },
            { icon: '💥', name: 'Усиление урона', desc: 'Увеличивает урон при победе на N', color: '#f87171' },
            { icon: '💚', name: 'Лечение', desc: 'Восстанавливает N HP при проигрыше в раунде', color: '#4ade80' },
            { icon: '☠️', name: 'Яд', desc: 'Наносит N доп. урона проигравшему', color: '#facc15' },
            { icon: '🩸', name: 'Кража жизни', desc: 'Восстанавливает N HP победителю', color: '#c084fc' },
            { icon: '🚫', name: 'Глушитель', desc: 'Отменяет способность карты противника', color: '#f87171' },
            { icon: '⚡', name: 'Двойной урон', desc: 'Удваивает урон при победе', color: '#fbbf24' },
            { icon: '💊', name: 'Запас', desc: 'Даёт дополнительные пиллзы в этом раунде', color: '#4ade80' },
          ].map(({ icon, name, desc, color }) => (
            <div key={name} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: `${color}06`, border: `1px solid ${color}15` }}>
              <span className="text-base shrink-0">{icon}</span>
              <div>
                <span className="text-[11px] font-bold" style={{ color }}>{name}</span>
                <p className="text-[9px] text-white/40">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="🏆 Победа" accent="#fbbf24">
        <p>После 4 раундов побеждает тот, у кого больше HP. Если у кого-то HP падает до 0 — досрочная победа!</p>
        <p className="mt-1 text-[10px] text-white/40">При одинаковом HP — ничья.</p>
      </Section>
    </>
  );
}

function CombosSection() {
  return (
    <>
      <Section title="🔗 Комбо карты" accent="#fbbf24">
        <p>Когда определённые пары карт оказываются в руке одновременно, активируется комбо-эффект. Карты не обязаны быть сыграны в одном раунде — достаточно иметь их обоих в руке.</p>
      </Section>

      <Section title="⚔️ Комбо Неоновых Наемников" accent="#FF6D00">
        <div className="space-y-1.5">
          {[
            { cards: 'Малый Блок + Курьер Хешей', effect: 'Оба получают +2 к силе' },
            { cards: 'Хеш-Волк + Валидатор', effect: 'Валидатор +2 к урону' },
            { cards: 'Гиперблок + Император Блоков', effect: 'Гиперблок +3 к урону' },
            { cards: 'Тень Блока + Фантомная Нода', effect: 'Кража жизни ×2 у обоих' },
          ].map(({ cards, effect }) => (
            <div key={cards} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <span className="text-[9px] text-white/20 shrink-0">⚔️</span>
              <div>
                <div className="text-[10px] font-bold text-white/80">{cards}</div>
                <div className="text-[9px] text-white/40">{effect}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="🧘 Комбо Цифровых Монахов" accent="#00d4ff">
        <div className="space-y-1.5">
          {[
            { cards: 'Медитативная Нода + Страж Эпохи', effect: 'Оба получают +2 к исцелению' },
            { cards: 'Мастер Эпох + Архонт Блоков', effect: 'Яд ×2 у обоих' },
            { cards: 'Император Кода + Космический Валидатор', effect: '+3 к силе Императора' },
            { cards: 'Будда Блокчейна + Дух Генезиса', effect: 'Исцеление ×3 у Будды' },
          ].map(({ cards, effect }) => (
            <div key={cards} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <span className="text-[9px] text-white/20 shrink-0">🧘</span>
              <div>
                <div className="text-[10px] font-bold text-white/80">{cards}</div>
                <div className="text-[9px] text-white/40">{effect}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="🌐 Кросс-клан комбо" accent="#a855f7">
        <div className="space-y-1.5">
          {[
            { cards: 'Гиперблок + Император Кода', effect: 'Оба +2 к урону' },
            { cards: 'Бог Блокчейна + Будда Блокчейна', effect: 'Оба +3 к силе' },
          ].map(({ cards, effect }) => (
            <div key={cards} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.1)' }}>
              <span className="text-[9px] shrink-0">🌐</span>
              <div>
                <div className="text-[10px] font-bold text-white/80">{cards}</div>
                <div className="text-[9px] text-white/40">{effect}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

function PvpSection() {
  return (
    <>
      <Section title="🌐 PvP на ставки" accent="#FF3D00">
        <p>Сражайся с другими игроками на реальные NACKL токены! Победитель забирает весь банк.</p>
        <div className="p-3 rounded-xl mt-2" style={{ background: 'rgba(255,61,0,0.06)', border: '1px solid rgba(255,61,0,0.15)' }}>
          <div className="text-[10px] font-bold text-center" style={{ color: '#FF3D00' }}>
            ⚔️ Создай комнату → Назначь ставку → Победитель забирает всё!
          </div>
        </div>
      </Section>

      <Section title="🎮 Как начать PvP" accent="#FF6D00">
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-sm shrink-0">1️⃣</span>
            <div>
              <span className="text-white/80 text-[11px] font-bold">Собери колоду</span>
              <p className="text-[9px] text-white/40">Нужно ровно 8 карт в колоде</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-sm shrink-0">2️⃣</span>
            <div>
              <span className="text-white/80 text-[11px] font-bold">Подключи кошелёк</span>
              <p className="text-[9px] text-white/40">AN Wallet с достаточным балансом NACKL</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-sm shrink-0">3️⃣</span>
            <div>
              <span className="text-white/80 text-[11px] font-bold">Выбери режим</span>
              <p className="text-[9px] text-white/40">Случайный бой или комната по коду</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-sm shrink-0">4️⃣</span>
            <div>
              <span className="text-white/80 text-[11px] font-bold">Назначь ставку</span>
              <p className="text-[9px] text-white/40">Сколько NACKL ставишь на кон?</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-sm shrink-0">5️⃣</span>
            <div>
              <span className="text-white/80 text-[11px] font-bold">Сражайся!</span>
              <p className="text-[9px] text-white/40">4 раунда, победитель забирает ставку</p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="📋 Правила" accent="#FF3D00">
        <div className="space-y-1 text-[10px]">
          <p>• <b>Ставка:</b> NACKL из твоего кошелька. Победитель забирает банк.</p>
          <p>• <b>Колода:</b> 8 карт, в бой попадает 4 случайных.</p>
          <p>• <b>Формат:</b> 4 раунда, 12 HP, 12 пиллз + 1/раунд.</p>
          <p>• <b>Код комнаты:</b> Поделись с другом, чтобы сыграть вдвоём.</p>
          <p>• <b>Случайный бой:</b> Автоматический подбор соперника.</p>
          <p>• <b>Условия:</b> Нужен подключённый кошелёк и колода из 8 карт.</p>
        </div>
      </Section>

      <Section title="🔐 Безопасность" accent="#4ade80">
        <p>Транзакции ставок проходят через блокчейн Acki Nacki. Токены NACKL никогда не покидают твой кошелёк без твоего подтверждения через AN Wallet.</p>
      </Section>
    </>
  );
}

function WalletSection() {
  return (
    <>
      <Section title="👛 Подключение кошелька" accent="#4ade80">
        <p>Для игры с реальными ставками тебе понадобится <b>AN Wallet</b>.</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <StatBadge emoji="📱" label="AN Wallet в App Store" />
          <StatBadge emoji="🔗" label="Acki Nacki mainnet" />
          <StatBadge emoji="🪙" label="NACKL для ставок" />
          <StatBadge emoji="⛽" label="SHELL для газа" />
        </div>
      </Section>

      <Section title="🪙 Токены" accent="#fbbf24">
        <div className="space-y-2">
          <div className="p-2 rounded-lg" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.1)' }}>
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🪙</span>
              <div>
                <div className="text-[11px] font-bold" style={{ color: '#FFD700' }}>NACKL</div>
                <div className="text-[9px] text-white/40">Основной токен для ставок в PvP</div>
              </div>
            </div>
          </div>
          <div className="p-2 rounded-lg" style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.1)' }}>
            <div className="flex items-center gap-1.5">
              <span className="text-sm">⛽</span>
              <div>
                <div className="text-[11px] font-bold" style={{ color: '#00d4ff' }}>SHELL</div>
                <div className="text-[9px] text-white/40">Газовый токен для транзакций</div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="📊 Баланс" accent="#00d4ff">
        <p>На главном экране с подключённым кошельком отображаются:</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <StatBadge emoji="👤" label="Имя кошелька" />
          <StatBadge emoji="🪙" label="Баланс NACKL" />
          <StatBadge emoji="⛽" label="Баланс SHELL" />
          <StatBadge emoji="🏆" label="Победы/поражения" />
        </div>
      </Section>
    </>
  );
}
