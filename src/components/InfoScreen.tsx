import { useState } from 'react';
import { useI18n } from '../i18n';
import { useHaptic } from '../hooks/useHaptic';

interface Props {
  onBack: () => void;
}

type Tab = 'about' | 'cards' | 'battle' | 'combos' | 'packs' | 'pvp';

export default function InfoScreen({ onBack }: Props) {
  const { t } = useI18n();
  const { selectionChanged, impactOccurred } = useHaptic();
  const [tab, setTab] = useState<Tab>('about');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'about', label: t('info.aboutTab') },
    { id: 'cards', label: t('info.cardsTab') },
    { id: 'battle', label: t('info.battleTab') },
    { id: 'combos', label: t('info.combosTab') },
    { id: 'packs', label: t('info.packsTab') },
    { id: 'pvp', label: t('info.pvpTab') },
  ];

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-dark-border shrink-0 overflow-x-auto">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => { selectionChanged(); setTab(tabItem.id); }}
            className={`shrink-0 px-3 py-2 text-[10px] font-bold transition-colors whitespace-nowrap ${
              tab === tabItem.id ? 'text-neon-blue border-b-2 border-neon-blue' : 'text-white/40'
            }`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {tab === 'about' && <AboutSection />}
        {tab === 'cards' && <CardsSection />}
        {tab === 'battle' && <BattleSection />}
        {tab === 'combos' && <CombosSection />}
        {tab === 'packs' && <PacksSection />}
        {tab === 'pvp' && <PvpSection />}
      </div>

      {/* Back */}
      <div className="shrink-0 px-4 pb-3">
        <button onClick={() => { impactOccurred('soft'); onBack(); }} className="w-full py-2.5 rounded-lg font-bold text-sm bg-white/5 border border-white/10 text-white/60 active:bg-white/10 transition-all">
          {t('deck.back')}
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
  const { t } = useI18n();
  return (
    <>
      <Section title={t('info.whatIs')}>
        <p>{t('info.whatIsDesc')}</p>
      </Section>
      <Section title={t('info.currency')}>
        <p>{t('info.currencyDesc')}</p>
      </Section>
      <Section title={t('info.deckInfo')}>
        <p>{t('info.deckInfoDesc')}</p>
      </Section>
      <Section title={t('info.cardsInfo')}>
        <p>{t('info.cardsInfoDesc')}</p>
        <p>{t('info.neonMercs')}</p>
        <p>{t('info.digiMonks')}</p>
        <p>{t('info.rarityLevels')}</p>
      </Section>
      <Section title={t('info.upgradeInfo')}>
        <p>{t('info.upgradeInfoDesc')}</p>
        <p>{t('info.upgrade1')}</p>
        <p>{t('info.upgrade2')}</p>
        <p>{t('info.upgrade3')}</p>
        <p>{t('info.upgrade4')}</p>
        <p>{t('info.upgrade5')}</p>
      </Section>
    </>
  );
}

function CardsSection() {
  const { t } = useI18n();
  return (
    <>
      <Section title={t('info.cardSystem')}>
        <p>{t('info.cardSystemDesc')}</p>
        <p>{t('info.powerDesc')}</p>
        <p>{t('info.damageDesc')}</p>
        <p>{t('info.abilityDesc')}</p>
      </Section>
      <Section title={t('info.neonMercsTitle')}>
        <p>{t('info.neonMercsDesc')}</p>
      </Section>
      <Section title={t('info.digiMonksTitle')}>
        <p>{t('info.digiMonksDesc')}</p>
      </Section>
      <Section title={t('info.rarityTitle')}>
        <p>{t('info.commonRarity')}</p>
        <p>{t('info.uncommonRarity')}</p>
        <p>{t('info.rareRarity')}</p>
        <p>{t('info.epicRarity')}</p>
        <p>{t('info.legendaryRarity')}</p>
      </Section>
      <Section title={t('info.upgradeTitle')}>
        <p>{t('info.upgradeDesc')}</p>
        <p>{t('info.upgradeCost')}</p>
      </Section>
    </>
  );
}

function BattleSection() {
  const { t } = useI18n();
  return (
    <>
      <Section title={t('info.battleMechanics')}>
        <p>{t('info.battleMechanicsDesc')}</p>
        <p>{t('info.battleStep1')}</p>
        <p>{t('info.battleStep2')}</p>
        <p>{t('info.battleStep3')}</p>
      </Section>
      <Section title={t('info.attackCalc')}>
        <p><b>{t('info.attackFormula')}</b></p>
        <p>{t('info.attackDesc')}</p>
      </Section>
      <Section title={t('info.damageCalc')}>
        <p>{t('info.damageCalcDesc')}</p>
      </Section>
      <Section title={t('info.pillzTitle')}>
        <p>{t('info.pillzDesc')}</p>
        <p>{t('info.pillzTip')}</p>
      </Section>
      <Section title={t('info.winnerTitle')}>
        <p>{t('info.winnerDesc')}</p>
      </Section>
      <Section title={t('info.abilitiesTitle')}>
        <p>{t('info.abilitiesDesc')}</p>
        <p>{t('info.abilityStrengthen')}</p>
        <p>{t('info.abilityWeaken')}</p>
        <p>{t('info.abilityArmor')}</p>
        <p>{t('info.abilityHeal')}</p>
        <p>{t('info.abilityPoison')}</p>
        <p>{t('info.abilityLifeSteal')}</p>
        <p>{t('info.abilitySilencer')}</p>
      </Section>
      <Section title={t('info.timerTitle')}>
        <p>{t('info.timerDesc')}</p>
      </Section>
    </>
  );
}

function PacksSection() {
  const { t } = useI18n();
  return (
    <>
      <Section title={t('info.shopTitle')}>
        <p>{t('info.shopDesc')}</p>
      </Section>
      <Section title={t('info.basicPackTitle')}>
        <p>{t('info.basicPackDesc')}</p>
      </Section>
      <Section title={t('info.standardPackTitle')}>
        <p>{t('info.standardPackDesc')}</p>
      </Section>
      <Section title={t('info.advancedPackTitle')}>
        <p>{t('info.advancedPackDesc')}</p>
      </Section>
      <Section title={t('info.earnCreditsTitle')}>
        <p>{t('info.earnCreditsDesc')}</p>
      </Section>
    </>
  );
}

function CombosSection() {
  const { t } = useI18n();
  return (
    <>
      <Section title={t('info.combosTitle')}>
        <p>{t('info.combos')}</p>
      </Section>
      <Section title={t('info.clanNeon')}>
        <p>{t('info.clanNeonBonus')}</p>
        <p>{t('info.combos')}: Дрон+Курьер → +2 силы обоим</p>
        <p>{t('info.combos')}: Волк+Убийца → +2 урона убийце</p>
        <p>{t('info.combos')}: Берсерк+Император → +3 урона берсерку</p>
        <p>{t('info.combos')}: Тень+Фантом → двойная кража жизни</p>
      </Section>
      <Section title={t('info.clanDigi')}>
        <p>{t('info.clanDigiBonus')}</p>
        <p>{t('info.combos')}: Медитативный+Страж → +2 исцеления обоим</p>
        <p>{t('info.combos')}: Мастер+Архонт → двойной яд</p>
        <p>{t('info.combos')}: Император+Страж → +3 силы императору</p>
        <p>{t('info.combos')}: Будда+Дух → тройное исцеление</p>
      </Section>
      <Section title={t('info.crossClan')}>
        <p>Берсерк + Император Кода → +2 урона обоим</p>
        <p>Неоновый Бог + Будда Машин → +3 силы обоим</p>
      </Section>
      <Section title={t('info.howCombosWork')}>
        <p>{t('info.combosAutoActivate')}</p>
        <p>{t('info.combosSeeDetails')}</p>
      </Section>
    </>
  );
}

function PvpSection() {
  const { t } = useI18n();
  return (
    <>
      <Section title={t('info.pvpTitle')}>
        <p>{t('info.pvpDesc')}</p>
      </Section>
      <Section title={t('info.pvpHowToTitle')}>
        <p>{t('info.pvpStep1')}</p>
        <p>{t('info.pvpStep2')}</p>
        <p>{t('info.pvpStep3')}</p>
        <p>{t('info.pvpStep4')}</p>
      </Section>
      <Section title={t('info.pvpRulesTitle')}>
        <p>{t('info.pvpRulesDesc')}</p>
      </Section>
      <Section title={t('info.blockchainTitle')}>
        <p>{t('info.blockchainDesc')}</p>
      </Section>
    </>
  );
}
