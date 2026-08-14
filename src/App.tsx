import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useGameState } from './hooks/useGameState';
import { openPack as openPackCards } from './utils/packGenerator';
import type { Card } from './types';
import type { WalletConnection } from './services/beeEngine';
import { getStoredSession, getNacklBalance, getShellBalance } from './services/beeEngine';
import { enableAutoMining } from './services/miningService';
import { I18nProvider, useI18n } from './i18n';
import { useTelegram } from './telegram';
import { useHaptic } from './hooks/useHaptic';
import { useMusic } from './hooks/useMusic';
import BattleScreen from './components/BattleScreen';
import Shop from './components/Shop';
import WalletPanel from './components/WalletPanel';
import MiningPanel from './components/MiningPanel';
import DeckBuilder from './components/DeckBuilder';
import UpgradeScreen from './components/UpgradeScreen';
import PvpLobby from './components/PvpLobby';
import PvpBattleScreen from './components/PvpBattleScreen';
import InfoScreen from './components/InfoScreen';
import Leaderboard from './components/Leaderboard';
import SettingsScreen from './components/SettingsScreen';
import Marketplace from './components/Marketplace';
import ChatScreen from './components/ChatScreen';
import ClansScreen from './components/ClansScreen';
import PmScreen from './components/PmScreen';
import AnimatedBackground from './components/AnimatedBackground';
import Icon from './components/Icon';
import type { Game } from './services/pvpService';
import { getPlayerBalance } from './services/treasuryService';
import { fetchPmUnread } from './services/chatService';
import { getStoredEpkKey, zkLoginFullFlow, type OAuthProvider } from './services/zkLoginService';

type Screen = 'menu' | 'battle' | 'shop' | 'marketplace' | 'wallet' | 'mining' | 'deck' | 'upgrade' | 'pvp' | 'pvp_battle' | 'info' | 'settings' | 'leaderboard' | 'chat' | 'clans' | 'pm';

/** Красивый формат баланса: "20047.2481" → "20 047.25"; null → "—" */
function fmtBal(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  const s = String(v);
  const [whole, frac] = s.split('.');
  const w = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return frac ? `${w}.${(frac + '00').slice(0, 2)}` : w;
}

function AppInner() {
  const { haptic } = useTelegram();
  const { impactOccurred, selectionChanged } = useHaptic();
  const { t } = useI18n();
  const { isEnabled: musicEnabled, toggle: toggleMusic, pause: pauseMusic, resume: resumeMusic } = useMusic();

  const [walletConnection, setWalletConnection] = useState<WalletConnection | null>(() =>
    getStoredSession()
  );
  const walletAddress = useMemo(() => walletConnection?.walletAddress ?? null, [walletConnection]);

  const {
    collection,
    deck,
    setDeck,
    battlesWon,
    battlesLost,
    addCard,
    removeCard,
    upgradeCard,
    saveToStorage,
    recordWin,
    recordLoss,
    setWalletAddress,
  } = useGameState(walletAddress);

  const [anonId] = useState(() => {
    const stored = localStorage.getItem('pvp_player_id');
    if (stored) return stored;
    const newId = 'p_' + crypto.randomUUID().slice(0, 8);
    localStorage.setItem('pvp_player_id', newId);
    return newId;
  });

  // Стабильный игровой id: с кошельком — его адрес (уникален, одинаков
  // на всех устройствах), без кошелька — анонимный id из localStorage.
  const playerId = walletAddress ?? anonId;

  const [screen, setScreen] = useState<Screen>('menu');
  const [pmUnread, setPmUnread] = useState(0);
  const [pmToast, setPmToast] = useState<{ player: string; name: string | null; text: string } | null>(null);
  const [pmTarget, setPmTarget] = useState<{ player: string; name: string } | null>(null);
  const [pmBackScreen, setPmBackScreen] = useState<Screen | null>(null);
  const shownToastIdRef = useRef(0);

  // Поллинг непрочитанных ЛС: бейдж на кнопке меню + тост-уведомление на любом экране.
  // Тост показывается по id последнего непрочитанного сообщения (а не по росту счётчика) —
  // срабатывает даже если сообщение пришло до загрузки страницы.
  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    const load = async () => {
      const u = await fetchPmUnread(playerId);
      if (cancelled) return;
      setPmUnread(u.unread);
      if (u.latest && u.latest.id !== shownToastIdRef.current && screen !== 'pm') {
        shownToastIdRef.current = u.latest.id;
        setPmToast(u.latest);
      }
    };
    load();
    const i = setInterval(load, 2500);
    return () => { cancelled = true; clearInterval(i); };
  }, [playerId, screen]);

  // Авто-скрытие тоста
  useEffect(() => {
    if (!pmToast) return;
    const tm = setTimeout(() => setPmToast(null), 6000);
    return () => clearTimeout(tm);
  }, [pmToast]);

  const openPmFromToast = () => {
    if (!pmToast) return;
    selectionChanged();
    setPmTarget({ player: pmToast.player, name: pmToast.name || pmToast.player });
    setPmToast(null);
    setPmUnread(0);
    setPmBackScreen(screen);
    setScreen('pm');
  };

  const openPm = (recipient: string, name: string, backScreen: Screen | null) => {
    selectionChanged();
    setPmTarget({ player: recipient, name });
    setPmBackScreen(backScreen);
    setPmUnread(0);
    setScreen('pm');
  };

  // Background variant based on current screen
  const bgVariant = screen === 'battle' ? 'battle' :
    screen === 'shop' ? 'shop' :
      (screen === 'pvp' || screen === 'pvp_battle') ? 'pvp' : 'default';

  // Pause music during battles, resume when back to menu
  useEffect(() => {
    if (screen === 'menu' || screen === 'shop' || screen === 'deck') {
      resumeMusic();
    } else {
      pauseMusic();
    }
  }, [screen, resumeMusic, pauseMusic]);

  // Авто-майнинг: стартует сам при заходе в приложение, если есть ключи
  useEffect(() => {
    enableAutoMining();
  }, []);

  // Игровой баланс (NACKL на сервере): обновление раз в 30с
  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    const load = async () => {
      const b = await getPlayerBalance(playerId);
      if (!cancelled) setGameBalance(b);
    };
    load();
    const i = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(i); };
  }, [playerId]);
  const [nacklBalance, setNacklBalance] = useState<string | null>(null);
  const [shellBalance, setShellBalance] = useState<string | null>(null);
  const [gameBalance, setGameBalance] = useState<number | null>(null);
  const [pvpGame, setPvpGame] = useState<Game | null>(null);
  const [pvpIsHost, setPvpIsHost] = useState(false);
  const [starterPackClaimed, setStarterPackClaimed] = useState<boolean>(() => {
    return localStorage.getItem('acki-starter-claimed') === 'true';
  });
  const [hasEpkKey, setHasEpkKey] = useState<boolean>(() => getStoredEpkKey() !== null);

  // Refresh EPK state
  useEffect(() => {
    setHasEpkKey(getStoredEpkKey() !== null);
  }, [walletConnection]);

  const handleZkLogin = useCallback(async (provider: OAuthProvider = 'google') => {
    if (!walletConnection) {
      setScreen('wallet');
      return;
    }
    try {
      const epk = await zkLoginFullFlow(walletConnection.walletName, provider);
      setHasEpkKey(true);
      console.log('[App] zkLogin completed, EPK key for', epk.walletAddress);
    } catch (e) {
      console.error('[App] zkLogin failed:', e);
      alert(`Ошибка входа (${provider}): ` + (e instanceof Error ? e.message : 'Неизвестная ошибка'));
    }
  }, [walletConnection]);

  useEffect(() => {
    saveToStorage();
  }, [collection, deck, battlesWon, battlesLost, saveToStorage]);

  // Poll NACKL + SHELL balances when wallet connected
  useEffect(() => {
    if (!walletConnection) {
      setNacklBalance(null);
      setShellBalance(null);
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const n = await getNacklBalance(walletConnection.walletAddress);
        if (!cancelled) setNacklBalance(n);
      } catch { /* ignore */ }
      try {
        const s = await getShellBalance(walletConnection.walletAddress);
        if (!cancelled) setShellBalance(s);
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => { cancelled = true; clearInterval(id); };
  }, [walletConnection]);

  const handleBattleEnd = useCallback((result: 'win' | 'loss' | 'draw') => {
    if (result === 'win') { recordWin(); haptic.notificationOccurred('success'); }
    else if (result === 'loss') { recordLoss(); haptic.notificationOccurred('error'); }
    else { haptic.notificationOccurred('warning'); }
    setScreen('menu');
  }, [recordWin, recordLoss, haptic]);

  const handleBuyPack = useCallback((packId: string): Card[] | void => {
    const key = `acki-pity-${packId}`;
    const pity = Number(localStorage.getItem(key) || 0);
    const result = openPackCards(packId, pity);
    localStorage.setItem(key, String(result.newPity));
    result.cards.forEach((c) => addCard(c));
    haptic.notificationOccurred('success');
    return result.cards;
  }, [addCard, haptic]);

  const handleClaimStarterPack = useCallback(() => {
    localStorage.setItem('acki-starter-claimed', 'true');
    setStarterPackClaimed(true);
  }, []);

  const handleToggleDeck = useCallback((card: Card) => {
    setDeck((prev) => {
      if (!card.uid) return prev;
      const inDeck = prev.some((c) => c.uid === card.uid);
      if (inDeck) {
        haptic.selectionChanged();
        return prev.filter((c) => c.uid !== card.uid);
      }
      if (prev.length >= 10) return prev;
      haptic.selectionChanged();
      return [...prev, card];
    });
  }, [setDeck, haptic]);

  const handleWalletConnected = useCallback((conn: WalletConnection) => {
    setWalletConnection(conn);
    setWalletAddress(conn.walletAddress);
  }, [setWalletAddress]);

  const handleWalletDisconnect = useCallback(() => {
    // Just disconnect wallet session — game progress stays saved
    setWalletConnection(null);
    setNacklBalance(null);
    setShellBalance(null);
    // Switch to anonymous mode (no wallet) — progress for this wallet is saved
    setWalletAddress(null);
  }, [setWalletAddress]);

  return (
    <div className="h-full w-full overflow-x-hidden overflow-y-auto text-white flex flex-col relative safe-top safe-bottom animate-page-enter" style={{ background: '#050508' }}>
      {/* Global animated background — one shared living background on every screen */}
      <AnimatedBackground variant={bgVariant} />

      {screen === 'menu' && (() => {
        const CYAN = '#7ac7de';
        const ready = deck.length === 10;
        const tiles: { icon: import('./components/Icon').IconName; label: string; on: () => void; badge?: number; pulse?: boolean }[] = [
          { icon: 'cards', label: t('menu.deck'), on: () => setScreen('deck'), pulse: !ready },
          { icon: 'bag', label: t('menu.shop'), on: () => setScreen('shop') },
          { icon: 'store', label: 'Marketplace', on: () => setScreen('marketplace') },
          { icon: 'anvil', label: t('menu.upgrade'), on: () => setScreen('upgrade') },
          { icon: 'wallet', label: t('menu.wallet'), on: () => setScreen('wallet') },
          { icon: 'pickaxe', label: t('menu.mining'), on: () => setScreen('mining') },
          { icon: 'chat', label: t('menu.chat'), on: () => setScreen('chat') },
          { icon: 'castle', label: t('menu.clans'), on: () => setScreen('clans') },
          { icon: 'user', label: t('menu.pm'), on: () => { setScreen('pm'); setPmUnread(0); setPmBackScreen(null); }, badge: pmUnread },
        ];
        return (
        <div className="relative flex flex-col h-full w-full mx-auto overflow-hidden" style={{ maxWidth: 448, background: 'transparent' }}>
          {/* Hero card art — edges dissolved into the shared background */}
          <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ height: '56%', overflow: 'hidden' }}>
            <img src="/cards/card-patrol.png" alt="" className="w-full h-full object-cover" style={{
              objectPosition: '50% 20%',
              filter: 'grayscale(0.5) brightness(0.6) contrast(1.05)',
              opacity: 0.85,
              WebkitMaskImage: 'radial-gradient(78% 66% at 50% 40%, #000 42%, rgba(0,0,0,0.35) 78%, transparent 100%)',
              maskImage: 'radial-gradient(78% 66% at 50% 40%, #000 42%, rgba(0,0,0,0.35) 78%, transparent 100%)',
            }} />
            {/* bottom fade into content */}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 0%, transparent 52%, rgba(5,5,8,0.55) 78%, rgba(5,5,8,0.9) 92%, #050508 100%)' }} />
            {/* soft cyan ambient glow */}
            <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 42% at 50% 16%, rgba(74,168,196,0.14), transparent 70%)' }} />
          </div>

          <div className="relative z-10 flex flex-col h-full w-full overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-10 shrink-0 animate-slide-down">
              <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '0.16em' }}>ACKI RIVALS</div>
              {walletConnection ? (
                <div className="flex items-center gap-2">
                  <span className="truncate max-w-[110px]" style={{ fontSize: 11, color: 'rgba(230,235,239,0.6)' }}>{walletConnection.walletName}</span>
                  <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ border: '1px solid rgba(255,255,255,0.22)', fontSize: 10, fontWeight: 700, color: 'rgba(230,235,239,0.7)' }}>{walletConnection.walletName.charAt(0).toUpperCase()}</span>
                </div>
              ) : (
                <button onClick={() => { impactOccurred('medium'); setScreen('wallet'); }} className="px-3 py-1.5 rounded-full transition-all active:scale-95" style={{ border: `1px solid ${CYAN}66`, fontSize: 11, fontWeight: 600, color: CYAN }}>
                  {t('menu.connectWallet')}
                </button>
              )}
            </div>

            {/* Bottom content */}
            <div className="mt-auto flex flex-col px-6 pb-[max(16px,env(safe-area-inset-bottom))] pt-6">
              {/* Stats */}
              <div className="flex gap-3 pb-4 animate-slide-up" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex flex-col items-center gap-1.5">
                  <span className="tabular-nums" style={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>{fmtBal(nacklBalance)}</span>
                  <span style={{ fontSize: 9, letterSpacing: '0.04em', color: 'rgba(230,235,239,0.32)' }}>Nackl</span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <span className="tabular-nums" style={{ fontSize: 11, fontWeight: 700, lineHeight: 1, color: CYAN }}>{fmtBal(shellBalance)}</span>
                  <span style={{ fontSize: 9, letterSpacing: '0.04em', color: 'rgba(230,235,239,0.32)' }}>Shell</span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <span className="tabular-nums" style={{ fontSize: 11, fontWeight: 700, lineHeight: 1, color: '#4ADE80' }}>{fmtBal(gameBalance !== null ? gameBalance.toFixed(4) : null)}</span>
                  <span style={{ fontSize: 9, letterSpacing: '0.04em', color: 'rgba(230,235,239,0.32)' }}>{t('menu.gameBalance')}</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 ml-auto">
                  <span className="tabular-nums" style={{ fontSize: 11, fontWeight: 700, lineHeight: 1, color: 'rgba(230,235,239,0.75)' }}>{battlesWon}/{battlesLost}</span>
                  <span style={{ fontSize: 9, letterSpacing: '0.04em', color: 'rgba(230,235,239,0.32)' }}>W/L</span>
                </div>
              </div>

              {/* Deck warning */}
              {!ready && (
                <div className="flex items-center justify-center gap-1.5 text-center mt-3 text-[11px] text-white animate-fade-in">
                  <Icon name="cards" size={13} /> {t('menu.deckHint').replace(/^[^\p{L}\p{N}]+/u, '').trim()}
                </div>
              )}

              {/* Rules */}
              <button onClick={() => { selectionChanged(); setScreen('info'); }}
                className="w-full mt-4 py-3 rounded-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(230,235,239,0.8)', fontWeight: 600, fontSize: 13 }}>
                <Icon name="book" size={15} /> {t('menu.rules')}
              </button>

              {/* PvP + AI */}
              <div className="flex flex-col gap-2.5 mt-2.5">
                <button onClick={() => { impactOccurred('medium'); setScreen('pvp'); }} disabled={!ready}
                  className={`w-full py-4 rounded-[14px] flex items-center justify-center gap-3 transition-all active:scale-[0.97] ${ready ? 'snake-border' : ''}`}
                  style={{ background: ready ? 'transparent' : 'rgba(255,255,255,0.03)', border: ready ? 'none' : '2px solid rgba(255,255,255,0.06)', color: ready ? '#e6ebef' : 'rgba(255,255,255,0.2)', boxShadow: 'none' }}>
                  <Icon name="globe" size={22} />
                  <div className="flex flex-col items-center text-center leading-tight">
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{t('menu.pvpBattle')}</span>
                    <span className="text-[10px] font-normal opacity-70">{t('menu.pvpDesc')}</span>
                  </div>
                </button>
                <button onClick={() => { impactOccurred('medium'); setScreen('battle'); }} disabled={!ready}
                  className="w-[78%] mx-auto py-2.5 rounded-[12px] flex items-center justify-center gap-2.5 transition-all active:scale-[0.97]"
                  style={{ background: 'transparent', border: `1px solid ${ready ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)'}`, color: ready ? 'rgba(230,235,239,0.78)' : 'rgba(255,255,255,0.2)' }}>
                  <Icon name="cpu" size={18} />
                  <div className="flex flex-col items-center text-center leading-tight">
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{t('menu.aiBattle')}</span>
                    <span className="text-[9px] font-normal opacity-70">{t('menu.aiDesc')}</span>
                  </div>
                </button>
              </div>

              {/* Tiles — отдельный блок, наши иконки и названия */}
              <div className="mt-6 w-full p-2.5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="grid grid-cols-3 gap-2">
                  {tiles.map((tl, i) => (
                    <button key={i} onClick={() => { selectionChanged(); tl.on(); }}
                      className={`relative py-2 rounded-[11px] flex flex-col items-center gap-1 transition-all active:scale-[0.95] ${tl.pulse ? 'deck-pulse' : ''}`}
                      style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(230,235,239,0.7)', fontSize: 10.5, fontWeight: 600 }}>
                      <Icon name={tl.icon} size={18} />
                      {tl.label}
                      {tl.badge != null && tl.badge > 0 && (
                        <span className="absolute top-1 right-1.5 px-1.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full text-[9px] font-black text-black" style={{ background: CYAN, boxShadow: `0 0 8px ${CYAN}99` }}>{tl.badge}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom nav — одинаковая ширина кнопок => «Звук» строго по центру */}
              <div className="flex items-center justify-center gap-4 mt-8">
                <button onClick={() => { selectionChanged(); setScreen('leaderboard'); }} className="w-20 flex flex-col items-center gap-1 transition-all active:scale-95" style={{ color: 'rgba(230,235,239,0.4)' }}>
                  <Icon name="trophy" size={17} /><span style={{ fontSize: 9, letterSpacing: '0.12em' }}>{t('menu.leaderboard')}</span>
                </button>
                <button onClick={() => { toggleMusic(); selectionChanged(); }} className="w-20 flex flex-col items-center gap-1 transition-all active:scale-95" style={{ color: musicEnabled ? `${CYAN}cc` : 'rgba(230,235,239,0.4)' }}>
                  <Icon name={musicEnabled ? 'music' : 'musicOff'} size={17} /><span style={{ fontSize: 9, letterSpacing: '0.12em' }}>{musicEnabled ? 'Музыка' : 'Тихо'}</span>
                </button>
                <button onClick={() => { selectionChanged(); setScreen('settings'); }} className="w-20 flex flex-col items-center gap-1 transition-all active:scale-95" style={{ color: 'rgba(230,235,239,0.4)' }}>
                  <Icon name="gear" size={17} /><span style={{ fontSize: 9, letterSpacing: '0.12em' }}>{t('menu.settings')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {screen === 'battle' && (
        <div key="battle" className="relative z-10 h-full animate-page-enter">
          <BattleScreen playerDeck={deck} onBattleEnd={handleBattleEnd} />
        </div>
      )}

      {screen === 'shop' && (
        <div key="shop" className="relative z-10 flex-1 flex items-center justify-center animate-page-enter">
          <Shop
            walletConnection={walletConnection}
            nacklBalance={nacklBalance}
            onBuyPack={handleBuyPack}
            onBack={() => setScreen('menu')}
            starterPackClaimed={starterPackClaimed}
            onClaimStarterPack={handleClaimStarterPack}
            onReconnectWallet={() => setScreen('wallet')}
            onZkLogin={handleZkLogin}
            hasEpkKey={hasEpkKey}
          />
        </div>
      )}

      {screen === 'marketplace' && (
        <div key="marketplace" className="relative z-10 flex-1 flex items-center justify-center animate-page-enter">
          <Marketplace
            walletConnection={walletConnection}
            collection={collection}
            onAddCard={addCard}
            onRemoveCard={removeCard}
            onBack={() => setScreen('menu')}
          />
        </div>
      )}

      {screen === 'chat' && (
        <div key="chat" className="relative z-10 flex-1 flex items-center justify-center animate-page-enter">
          <ChatScreen
            playerId={playerId}
            playerName={walletConnection?.walletName || undefined}
            collection={collection}
            onAddCard={addCard}
            onRemoveCard={removeCard}
            onOpenPm={(recipient, name) => openPm(recipient, name, 'chat')}
            onBack={() => setScreen('menu')}
          />
        </div>
      )}

      {screen === 'clans' && (
        <div key="clans" className="relative z-10 flex-1 flex items-center justify-center animate-page-enter">
          <ClansScreen
            playerId={playerId}
            onBack={() => setScreen('menu')}
          />
        </div>
      )}

      {screen === 'pm' && (
        <div key="pm" className="relative z-10 flex-1 flex items-center justify-center animate-page-enter">
          <PmScreen
            playerId={playerId}
            initialWith={pmTarget}
            onBack={() => { setPmTarget(null); setScreen(pmBackScreen || 'menu'); setPmBackScreen(null); }}
          />
        </div>
      )}

      {screen === 'wallet' && (
        <div key="wallet" className="relative z-10 flex-1 flex items-center justify-center animate-page-enter">
          <button onClick={() => { selectionChanged(); setScreen('menu'); }} className="absolute left-4 top-4 z-20 w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all active:scale-95" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>←</button>
          <WalletPanel
            connection={walletConnection}
            onConnected={handleWalletConnected}
            onDisconnect={handleWalletDisconnect}
            onBack={() => setScreen('menu')}
          />
        </div>
      )}

      {screen === 'mining' && walletConnection && (
        <div key="mining" className="relative z-10 flex-1 flex items-center justify-center animate-page-enter">
          <button onClick={() => { selectionChanged(); setScreen('menu'); }} className="absolute left-4 top-4 z-20 w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all active:scale-95" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>←</button>
          <MiningPanel
            connection={walletConnection}
            onBack={() => setScreen('menu')}
          />
        </div>
      )}

      {screen === 'mining' && !walletConnection && (
        <div key="mining-connect" className="relative z-10 flex-1 flex flex-col items-center justify-center gap-4 p-4 animate-page-enter">
          <div className="text-white/50 text-center">
            {t('menu.connectWalletForMining')}
          </div>
          <button
            onClick={() => setScreen('wallet')}
            className="py-3 px-6 rounded-lg font-bold text-sm
              bg-gradient-to-r from-neon-blue to-neon-purple text-white
              active:scale-95 transition-all"
          >
            {t('menu.connectWallet')}
          </button>
          <button onClick={() => setScreen('menu')} className="text-xs text-white/30">
            {t('menu.back')}
          </button>
        </div>
      )}

      {screen === 'deck' && (
        <div key="deck" className="relative z-10 flex-1 animate-page-enter">
          <DeckBuilder
            collection={collection}
            deck={deck}
            onToggleDeck={handleToggleDeck}
            onBack={() => setScreen('menu')}
          />
        </div>
      )}

      {screen === 'upgrade' && (
        <div key="upgrade" className="relative z-10 flex-1 animate-page-enter">
          <UpgradeScreen
            collection={collection}
            onUpgrade={upgradeCard}
            onBack={() => setScreen('menu')}
          />
        </div>
      )}

      {screen === 'pvp' && (
        <div key="pvp" className="relative z-10 flex-1 animate-page-enter">
          <PvpLobby
            playerId={playerId}
            playerName={walletConnection?.walletName || playerId}
            deck={deck}
            onStartBattle={(game, isHost) => {
              setPvpGame(game);
              setPvpIsHost(isHost);
              setScreen('pvp_battle');
            }}
            onBack={() => setScreen('menu')}
            onMinimize={() => setScreen('menu')}
          />
        </div>
      )}

      {screen === 'pvp_battle' && pvpGame && (
        <div key="pvp_battle" className="relative z-10 flex-1 animate-page-enter">
          <PvpBattleScreen
            game={pvpGame}
            playerId={playerId}
            playerName={walletConnection?.walletName || playerId}
            isHost={pvpIsHost}
            myDeck={deck}
            onBattleEnd={(result) => {
              if (result === 'win') { recordWin(); haptic.notificationOccurred('success'); }
              else if (result === 'loss') { recordLoss(); haptic.notificationOccurred('error'); }
              else { haptic.notificationOccurred('warning'); }
              setPvpGame(null);
              setScreen('menu');
            }}
            onSurrender={() => {
              recordLoss();
              setPvpGame(null);
              setScreen('menu');
            }}
          />
        </div>
      )}

      {screen === 'info' && (
        <div key="info" className="relative z-10 flex-1 animate-page-enter">
          <InfoScreen onBack={() => setScreen('menu')} />
        </div>
      )}

      {screen === 'settings' && (
        <div key="settings" className="relative z-10 flex-1 animate-page-enter">
          <SettingsScreen onBack={() => setScreen('menu')} />
        </div>
      )}

      {screen === 'leaderboard' && (
        <div key="leaderboard" className="relative z-10 flex-1 animate-page-enter">
          <Leaderboard
            playerId={playerId}
            playerName={walletConnection?.walletName || playerId}
            wins={battlesWon}
            losses={battlesLost}
            onBack={() => setScreen('menu')}
          />
        </div>
      )}

      {/* PM notification toast */}
      {pmToast && (
        <div className="absolute top-3 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
          <button onClick={openPmFromToast}
            className="pointer-events-auto w-full max-w-md flex items-center gap-3 px-4 py-3 rounded-2xl border border-neon-purple/30 animate-slide-down active:scale-[0.98] transition-all text-left"
            style={{ background: 'rgba(15,12,30,0.95)', boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 16px rgba(139,92,246,0.25)', backdropFilter: 'blur(12px)' }}>
            <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(139,92,246,0.2))', border: '1px solid rgba(139,92,246,0.35)' }}>
              <Icon name="user" size={16} style={{ color: '#a78bfa' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>
                {t('pm.notification')} {pmToast.name || pmToast.player}
              </div>
              <div className="text-[12px] text-white/50 truncate">{pmToast.text}</div>
            </div>
            <span className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black text-black" style={{ background: 'linear-gradient(135deg, #00d4ff, #a78bfa)' }}>
              {t('pm.open')}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return <I18nProvider><AppInner /></I18nProvider>;
}
// rebuild 1783796703
