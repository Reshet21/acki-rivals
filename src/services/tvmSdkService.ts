/**
 * tvmSdkService.ts
 *
 * Инициализация и конфигурация @eversdk/core для работы с Acki Nacki.
 *
 * Установка (в терминале на телефоне):
 *   cd /tmp/acki-rivals
 *   npm install @eversdk/core @eversdk/lib-web
 *
 * После установки скопировать eversdk.wasm в public/:
 *   cp node_modules/@eversdk/lib-web/eversdk.wasm public/eversdk.wasm
 *
 * @see https://github.com/tvmlabs/tvm-sdk-js
 * @see https://tonlabs.github.io/ever-sdk-js/
 */

import { TonClient } from '@eversdk/core';
import { libWeb, libWebSetup } from '@eversdk/lib-web';

// ─── Графические эндпоинты Acki Nacki ────────────────

export const NETWORKS = {
  shellnet: {
    endpoints: ['https://shellnet.ackinacki.org/graphql'],
  },
  mainnet: {
    endpoints: ['https://mainnet.ackinacki.org/graphql'],
  },
} as const;

// ─── ABI мультифакторного кошелька Acki Nacki ────────
// Стандартный интерфейс для отправки ECC токенов.
// Полный ABI можно вытащить из репозитория ackinacki/ackinacki
// (контракт MvMultifactor.sol).
// Здесь — минимально необходимая часть для sendTransaction.
//
// sendTransaction(dest, value, cc, bounce, flags, payload)
//   dest    — address получателя
//   value   — uint128 (SHELL на газ)
//   cc      — map(uint32, uint128) — ECC токены (для NACKL: {"1": amount})
//   bounce  — bool
//   flags   — uint8
//   payload — cell (пустая строка если просто перевод)

export const MULTIFACTOR_ABI = {
  'ABI version': 2,
  version: '2.3',
  header: ['pubkey', 'time', 'expire'],
  functions: [
    {
      name: 'sendTransaction',
      inputs: [
        { name: 'dest', type: 'address' },
        { name: 'value', type: 'uint128' },
        { name: 'cc', type: 'map(uint32,uint128)' },
        { name: 'bounce', type: 'bool' },
        { name: 'flags', type: 'uint8' },
        { name: 'payload', type: 'cell' },
      ],
      outputs: [],
    },
    {
      name: 'constructor',
      inputs: [
        { name: 'owners', type: 'uint256[]' },
        { name: 'reqConfirms', type: 'uint8' },
      ],
      outputs: [],
    },
  ],
  data: [],
  events: [],
} as const;

// ─── Инициализация ────────────────────────────────────

let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Инициализировать tvm-sdk (TonClient) под Web/WASM.
 * Вызвать один раз при старте приложения (в App.tsx или main.tsx).
 *
 * После установки @eversdk/lib-web нужно скопировать eversdk.wasm в public/:
 *   cp node_modules/@eversdk/lib-web/eversdk.wasm public/eversdk.wasm
 */
export async function initTvmSdk(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      libWebSetup({
        binaryURL: '/eversdk.wasm',
        disableSeparateWorker: true, // для совместимости с Vite dev server
      });
      TonClient.useBinaryLibrary(libWeb);
      initialized = true;
      console.log('[tvmSdk] SDK initialized successfully');
    } catch (err) {
      console.error('[tvmSdk] Failed to initialize SDK:', err);
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Создать TonClient для работы с сетью Acki Nacki.
 * @param network 'mainnet' | 'shellnet' (по умолчанию mainnet)
 */
export function createClient(network: keyof typeof NETWORKS = 'mainnet'): TonClient {
  if (!initialized) {
    throw new Error(
      'tvmSdkService не инициализирован. Вызови initTvmSdk() перед созданием клиента.',
    );
  }

  return new TonClient({
    network: {
      endpoints: NETWORKS[network].endpoints,
    },
  });
}

// ─── Константы токенов ────────────────────────────────

/** ECC индекс NACKL */
export const NACKL_ECC_INDEX = 1;
/** Количество десятичных знаков NACKL */
export const NACKL_DECIMALS = 9;
/** Адрес разработчика для получения платежей */
export const DEVELOPER_WALLET =
  '0:d9ed11eaef8f0ec7b475fe29e293bb721cb6a64dfba3fd069b8e2f9303ff6b36';
