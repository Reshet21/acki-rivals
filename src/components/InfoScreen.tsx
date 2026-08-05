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
  const { t } = useI18n();
  return (
    <>
      <Section title={t('info.aboutTitle1')} accent="#00d4ff">
        <p>{t('info.aboutDesc1')}</p>
        <p className="mt-2 text-white/50 text-[10px]">{t('info.aboutSubtitle1')}</p>
      </Section>

      <Section title={t('info.howToPlay')} accent="#a855f7">
        <div className="space-y-2">
          {[
            { emoji: '1️⃣', titleKey: 'info.howToStep1Title', descKey: 'info.howToStep1Desc' },
            { emoji: '2️⃣', titleKey: 'info.howToStep2Title', descKey: 'info.howToStep2Desc' },
            { emoji: '3️⃣', titleKey: 'info.howToStep3Title', descKey: 'info.howToStep3Desc' },
            { emoji: '4️⃣', titleKey: 'info.howToStep4Title', descKey: 'info.howToStep4Desc' },
          ].map(({ emoji, titleKey, descKey }) => (
            <div key={titleKey} className="flex items-start gap-2">
              <span className="text-sm shrink-0">{emoji}</span>
              <div>
                <span className="text-white/80 font-bold">{t(titleKey)}</span>
                <p className="text-[10px] text-white/40">{t(descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t('info.economyTitle')} accent="#fbbf24">
        <p>{t('info.economyDesc')}</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <StatBadge emoji="🪙" label={t('info.tokenBetting')} />
          <StatBadge emoji="⛽" label={t('info.tokenGas')} />
        </div>
        <p className="text-[10px] text-white/40 mt-2">{t('info.economyNote')}</p>
      </Section>
    </>
  );
}

function CardsSection() {
  const { t } = useI18n();
  return (
    <>
      <Section title={t('info.cardSystemTitle')} accent="#a855f7">
        <p>{t('info.cardSystemCount')}</p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="p-2 rounded-xl" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}>
            <div className="text-xs font-bold" style={{ color: '#60a5fa' }}>⚔️ {t('info.powerLabel')}</div>
            <div className="text-[10px] text-white/50">{t('info.powerShortDesc')}</div>
          </div>
          <div className="p-2 rounded-xl" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)' }}>
            <div className="text-xs font-bold" style={{ color: '#f87171' }}>💥 {t('info.damageLabel')}</div>
            <div className="text-[10px] text-white/50">{t('info.damageShortDesc')}</div>
          </div>
          <div className="p-2 rounded-xl" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)' }}>
            <div className="text-xs font-bold" style={{ color: '#fbbf24' }}>⭐ {t('info.starsLabel')}</div>
            <div className="text-[10px] text-white/50">{t('info.starsShortDesc')}</div>
          </div>
          <div className="p-2 rounded-xl" style={{ background: 'rgba(192,132,252,0.08)', border: '1px solid rgba(192,132,252,0.15)' }}>
            <div className="text-xs font-bold" style={{ color: '#c084fc' }}>🛡️ {t('info.abilityShortLabel')}</div>
            <div className="text-[10px] text-white/50">{t('info.abilityShortDesc')}</div>
          </div>
        </div>
      </Section>

      <Section title={t('info.neonClanTitle')} accent="#FF6D00">
        <p>{t('info.neonClanDesc')}</p>
        <p className="mt-1"><b>{t('info.clanBonus')}</b> <span style={{ color: '#4ade80' }}>+1 {t('info.powerLabel')}</span> {t('info.neonClanBonusText')}</p>
      </Section>

      <Section title={t('info.digiClanTitle')} accent="#00d4ff">
        <p>{t('info.digiClanDesc')}</p>
        <p className="mt-1"><b>{t('info.clanBonus')}</b> <span style={{ color: '#4ade80' }}>+1 {t('info.damageLabel')}</span> {t('info.digiClanBonusText')}</p>
      </Section>

      <Section title={t('info.raritySectionTitle')} accent="#fbbf24">
        <div className="space-y-1">
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded flex items-center justify-center text-[8px]" style={{ background: 'rgba(107,114,128,0.3)', color: '#9ca3af' }}>C</span><span style={{ color: '#9ca3af' }}>{t('info.commonName')}</span></div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded flex items-center justify-center text-[8px]" style={{ background: 'rgba(16,185,129,0.3)', color: '#10b981' }}>U</span><span style={{ color: '#10b981' }}>{t('info.uncommonName')}</span></div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded flex items-center justify-center text-[8px]" style={{ background: 'rgba(59,130,246,0.3)', color: '#3b82f6' }}>R</span><span style={{ color: '#3b82f6' }}>{t('info.rareName')}</span></div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded flex items-center justify-center text-[8px]" style={{ background: 'rgba(168,85,247,0.3)', color: '#a855f7' }}>E</span><span style={{ color: '#a855f7' }}>{t('info.epicName')}</span></div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded flex items-center justify-center text-[8px]" style={{ background: 'rgba(245,158,11,0.3)', color: '#f59e0b' }}>L</span><span style={{ color: '#f59e0b' }}>{t('info.legendaryName')}</span></div>
        </div>
        <p className="text-[10px] text-white/40 mt-2">{t('info.rarityNote')}</p>
      </Section>

      <Section title={t('info.upgradeSectionTitle')} accent="#fbbf24">
        <p>{t('info.upgradeSectionDesc')}</p>
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
              <div className="text-[9px] font-bold" style={{ color: '#fbbf24' }}>{lv}</div>
              <div className="text-[8px] text-white/40">{need}</div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-white/40 mt-1">{t('info.upgradeMaxNote')}</p>
      </Section>
    </>
  );
}

function BattleSection() {
  const { t } = useI18n();
  return (
    <>
      <Section title={t('info.battleSectionTitle')} accent="#FF6D00">
        <p>{t('info.battleSectionDesc')}</p>
        <div className="space-y-2 mt-2">
          {[
            { emoji: '1️⃣', titleKey: 'info.chooseCardTitle', descKey: 'info.chooseCardDesc' },
            { emoji: '2️⃣', titleKey: 'info.distributePillzTitle', descKey: 'info.distributePillzDesc' },
            { emoji: '3️⃣', titleKey: 'info.seeResultTitle', descKey: 'info.seeResultDesc' },
          ].map(({ emoji, titleKey, descKey }) => (
            <div key={titleKey} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <span className="text-base shrink-0">{emoji}</span>
              <div>
                <span className="text-white/80 text-[11px] font-bold">{t(titleKey)}</span>
                <p className="text-[10px] text-white/40">{t(descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t('info.attackCalcTitle')} accent="#00d4ff">
        <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.1)' }}>
          <div className="text-xs font-bold" style={{ color: '#00d4ff' }}>{t('info.attackFormulaText')}</div>
          <div className="text-[10px] text-white/40 mt-1">{t('info.attackRandomNote')}</div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="p-2 rounded-xl" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.1)' }}>
            <div className="text-xs font-bold" style={{ color: '#4ade80' }}>{t('info.zeroPillzLabel')}</div>
            <div className="text-[10px] text-white/50">{t('info.zeroPillzDesc')}</div>
          </div>
          <div className="p-2 rounded-xl" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.1)' }}>
            <div className="text-xs font-bold" style={{ color: '#f87171' }}>{t('info.threePillzLabel')}</div>
            <div className="text-[10px] text-white/50">{t('info.threePillzDesc')}</div>
          </div>
        </div>
      </Section>

      <Section title={t('info.pillzSectionTitle')} accent="#4ade80">
        <p>{t('info.pillzSectionDesc')}</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <StatBadge emoji="💊" label={t('info.pillzStat1')} />
          <StatBadge emoji="⚡" label={t('info.pillzStat2')} />
          <StatBadge emoji="⏱️" label={t('info.pillzStat3')} />
        </div>
      </Section>

      <Section title={t('info.abilitiesSectionTitle')} accent="#c084fc">
        <div className="grid grid-cols-1 gap-1.5">
          {[
            { icon: '⚔️', nameKey: 'info.abilityStrengthenShort', descKey: 'info.abilityStrengthenShortDesc', color: '#60a5fa' },
            { icon: '🛡️', nameKey: 'info.abilityWeakenShort', descKey: 'info.abilityWeakenShortDesc', color: '#fb923c' },
            { icon: '💥', nameKey: 'info.abilityDamageUpShort', descKey: 'info.abilityDamageUpShortDesc', color: '#f87171' },
            { icon: '💚', nameKey: 'info.abilityHealShort', descKey: 'info.abilityHealShortDesc', color: '#4ade80' },
            { icon: '☠️', nameKey: 'info.abilityPoisonShort', descKey: 'info.abilityPoisonShortDesc', color: '#facc15' },
            { icon: '🩸', nameKey: 'info.abilityLifeStealShort', descKey: 'info.abilityLifeStealShortDesc', color: '#c084fc' },
            { icon: '🚫', nameKey: 'info.abilitySilenceShort', descKey: 'info.abilitySilenceShortDesc', color: '#f87171' },
            { icon: '⚡', nameKey: 'info.abilityDoubleDamageShort', descKey: 'info.abilityDoubleDamageShortDesc', color: '#fbbf24' },
            { icon: '💊', nameKey: 'info.abilityExtraPillzShort', descKey: 'info.abilityExtraPillzShortDesc', color: '#4ade80' },
          ].map(({ icon, nameKey, descKey, color }) => (
            <div key={nameKey} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: `${color}06`, border: `1px solid ${color}15` }}>
              <span className="text-base shrink-0">{icon}</span>
              <div>
                <span className="text-[11px] font-bold" style={{ color }}>{t(nameKey)}</span>
                <p className="text-[9px] text-white/40">{t(descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t('info.winnerSectionTitle')} accent="#fbbf24">
        <p>{t('info.winnerSectionDesc')}</p>
        <p className="mt-1 text-[10px] text-white/40">{t('info.winnerDrawNote')}</p>
      </Section>
    </>
  );
}

function CombosSection() {
  const { t } = useI18n();
  return (
    <>
      <Section title={t('info.combosSectionTitle')} accent="#fbbf24">
        <p>{t('info.combosSectionDesc')}</p>
      </Section>

      <Section title={t('info.neonCombosTitle')} accent="#FF6D00">
        <div className="space-y-1.5">
          {[
            { cardsKey: 'info.combo1Cards', effectKey: 'info.combo1Effect' },
            { cardsKey: 'info.combo2Cards', effectKey: 'info.combo2Effect' },
            { cardsKey: 'info.combo3Cards', effectKey: 'info.combo3Effect' },
            { cardsKey: 'info.combo4Cards', effectKey: 'info.combo4Effect' },
          ].map(({ cardsKey, effectKey }) => (
            <div key={cardsKey} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <span className="text-[9px] text-white/20 shrink-0">⚔️</span>
              <div>
                <div className="text-[10px] font-bold text-white/80">{t(cardsKey)}</div>
                <div className="text-[9px] text-white/40">{t(effectKey)}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t('info.digiCombosTitle')} accent="#00d4ff">
        <div className="space-y-1.5">
          {[
            { cardsKey: 'info.combo5Cards', effectKey: 'info.combo5Effect' },
            { cardsKey: 'info.combo6Cards', effectKey: 'info.combo6Effect' },
            { cardsKey: 'info.combo7Cards', effectKey: 'info.combo7Effect' },
            { cardsKey: 'info.combo8Cards', effectKey: 'info.combo8Effect' },
          ].map(({ cardsKey, effectKey }) => (
            <div key={cardsKey} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <span className="text-[9px] text-white/20 shrink-0">🧘</span>
              <div>
                <div className="text-[10px] font-bold text-white/80">{t(cardsKey)}</div>
                <div className="text-[9px] text-white/40">{t(effectKey)}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t('info.crossClanCombosTitle')} accent="#a855f7">
        <div className="space-y-1.5">
          {[
            { cardsKey: 'info.combo9Cards', effectKey: 'info.combo9Effect' },
            { cardsKey: 'info.combo10Cards', effectKey: 'info.combo10Effect' },
          ].map(({ cardsKey, effectKey }) => (
            <div key={cardsKey} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.1)' }}>
              <span className="text-[9px] shrink-0">🌐</span>
              <div>
                <div className="text-[10px] font-bold text-white/80">{t(cardsKey)}</div>
                <div className="text-[9px] text-white/40">{t(effectKey)}</div>
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
  return (
    <>
      <Section title={t('info.pvpSectionTitle')} accent="#FF3D00">
        <p>{t('info.pvpSectionDesc')}</p>
        <div className="p-3 rounded-xl mt-2" style={{ background: 'rgba(255,61,0,0.06)', border: '1px solid rgba(255,61,0,0.15)' }}>
          <div className="text-[10px] font-bold text-center" style={{ color: '#FF3D00' }}>
            ⚔️ {t('info.pvpHighlight')}
          </div>
        </div>
      </Section>

      <Section title={t('info.pvpHowToSectionTitle')} accent="#FF6D00">
        <div className="space-y-2">
          {[
            { emoji: '1️⃣', titleKey: 'info.pvpStep1Title', descKey: 'info.pvpStep1Desc' },
            { emoji: '2️⃣', titleKey: 'info.pvpStep2Title', descKey: 'info.pvpStep2Desc' },
            { emoji: '3️⃣', titleKey: 'info.pvpStep3Title', descKey: 'info.pvpStep3Desc' },
            { emoji: '4️⃣', titleKey: 'info.pvpStep4Title', descKey: 'info.pvpStep4Desc' },
            { emoji: '5️⃣', titleKey: 'info.pvpStep5Title', descKey: 'info.pvpStep5Desc' },
          ].map(({ emoji, titleKey, descKey }) => (
            <div key={titleKey} className="flex items-start gap-2">
              <span className="text-sm shrink-0">{emoji}</span>
              <div>
                <span className="text-white/80 text-[11px] font-bold">{t(titleKey)}</span>
                <p className="text-[9px] text-white/40">{t(descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t('info.pvpRulesSectionTitle')} accent="#FF3D00">
        <div className="space-y-1 text-[10px]">
          {['info.pvpRule1', 'info.pvpRule2', 'info.pvpRule3', 'info.pvpRule4', 'info.pvpRule5', 'info.pvpRule6'].map((key) => (
            <p key={key}>• {t(key)}</p>
          ))}
        </div>
      </Section>

      <Section title={t('info.pvpSecuritySectionTitle')} accent="#4ade80">
        <p>{t('info.pvpSecurityDesc')}</p>
      </Section>
    </>
  );
}

function WalletSection() {
  const { t } = useI18n();
  return (
    <>
      <Section title={t('info.walletConnectSectionTitle')} accent="#4ade80">
        <p>{t('info.walletConnectSectionDesc')}</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <StatBadge emoji="📱" label={t('info.walletAppStore')} />
          <StatBadge emoji="🔗" label={t('info.walletMainnet')} />
          <StatBadge emoji="🪙" label={t('info.walletForBets')} />
          <StatBadge emoji="⛽" label={t('info.walletForGas')} />
        </div>
      </Section>

      <Section title={t('info.tokensSectionTitle')} accent="#fbbf24">
        <div className="space-y-2">
          <div className="p-2 rounded-lg" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.1)' }}>
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🪙</span>
              <div>
                <div className="text-[11px] font-bold" style={{ color: '#FFD700' }}>NACKL</div>
                <div className="text-[9px] text-white/40">{t('info.tokenNacklDesc')}</div>
              </div>
            </div>
          </div>
          <div className="p-2 rounded-lg" style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.1)' }}>
            <div className="flex items-center gap-1.5">
              <span className="text-sm">⛽</span>
              <div>
                <div className="text-[11px] font-bold" style={{ color: '#00d4ff' }}>SHELL</div>
                <div className="text-[9px] text-white/40">{t('info.tokenShellDesc')}</div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title={t('info.balanceSectionTitle')} accent="#00d4ff">
        <p>{t('info.balanceSectionDesc')}</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <StatBadge emoji="👤" label={t('info.balanceName')} />
          <StatBadge emoji="🪙" label={t('info.balanceNackl')} />
          <StatBadge emoji="⛽" label={t('info.balanceShell')} />
          <StatBadge emoji="🏆" label={t('info.balanceStats')} />
        </div>
      </Section>
    </>
  );
}
