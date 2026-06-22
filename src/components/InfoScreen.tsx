import { useState } from 'react';

interface Props {
  onBack: () => void;
}

type Tab = 'about' | 'cards' | 'battle' | 'packs' | 'pvp';

export default function InfoScreen({ onBack }: Props) {
  const [tab, setTab] = useState<Tab>('about');

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-dark-border shrink-0 overflow-x-auto">
        {([
          { id: 'about' as Tab, label: '📜 Обзор' },
          { id: 'cards' as Tab, label: '🃏 Карты' },
          { id: 'battle' as Tab, label: '⚔️ Бой' },
          { id: 'packs' as Tab, label: '📦 Наборы' },
          { id: 'pvp' as Tab, label: '🌐 PvP' },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-3 py-2 text-[10px] font-bold transition-colors whitespace-nowrap ${
              tab === t.id ? 'text-neon-blue border-b-2 border-neon-blue' : 'text-white/40'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {tab === 'about' && <AboutSection />}
        {tab === 'cards' && <CardsSection />}
        {tab === 'battle' && <BattleSection />}
        {tab === 'packs' && <PacksSection />}
        {tab === 'pvp' && <PvpSection />}
      </div>

      {/* Back */}
      <div className="shrink-0 px-4 pb-3">
        <button onClick={onBack} className="w-full py-2.5 rounded-lg font-bold text-sm bg-white/5 border border-white/10 text-white/60 active:bg-white/10 transition-all">
          Назад
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-sm font-bold text-neon-blue mb-2">{title}</div>
      <div className="text-xs text-white/60 leading-relaxed space-y-1.5">{children}</div>
    </div>
  );
}

function AboutSection() {
  return (
    <>
      <Section title="🎯 Что такое ACKI RIVALS?">
        <p>Карточная баталия на блокчейне acki-nacki. Собирай колоду, улучшай карты, сражайся с ИИ или реальными игроками.</p>
      </Section>
      <Section title="💰 Игровая валюта">
        <p>Стартовый баланс: 1000 кредитов. Получай кредиты за победы (+50) и майнинг (+10 каждые 60 сек).</p>
      </Section>
      <Section title="📚 Колода">
        <p>Собери колоду из 4 карт в меню «Колода». Каждая карта уникальна — у неё есть сила, урон и способность. Дубликаты можно объединять для улучшения.</p>
      </Section>
      <Section title="🃏 Карты">
        <p>33 карты двух кланов:</p>
        <p>⚔️ <b>Неоновые Наемники</b> — агрессивные, высокий урон</p>
        <p>🧘 <b>Цифровые Монахи</b> —防御ные, исцеление и яд</p>
        <p>5 уровней редкости: Обычная → Необычная → Редкая → Эпическая → Легендарная</p>
      </Section>
      <Section title="⭐ Улучшение карт">
        <p>Объединяй дубликаты в меню «Улучшить»:</p>
        <p>★0→★1: 1 доп. копия (+1 сила, +1 урон)</p>
        <p>★1→★2: 1 доп. копия (+1 сила, +1 урон)</p>
        <p>★2→★3: 2 доп. копии</p>
        <p>★3→★4: 3 доп. копии</p>
        <p>★4→★5: 4 доп. копии</p>
      </Section>
    </>
  );
}

function CardsSection() {
  return (
    <>
      <Section title="🃏 Система карт">
        <p>Каждая карта имеет:</p>
        <p>• <b>Сила</b> — определяет атаку (сила × (1 + пиллз) × 0.9–1.1)</p>
        <p>• <b>Урон</b> — HP наносится проигравшему</p>
        <p>• <b>Способность</b> — уникальный эффект</p>
      </Section>
      <Section title="⚔️ Клан Неоновых Наемников">
        <p>Агрессивный клан. Высокая сила и урон.</p>
        <p>Обычные: Ржавый Дрон, Патрульный, Взломщик, Снайпер, Курьер</p>
        <p>Необычные: Фантом, Кибер-Убийца, Рейдер, Диверсант</p>
        <p>Редкие: Кибер-Волк, Рыцарь, Тень, Убийца</p>
        <p>Эпические: Император, Кибер-Паладин</p>
        <p>Легендарные: Берсерк, Неоновый Бог</p>
      </Section>
      <Section title="🧘 Клан Цифровых Монахов">
        <p>Защитный клан. Исцеление, яд, дебаффы.</p>
        <p>Обычные: Светлячок, Медитативный, Послушник, Тотем, Монах-Страж</p>
        <p>Необычные: Дзен-Воин, Страж Храма, Целитель, Отравитель</p>
        <p>Редкие: Шептун, Мастер, Страж, Дух Предков</p>
        <p>Эпические: Космический Страж, Архонт</p>
        <p>Легендарные: Император Кода, Будда Машин</p>
      </Section>
      <Section title="🌟 Уровни редкости">
        <p>🟢 Обычная — базовые карты, часто выпадают</p>
        <p>🟢 Необычная — чуть сильнее</p>
        <p>🔵 Редкая — хорошие статы и способности</p>
        <p>🟣 Эпическая — мощные комбо</p>
        <p>🟡 Легендарная — уникальные способности, сильнейшие карты</p>
      </Section>
      <Section title="⭐ Улучшение">
        <p>Каждая ★ добавляет +1 к силе и +1 к урону. Максимум ★5.</p>
        <p>Стоимость: ★1 → 1 доп. копия, ★2 → 1, ★3 → 2, ★4 → 3, ★5 → 4.</p>
      </Section>
    </>
  );
}

function BattleSection() {
  return (
    <>
      <Section title="⚔️ Механика боя">
        <p>Бой идёт 4 раунда. В каждом раунде:</p>
        <p>1. Выбери карту из колоды</p>
        <p>2. Выбери сколько пиллз потратить (0–12 на всю игру)</p>
        <p>3. Нажми «Атаковать»</p>
      </Section>
      <Section title="🎯 Расчёт атаки">
        <p><b>Атака = Сила × (1 + Пиллз) × (0.9–1.1)</b></p>
        <p>Каждый пиллз увеличивает атаку на 100% от силы.</p>
        <p>Случайный коэффициент 0.9–1.1 добавляет элемент удачи.</p>
      </Section>
      <Section title="💥 Расчёт урона">
        <p>Победитель наносит <b>свой урон</b> проигравшему.</p>
        <p>Ничья — урон не наносится.</p>
      </Section>
      <Section title="❤️ Пиллзы">
        <p>12 пиллз на всю игру (4 раунда).</p>
        <p>Потраченные не восстанавливаются.</p>
        <p>Экономь: потратив 3 пиллза, ты увеличиваешь атаку на 300% от силы.</p>
      </Section>
      <Section title="🏆 Победитель">
        <p>После 4 раундов побеждает тот, у кого больше HP.</p>
        <p>HP не падает ниже 0, но раунды продолжаются.</p>
      </Section>
      <Section title="🛡️ Способности">
        <p>Способности срабатывают автоматически:</p>
        <p>• <b>Укрепление</b> — +N к силе</p>
        <p>• <b>Ослабление</b> — -N к силе противника</p>
        <p>• <b>Броня</b> — -N к урону противника</p>
        <p>• <b>Исцеление</b> — +N HP при проигрыше</p>
        <p>• <b>Яд</b> — +N доп. урона при проигрыше</p>
        <p>• <b>Кража жизни</b> — +N HP при победе</p>
        <p>• <b>Глушитель</b> — отменяет способность противника</p>
      </Section>
      <Section title="⏱️ Таймер">
        <p>45 секунд на выбор карты.</p>
        <p>При истечении автоматически выбирается первая карта с 0 пиллз.</p>
      </Section>
    </>
  );
}

function PacksSection() {
  return (
    <>
      <Section title="📦 Магазин наборов">
        <p>Покупай наборы за кредиты. Каждый набор даёт 5 случайных карт.</p>
      </Section>
      <Section title="🟢 Базовый (500 кредитов)">
        <p>5 карт: 80% Обычные, 20% Необычные</p>
        <p>Для начинающих — собери базу карт.</p>
      </Section>
      <Section title="🔵 Стандартный (700 кредитов)">
        <p>5 карт: 60% Обычные, 30% Необычные, 10% Редкие</p>
        <p>Хороший баланс цена/качество.</p>
      </Section>
      <Section title="🟣 Продвинутый (1000 кредитов)">
        <p>5 карт: 50% Необычные, 25% Редкие, 15% Эпические, 10% Легендарные</p>
        <p>Лучший шанс на сильные карты!</p>
      </Section>
      <Section title="💰 Как заработать кредиты">
        <p>• Старт: 1000 кредитов</p>
        <p>• Победа в бою: +50 кредитов</p>
        <p>• Майнинг: +10 каждые 60 секунд</p>
      </Section>
    </>
  );
}

function PvpSection() {
  return (
    <>
      <Section title="🌐 PvP бои">
        <p>Сражайся с реальными игроками в асинхронном режиме.</p>
      </Section>
      <Section title="🎮 Как начать PvP">
        <p>1. Собери колоду из 4 карт</p>
        <p>2. Нажми «🌐 PvP Бой»</p>
        <p>3. Создай игру или присоединись к существующей</p>
        <p>4. Делись кодом игры с другом</p>
      </Section>
      <Section title="📋 Правила PvP">
        <p>Такие же как в бою с ИИ:</p>
        <p>• 4 раунда</p>
        <p>• 12 пиллз на всю игру</p>
        <p>• Каждый делает ход по очереди</p>
        <p>• Побеждает тот, у кого больше HP после 4 раундов</p>
      </Section>
      <Section title="🔗 Подключение к блокчейну">
        <p>Для полной интеграции с acki-nacki нужен APP_ID.</p>
        <p>Пока что PvP работает через Supabase.</p>
      </Section>
    </>
  );
}
