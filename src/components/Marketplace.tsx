import { useState, useEffect, useMemo } from 'react';
import type { Card } from '../types';
import type { WalletConnection } from '../services/beeEngine';
import { useGameState } from '../hooks/useGameState';
import { useHaptic } from '../hooks/useHaptic';
import { useI18n } from '../i18n';
import CardComponent from './CardComponent';
import {
  listCard,
  buyCard,
  cancelListing,
  getOwnedNFTs,
  nacklToNano,
  MARKETPLACE_ADDRESS,
} from '../services/contractService';

interface Props {
  walletConnection: WalletConnection | null;
  nacklBalance: string | null;
  onBack: () => void;
}

type Tab = 'my' | 'buy' | 'sell';

export default function Marketplace({ walletConnection, nacklBalance, onBack }: Props) {
  const { t } = useI18n();
  const { impactOccurred, selectionChanged } = useHaptic();
  const walletAddress = useMemo(() => walletConnection?.walletAddress ?? null, [walletConnection]);
  const { collection } = useGameState(walletAddress);

  const [tab, setTab] = useState<Tab>('buy');
  const [myNFTs, setMyNFTs] = useState<string[]>([]);
  const [loadingNFTs, setLoadingNFTs] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [sellPrice, setSellPrice] = useState('');
  const [listingStatus, setListingStatus] = useState<string | null>(null);

  // Load user's on-chain NFTs
  useEffect(() => {
    if (!walletAddress || tab !== 'my') return;
    setLoadingNFTs(true);
    getOwnedNFTs(walletAddress)
      .then(setMyNFTs)
      .catch(() => setMyNFTs([]))
      .finally(() => setLoadingNFTs(false));
  }, [walletAddress, tab]);

  const handleList = async () => {
    if (!walletConnection || !selectedCard || !sellPrice) return;
    const price = parseFloat(sellPrice);
    if (isNaN(price) || price <= 0) return;

    impactOccurred('medium');
    setListingStatus('listing');

    const result = await listCard(
      walletConnection,
      selectedCard.uid || '',
      nacklToNano(price)
    );

    if (result.success) {
      setListingStatus('listed');
      setSelectedCard(null);
      setSellPrice('');
      setTimeout(() => setListingStatus(null), 2000);
    } else {
      setListingStatus(`error: ${result.error}`);
    }
  };

  const handleBuy = async (tokenAddress: string, priceNano: string) => {
    if (!walletConnection) return;
    impactOccurred('medium');
    setListingStatus('buying');

    const result = await buyCard(walletConnection, tokenAddress, priceNano);

    if (result.success) {
      setListingStatus('bought');
      setTimeout(() => setListingStatus(null), 2000);
    } else {
      setListingStatus(`error: ${result.error}`);
    }
  };

  const handleCancel = async (tokenAddress: string) => {
    if (!walletConnection) return;
    impactOccurred('light');
    setListingStatus('cancelling');

    const result = await cancelListing(walletConnection, tokenAddress);

    if (result.success) {
      setListingStatus('cancelled');
      setTimeout(() => setListingStatus(null), 2000);
    } else {
      setListingStatus(`error: ${result.error}`);
    }
  };

  const canSell = walletConnection && selectedCard && sellPrice && parseFloat(sellPrice) > 0;

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto overflow-hidden bg-battle relative">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-72 h-72 rounded-full bg-an-gold/[0.03] animate-aurora-1" style={{ top: '-10%', left: '-20%' }} />
        <div className="absolute w-56 h-56 rounded-full bg-neon-blue/[0.03] animate-aurora-2" style={{ bottom: '-10%', right: '-15%' }} />
      </div>

      {/* Header */}
      <div className="relative z-10 px-4 pt-4 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => { impactOccurred('soft'); onBack(); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'rgba(255,255,255,0.05)' }}>
            ←
          </button>
          <h1 className="text-lg font-bold text-an-gold">🏪 {t('marketplace.title') || 'Маркетплейс'}</h1>
          <div className="px-3 py-1.5 rounded-full text-xs font-bold text-neon-blue" style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)' }}>
            {nacklBalance || '0'} NACKL
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-white/[0.03] border border-white/[0.06] p-1">
          {(['buy', 'my', 'sell'] as const).map((t) => (
            <button key={t}
              onClick={() => { selectionChanged(); setTab(t); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                tab === t
                  ? 'bg-gradient-to-r from-an-gold to-an-orange text-an-dark'
                  : 'text-white/40 hover:text-white/70'
              }`}>
              {t === 'buy' && '🛒 Купить'}
              {t === 'my' && '👤 Мои NFT'}
              {t === 'sell' && '💰 Продать'}
            </button>
          ))}
        </div>
      </div>

      {/* Status messages */}
      {listingStatus && (
        <div className="relative z-10 mx-4 mb-2 px-3 py-2 rounded-lg text-xs text-center bg-an-gold/10 text-an-gold border border-an-gold/30">
          {listingStatus === 'listing' && '⏳ Выставляем на продажу...'}
          {listingStatus === 'listed' && '✅ Карта выставлена!'}
          {listingStatus === 'buying' && '⏳ Покупаем...'}
          {listingStatus === 'bought' && '✅ Куплено!'}
          {listingStatus === 'cancelling' && '⏳ Отменяем...'}
          {listingStatus === 'cancelled' && '✅ Листинг отменён'}
          {listingStatus?.startsWith('error:') && `❌ ${listingStatus.slice(7)}`}
        </div>
      )}

      {/* Wallet check */}
      {!walletConnection && (
        <div className="relative z-10 mx-4 mb-2 px-3 py-2 rounded-lg text-xs text-center" style={{ background: 'rgba(255,180,0,0.1)', border: '1px solid rgba(255,180,0,0.2)', color: 'rgba(255,215,0,0.8)' }}>
          {t('shop.connectWalletInfo') || 'Подключи кошелёк для работы с маркетплейсом'}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 relative z-10">
        {tab === 'buy' && (
          <div className="space-y-3">
            <div className="text-xs text-white/30 text-center py-8">
              {MARKETPLACE_ADDRESS
                ? '🔄 Загрузка листингов с блокчейна...'
                : '⚙️ Маркетплейс ещё не задеплоен. После деплоя контрактов укажи VITE_MARKETPLACE_ADDRESS в .env'}
            </div>
            {/* TODO v2: загружать листинги через GraphQL / Indexer */}
            {MARKETPLACE_ADDRESS && (
              <div className="text-center text-white/20 text-[10px]">
                Адрес контракта: {MARKETPLACE_ADDRESS.slice(0, 16)}...
              </div>
            )}
          </div>
        )}

        {tab === 'my' && (
          <div>
            {loadingNFTs ? (
              <div className="text-center py-8">
                <div className="text-white/40 text-sm">⏳ Загрузка NFT с блокчейна...</div>
              </div>
            ) : !walletConnection ? (
              <div className="text-center py-8 text-white/40 text-sm">👛 Подключи кошелёк</div>
            ) : myNFTs.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">🃏</div>
                <div className="text-white/40 text-sm">У тебя пока нет NFT карт</div>
                <div className="text-white/20 text-[10px] mt-1">Купи паки в магазине, чтобы получить карты</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {myNFTs.map((addr) => (
                  <div key={addr}
                    className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center cursor-pointer hover:bg-white/[0.06] transition-all"
                    onClick={() => { selectionChanged(); }}>
                    <div className="text-xs font-mono text-white/60 truncate">{addr}</div>
                    <div className="text-[10px] text-white/30 mt-1">NFT на блокчейне</div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCancel(addr); }}
                      className="mt-2 px-3 py-1 rounded-lg text-[10px] font-bold bg-an-red/10 text-an-red border border-an-red/30">
                      Отменить листинг
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'sell' && (
          <div>
            {/* Выбор карты из коллекции */}
            <div className="mb-4">
              <div className="text-xs text-white/40 mb-2 uppercase tracking-wider">Выбери карту для продажи</div>
              {collection.length === 0 ? (
                <div className="text-center py-6 text-white/30 text-sm">Коллекция пуста. Открой паки в магазине!</div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {collection.map((card) => (
                    <div key={card.uid}
                      className={`relative cursor-pointer transition-all rounded-xl ${
                        selectedCard?.uid === card.uid
                          ? 'ring-2 ring-an-gold scale-105'
                          : 'hover:ring-1 hover:ring-white/20'
                      }`}
                      onClick={() => { selectionChanged(); setSelectedCard(card); }}>
                      <CardComponent card={card} compact />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Цена */}
            {selectedCard && (
              <div className="space-y-3 animate-fade-in">
                <div className="text-xs text-white/40 uppercase tracking-wider">{selectedCard.name} — цена</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    placeholder="Цена в NACKL"
                    className="flex-1 px-4 py-3 rounded-xl text-sm text-white bg-white/[0.03] border border-white/[0.06] placeholder-white/20 focus:outline-none focus:border-an-gold/30"
                  />
                  <span className="text-sm text-neon-blue font-bold">NACKL</span>
                </div>

                <button
                  onClick={handleList}
                  disabled={!canSell}
                  className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all ${
                    canSell
                      ? 'bg-gradient-to-r from-an-gold to-an-orange text-an-dark active:scale-95 shadow-[0_0_20px_rgba(255,215,0,0.2)]'
                      : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'
                  }`}>
                  {walletConnection ? '💰 Выставить на продажу' : '👛 Сначала подключи кошелёк'}
                </button>

                <div className="text-[10px] text-white/20 text-center">
                  ⚠️ Перед продажей карта должна быть зааппрувлена на маркетплейс в твоём AN Wallet
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 px-4 py-3 relative z-10 border-t border-white/[0.03]">
        <button onClick={() => { impactOccurred('soft'); onBack(); }}
          className="w-full py-2.5 rounded-xl font-bold text-sm bg-white/5 border border-white/10 text-white/60 active:bg-white/10">
          {t('deck.back') || 'Назад'}
        </button>
      </div>
    </div>
  );
}
