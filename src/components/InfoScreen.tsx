import { useState } from 'react';
import { useI18n } from '../i18n';
import { useHaptic } from '../hooks/useHaptic';
import Icon, { type IconName } from './Icon';

interface Props {
  onBack: () => void;
}

type Tab = 'about' | 'cards' | 'battle' | 'combos' | 'pvp' | 'wallet';

const tabMeta: { id: Tab; icon: IconName; color: string }[] = [
  { id: 'about', icon: 'book', color: '#00d4ff' },
  { id: 'cards', icon: 'deck', color: '#a855f7' },
  { id: 'battle', icon: 'sword', color: '#FF6D00' },
  { id: 'combos', icon: 'link', color: '#fbbf24' },
  { id: 'pvp', icon: 'globe', color: '#FF3D00' },
  { id: 'wallet', icon: 'wallet', color: '#4ade80' },
];

// удаляем ВСЕ эмодзи из строки перевода (стрелки → и маркеры • сохраняем)
const stripAllEmoji = (s: string) => s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}]/gu, '').replace(/\s+/g, ' ').trim();

export default function InfoScreen({ onBack }: Props) {
  const { t } = useI18n();
  const ct = (k: string) => stripAllEmoji(t(k));
  const { selectionChanged, impactOccurred } = useHaptic();
  const [tab, setTab] = useState<Tab>('about');

  return (
    <div className="flex flex-col h-full w-full max-w-lg mx-auto overflow-hidden relative" style={{ background: 'transparent' }}>
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-0">
        <div className="relative flex items-center mb-3 h-8">
          <button onClick={() => { impactOccurred('soft'); onBack(); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'rgba(255,255,255,0.05)' }}>
            ←
          </button>
          <h1 className="absolute left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 text-lg font-bold whitespace-nowrap text-white"><Icon name="book" size={16} /> {ct('info.title').replace(/^[^\p{L}\p{N}]+/u, '').trim()}</h1>
        </div>
      </div>

      {/* Tabs — сегментные, как в маркетплейсе */}
      <div className="flex gap-1 overflow-x-auto shrink-0 mx-4 mb-3 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        {tabMeta.map(({ id, icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => { selectionChanged(); setTab(id); }}
              className="shrink-0 px-3 py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap flex items-center gap-1.5"
              style={{ background: active ? 'rgba(255,255,255,0.12)' : 'transparent', color: active ? '#fff' : 'rgba(255,255,255,0.4)' }}
            >
              <Icon name={icon} size={14} />
              {ct(`info.${id}Tab`)}
            </button>
          );
        })}
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
      <div className="text-sm font-bold mb-3 text-center" style={{ color: accent || '#00d4ff' }}>{title.replace(/^[^\p{L}\p{N}]+/u, '').trim()}</div>
      <div className="text-xs leading-relaxed space-y-2" style={{ color: 'rgba(255,255,255,0.65)' }}>{children}</div>
    </div>
  );
}

function StatBadge({ icon, label }: { icon: IconName; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)' }}>
      <Icon name={icon} size={12} /> {label}
    </span>
  );
}

function AboutSection() {
  const { t } = useI18n();
  const ct = (k: string) => stripAllEmoji(t(k));
  return (
    <>
      <Section title={ct('info.aboutTitle1')} accent="#00d4ff">
        <p>{ct('info.aboutDesc1')}</p>
        <p className="mt-2 text-white/50 text-[10px]">{ct('info.aboutSubtitle1')}</p>
      </Section>

      <Section title={ct('info.howToPlay')} accent="#00d4ff">
        <div className="space-y-2">
          {[
            { n: 1, titleKey: 'info.howToStep1Title', descKey: 'info.howToStep1Desc' },
            { n: 2, titleKey: 'info.howToStep2Title', descKey: 'info.howToStep2Desc' },
            { n: 3, titleKey: 'info.howToStep3Title', descKey: 'info.howToStep3Desc' },
            { n: 4, titleKey: 'info.howToStep4Title', descKey: 'info.howToStep4Desc' },
          ].map(({ n, titleKey, descKey }) => (
            <div key={titleKey} className="flex items-start gap-2">
              <span className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white/70" style={{ background: 'rgba(0,212,255,0.25)', border: '1px solid rgba(0,212,255,0.4)' }}>{n}</span>
              <div>
                <span className="text-white/80 font-bold">{ct(titleKey)}</span>
                <p className="text-[10px] text-white/40">{ct(descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={ct('info.economyTitle')} accent="#00d4ff">
        <p>{ct('info.economyDesc')}</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <StatBadge icon="coin" label={ct('info.tokenBetting')} />
          <StatBadge icon="gas" label={ct('info.tokenGas')} />
        </div>
        <p className="text-[10px] text-white/40 mt-2">{ct('info.economyNote')}</p>
      </Section>
    </>
  );
}

function CardsSection() {
  const { t } = useI18n();
  const ct = (k: string) => stripAllEmoji(t(k));
  return (
    <>
      <Section title={ct('info.cardSystemTitle')} accent="#a855f7">
        <p>{ct('info.cardSystemCount')}</p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="p-2 rounded-xl" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)' }}>
            <div className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: '#a855f7' }}><Icon name="sword" size={12} /> {ct('info.powerLabel')}</div>
            <div className="text-[10px] text-white/50">{ct('info.powerShortDesc')}</div>
          </div>
          <div className="p-2 rounded-xl" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)' }}>
            <div className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: '#a855f7' }}><Icon name="boom" size={12} /> {ct('info.damageLabel')}</div>
            <div className="text-[10px] text-white/50">{ct('info.damageShortDesc')}</div>
          </div>
          <div className="p-2 rounded-xl" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)' }}>
            <div className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: '#a855f7' }}><Icon name="star" size={12} /> {ct('info.starsLabel')}</div>
            <div className="text-[10px] text-white/50">{ct('info.starsShortDesc')}</div>
          </div>
          <div className="p-2 rounded-xl" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)' }}>
            <div className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: '#a855f7' }}><Icon name="shield" size={12} /> {ct('info.abilityShortLabel')}</div>
            <div className="text-[10px] text-white/50">{ct('info.abilityShortDesc')}</div>
          </div>
        </div>
      </Section>

      <Section title={ct('info.neonClanTitle')} accent="#a855f7">
        <p>{ct('info.neonClanDesc')}</p>
        <p className="mt-1"><b>{ct('info.clanBonus')}</b> <span style={{ color: '#a855f7' }}>+1 {ct('info.powerLabel')}</span> {ct('info.neonClanBonusText')}</p>
      </Section>

      <Section title={ct('info.digiClanTitle')} accent="#a855f7">
        <p>{ct('info.digiClanDesc')}</p>
        <p className="mt-1"><b>{ct('info.clanBonus')}</b> <span style={{ color: '#a855f7' }}>+1 {ct('info.damageLabel')}</span> {ct('info.digiClanBonusText')}</p>
      </Section>

      <Section title={ct('info.raritySectionTitle')} accent="#a855f7">
        <div className="space-y-1">
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded flex items-center justify-center text-[8px]" style={{ background: 'rgba(107,114,128,0.3)', color: '#9ca3af' }}>C</span><span style={{ color: '#9ca3af' }}>{ct('info.commonName')}</span></div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded flex items-center justify-center text-[8px]" style={{ background: 'rgba(16,185,129,0.3)', color: '#10b981' }}>U</span><span style={{ color: '#10b981' }}>{ct('info.uncommonName')}</span></div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded flex items-center justify-center text-[8px]" style={{ background: 'rgba(59,130,246,0.3)', color: '#3b82f6' }}>R</span><span style={{ color: '#3b82f6' }}>{ct('info.rareName')}</span></div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded flex items-center justify-center text-[8px]" style={{ background: 'rgba(168,85,247,0.3)', color: '#a855f7' }}>E</span><span style={{ color: '#a855f7' }}>{ct('info.epicName')}</span></div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded flex items-center justify-center text-[8px]" style={{ background: 'rgba(245,158,11,0.3)', color: '#f59e0b' }}>L</span><span style={{ color: '#f59e0b' }}>{ct('info.legendaryName')}</span></div>
        </div>
        <p className="text-[10px] text-white/40 mt-2">{ct('info.rarityNote')}</p>
      </Section>

      <Section title={ct('info.upgradeSectionTitle')} accent="#a855f7">
        <p>{ct('info.upgradeSectionDesc')}</p>
        <div className="grid grid-cols-6 gap-1 mt-2">
          {[
            { lv: '★0→1', need: '2×★0' },
            { lv: '★1→2', need: '2×★1' },
            { lv: '★2→3', need: '2×★2' },
            { lv: '★3→4', need: '2×★3' },
            { lv: '★4→5', need: '2×★4' },
            { lv: '★5→6', need: '2×★5' },
          ].map(({ lv, need }) => (
            <div key={lv} className="text-center p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="text-[9px] font-bold" style={{ color: '#a855f7' }}>{lv}</div>
              <div className="text-[8px] text-white/40">{need}</div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-white/40 mt-1">{ct('info.upgradeMaxNote')}</p>
      </Section>
    </>
  );
}

function BattleSection() {
  const { t } = useI18n();
  const ct = (k: string) => stripAllEmoji(t(k));
  return (
    <>
      <Section title={ct('info.battleSectionTitle')} accent="#FF6D00">
        <p>{ct('info.battleSectionDesc')}</p>
        <div className="space-y-2 mt-2">
          {[
            { n: 1, titleKey: 'info.chooseCardTitle', descKey: 'info.chooseCardDesc' },
            { n: 2, titleKey: 'info.distributePillzTitle', descKey: 'info.distributePillzDesc' },
            { n: 3, titleKey: 'info.seeResultTitle', descKey: 'info.seeResultDesc' },
          ].map(({ n, titleKey, descKey }) => (
            <div key={titleKey} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <span className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white/70" style={{ background: 'rgba(255,109,0,0.25)', border: '1px solid rgba(255,109,0,0.4)' }}>{n}</span>
              <div>
                <span className="text-white/80 text-[11px] font-bold">{ct(titleKey)}</span>
                <p className="text-[10px] text-white/40">{ct(descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={ct('info.attackCalcTitle')} accent="#FF6D00">
        <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(255,109,0,0.05)', border: '1px solid rgba(255,109,0,0.1)' }}>
          <div className="text-xs font-bold" style={{ color: '#FF6D00' }}>{ct('info.attackFormulaText')}</div>
          <div className="text-[10px] text-white/40 mt-1">{ct('info.attackRandomNote')}</div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="p-2 rounded-xl" style={{ background: 'rgba(255,109,0,0.06)', border: '1px solid rgba(255,109,0,0.1)' }}>
            <div className="text-xs font-bold" style={{ color: '#FF6D00' }}>{ct('info.zeroPillzLabel')}</div>
            <div className="text-[10px] text-white/50">{ct('info.zeroPillzDesc')}</div>
          </div>
          <div className="p-2 rounded-xl" style={{ background: 'rgba(255,109,0,0.06)', border: '1px solid rgba(255,109,0,0.1)' }}>
            <div className="text-xs font-bold" style={{ color: '#FF6D00' }}>{ct('info.threePillzLabel')}</div>
            <div className="text-[10px] text-white/50">{ct('info.threePillzDesc')}</div>
          </div>
        </div>
      </Section>

      <Section title={ct('info.pillzSectionTitle')} accent="#FF6D00">
        <p>{ct('info.pillzSectionDesc')}</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <StatBadge icon="pill" label={ct('info.pillzStat1')} />
          <StatBadge icon="bolt" label={ct('info.pillzStat2')} />
          <StatBadge icon="clock" label={ct('info.pillzStat3')} />
        </div>
      </Section>

      <Section title={ct('info.abilitiesSectionTitle')} accent="#FF6D00">
        <div className="grid grid-cols-1 gap-1.5">
          {[
            { icon: 'sword', nameKey: 'info.abilityStrengthenShort', descKey: 'info.abilityStrengthenShortDesc', color: '#FF6D00' },
            { icon: 'shield', nameKey: 'info.abilityWeakenShort', descKey: 'info.abilityWeakenShortDesc', color: '#FF6D00' },
            { icon: 'boom', nameKey: 'info.abilityDamageUpShort', descKey: 'info.abilityDamageUpShortDesc', color: '#FF6D00' },
            { icon: 'heart', nameKey: 'info.abilityHealShort', descKey: 'info.abilityHealShortDesc', color: '#FF6D00' },
            { icon: 'skull', nameKey: 'info.abilityPoisonShort', descKey: 'info.abilityPoisonShortDesc', color: '#FF6D00' },
            { icon: 'drop', nameKey: 'info.abilityLifeStealShort', descKey: 'info.abilityLifeStealShortDesc', color: '#FF6D00' },
            { icon: 'ban', nameKey: 'info.abilitySilenceShort', descKey: 'info.abilitySilenceShortDesc', color: '#FF6D00' },
            { icon: 'bolt', nameKey: 'info.abilityDoubleDamageShort', descKey: 'info.abilityDoubleDamageShortDesc', color: '#FF6D00' },
            { icon: 'pill', nameKey: 'info.abilityExtraPillzShort', descKey: 'info.abilityExtraPillzShortDesc', color: '#FF6D00' },
          ].map(({ icon, nameKey, descKey, color }) => (
            <div key={nameKey} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: `${color}06`, border: `1px solid ${color}15` }}>
              <span className="shrink-0 flex mt-0.5" style={{ color }}><Icon name={icon as IconName} size={15} /></span>
              <div>
                <span className="text-[11px] font-bold" style={{ color }}>{ct(nameKey)}</span>
                <p className="text-[9px] text-white/40">{ct(descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={ct('info.winnerSectionTitle')} accent="#FF6D00">
        <p>{ct('info.winnerSectionDesc')}</p>
        <p className="mt-1 text-[10px] text-white/40">{ct('info.winnerDrawNote')}</p>
      </Section>
    </>
  );
}

function CombosSection() {
  const { t } = useI18n();
  const ct = (k: string) => stripAllEmoji(t(k));
  return (
    <>
      <Section title={ct('info.combosSectionTitle')} accent="#fbbf24">
        <p>{ct('info.combosSectionDesc')}</p>
      </Section>

      <Section title={ct('info.neonCombosTitle')} accent="#fbbf24">
        <div className="space-y-1.5">
          {[
            { cardsKey: 'info.combo1Cards', effectKey: 'info.combo1Effect' },
            { cardsKey: 'info.combo2Cards', effectKey: 'info.combo2Effect' },
            { cardsKey: 'info.combo3Cards', effectKey: 'info.combo3Effect' },
            { cardsKey: 'info.combo4Cards', effectKey: 'info.combo4Effect' },
          ].map(({ cardsKey, effectKey }) => (
            <div key={cardsKey} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <span className="text-white/20 shrink-0 inline-flex"><Icon name="sword" size={9} /></span>
              <div>
                <div className="text-[10px] font-bold text-white/80">{ct(cardsKey)}</div>
                <div className="text-[9px] text-white/40">{ct(effectKey)}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={ct('info.digiCombosTitle')} accent="#fbbf24">
        <div className="space-y-1.5">
          {[
            { cardsKey: 'info.combo5Cards', effectKey: 'info.combo5Effect' },
            { cardsKey: 'info.combo6Cards', effectKey: 'info.combo6Effect' },
            { cardsKey: 'info.combo7Cards', effectKey: 'info.combo7Effect' },
            { cardsKey: 'info.combo8Cards', effectKey: 'info.combo8Effect' },
          ].map(({ cardsKey, effectKey }) => (
            <div key={cardsKey} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <span className="text-white/20 shrink-0 inline-flex"><Icon name="zen" size={9} /></span>
              <div>
                <div className="text-[10px] font-bold text-white/80">{ct(cardsKey)}</div>
                <div className="text-[9px] text-white/40">{ct(effectKey)}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={ct('info.crossClanCombosTitle')} accent="#fbbf24">
        <div className="space-y-1.5">
          {[
            { cardsKey: 'info.combo9Cards', effectKey: 'info.combo9Effect' },
            { cardsKey: 'info.combo10Cards', effectKey: 'info.combo10Effect' },
          ].map(({ cardsKey, effectKey }) => (
            <div key={cardsKey} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.1)' }}>
              <span className="shrink-0 inline-flex"><Icon name="globe" size={9} /></span>
              <div>
                <div className="text-[10px] font-bold text-white/80">{ct(cardsKey)}</div>
                <div className="text-[9px] text-white/40">{ct(effectKey)}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

function PvpSection() {
  const { t } = useI18n();
  const ct = (k: string) => stripAllEmoji(t(k));
  return (
    <>
      <Section title={ct('info.pvpSectionTitle')} accent="#FF3D00">
        <p>{ct('info.pvpSectionDesc')}</p>
        <div className="p-3 rounded-xl mt-2" style={{ background: 'rgba(255,61,0,0.06)', border: '1px solid rgba(255,61,0,0.15)' }}>
          <div className="text-[10px] font-bold text-center" style={{ color: '#FF3D00' }}>
            <span className="inline-flex items-center gap-1.5"><Icon name="sword" size={13} /> {ct('info.pvpHighlight')}</span>
          </div>
        </div>
      </Section>

      <Section title={ct('info.pvpHowToSectionTitle')} accent="#FF3D00">
        <div className="space-y-2">
          {[
            { n: 1, titleKey: 'info.pvpStep1Title', descKey: 'info.pvpStep1Desc' },
            { n: 2, titleKey: 'info.pvpStep2Title', descKey: 'info.pvpStep2Desc' },
            { n: 3, titleKey: 'info.pvpStep3Title', descKey: 'info.pvpStep3Desc' },
            { n: 4, titleKey: 'info.pvpStep4Title', descKey: 'info.pvpStep4Desc' },
            { n: 5, titleKey: 'info.pvpStep5Title', descKey: 'info.pvpStep5Desc' },
          ].map(({ n, titleKey, descKey }) => (
            <div key={titleKey} className="flex items-start gap-2">
              <span className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white/70" style={{ background: 'rgba(255,61,0,0.25)', border: '1px solid rgba(255,61,0,0.4)' }}>{n}</span>
              <div>
                <span className="text-white/80 text-[11px] font-bold">{ct(titleKey)}</span>
                <p className="text-[9px] text-white/40">{ct(descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={ct('info.pvpRulesSectionTitle')} accent="#FF3D00">
        <div className="space-y-1 text-[10px]">
          {['info.pvpRule1', 'info.pvpRule2', 'info.pvpRule3', 'info.pvpRule4', 'info.pvpRule5', 'info.pvpRule6'].map((key) => (
            <p key={key}>• {t(key)}</p>
          ))}
        </div>
      </Section>

      <Section title={ct('info.pvpSecuritySectionTitle')} accent="#FF3D00">
        <p>{ct('info.pvpSecurityDesc')}</p>
      </Section>
    </>
  );
}

function WalletSection() {
  const { t } = useI18n();
  const ct = (k: string) => stripAllEmoji(t(k));
  return (
    <>
      <Section title={ct('info.walletConnectSectionTitle')} accent="#4ade80">
        <p>{ct('info.walletConnectSectionDesc')}</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <StatBadge icon="phone" label={ct('info.walletAppStore')} />
          <StatBadge icon="link" label={ct('info.walletMainnet')} />
          <StatBadge icon="coin" label={ct('info.walletForBets')} />
          <StatBadge icon="gas" label={ct('info.walletForGas')} />
        </div>
      </Section>

      <Section title={ct('info.tokensSectionTitle')} accent="#4ade80">
        <div className="space-y-2">
          <div className="p-2 rounded-lg" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.1)' }}>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex text-yellow-400/80"><Icon name="coin" size={14} /></span>
              <div>
                <div className="text-[11px] font-bold" style={{ color: '#4ade80' }}>NACKL</div>
                <div className="text-[9px] text-white/40">{ct('info.tokenNacklDesc')}</div>
              </div>
            </div>
          </div>
          <div className="p-2 rounded-lg" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.1)' }}>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex text-white/50"><Icon name="gas" size={14} /></span>
              <div>
                <div className="text-[11px] font-bold" style={{ color: '#4ade80' }}>SHELL</div>
                <div className="text-[9px] text-white/40">{ct('info.tokenShellDesc')}</div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title={ct('info.balanceSectionTitle')} accent="#4ade80">
        <p>{ct('info.balanceSectionDesc')}</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <StatBadge icon="user" label={ct('info.balanceName')} />
          <StatBadge icon="coin" label={ct('info.balanceNackl')} />
          <StatBadge icon="gas" label={ct('info.balanceShell')} />
          <StatBadge icon="trophy" label={ct('info.balanceStats')} />
        </div>
      </Section>
    </>
  );
}
