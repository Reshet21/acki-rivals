/**
 * api-lib/constants.ts — серверные константы PvP (цены, лимиты, магазин).
 * Клиенту НЕ доверяем: цены и лимиты задаются только здесь.
 */

/** Предметы магазина PvP (цена в nanoTON, 1 NACKL = 1e9 nanoTON) */
export interface ShopItem {
  id: string;
  name: string;
  description: string;
  priceNano: number;
  icon: string;
  pillzBoost: number;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'pvp_pillz_1',
    name: '+1 мана (постоянно)',
    description: 'Увеличивает максимальный запас маны во всех PvP-боях на 1',
    priceNano: 25_000_000_000,
    icon: '⚡',
    pillzBoost: 1,
  },
];

/** Лимиты PvP-игры */
export const PVP_LIMITS = {
  minStakeNano: 1_000_000_000, // 1 NACKL
  maxStakeNano: 100_000_000_000, // 100 NACKL
  maxPillz: 12,
  startingPillz: 12,
  totalHp: 50,
  totalRounds: 5,
  freePillzPerRound: 1,
};
