/**
 * zkLoginService.ts
 *
 * Полный флоу zkLogin для браузера:
 * 1. prepare_zk_login_v1() → nonce + эфемерный ключ
 * 2. OAuth (Google GIS / Telegram oauth.gosh.sh) → id_token
 * 3. complete_zk_login_with_prover_v1() → Groth16-доказательство
 * 4. deploy_wallet() → создание собственного кошелька dApp (Multifactor)
 *    или add_zkp_factor() → регистрация EPK на существующем AN Wallet
 * 5. Использование EPK-keypair для send_tokens_direct
 *
 * ⚠️ deploy_wallet — рабочий путь для платежей игры:
 * add_zkp_factor на чужой AN Wallet падает с 502 ERR_FACTOR_EXPIRED
 * (нет salt кошелька пользователя). Свой кошелёк решает проблему.
 *
 * Основано на документации интеграции zkLogin для Acki Nacki.
 *
 * @see ИНТЕГРАЦИЯ_кошелька_zkLogin.md
 */

import { ENDPOINTS, API_URL, APP_ID } from './beeEngine';

// Константы приложения (добыты из официального приложения Acki Nacki)
// ⚠️ НЕ используем redirect_uri мобильного приложения Энтропии —
// он открывает нативные приложения вместо веб-входа.
// Вместо этого — Google Identity Services (GIS) с popup-входом.
const CLIENT_ID = '222414061721-4tu2gsfms6rvagqvt4mp0mjmbom6flbl.apps.googleusercontent.com';
const PROVER_URL = 'https://proover.ackinacki.org/v1';

// ── Telegram zkLogin (oauth.gosh.sh) ──
// client_id = app_dapp_id приложения (зарегистрирован @EugeneDAO, 0x26).
// Прокси: POST https://oauth.gosh.sh/v1/telegram с Telegram Login Widget
// данными бота (bot_name). Точный формат (data/bot_name/hash/id/nonce/
// client_id) выяснен экспериментально 07.08.2026.
const TELEGRAM_OAUTH_URL = 'https://oauth.gosh.sh';
const TELEGRAM_CLIENT_ID =
  import.meta.env.VITE_TELEGRAM_OAUTH_CLIENT_ID || APP_ID;
/** Telegram-бот (username без @) для Login Widget — бот Acki Nacki (t.me/ackinacki_bot) */
const TELEGRAM_BOT_NAME = import.meta.env.VITE_TELEGRAM_BOT_NAME || 'ackinacki_bot';

// JWKS-эндпоинты провайдеров для получения modulus JWK по kid.
// Для Telegram: TODO — уточнить у @EugeneDAO (скорее всего <oauth-хост>/jwks).
const JWKS_URLS: Record<string, string> = {
  'https://accounts.google.com': 'https://www.googleapis.com/oauth2/v3/certs',
  'https://oauth.gosh.sh': `${TELEGRAM_OAUTH_URL}/jwks`,
};

export type OAuthProvider = 'google' | 'telegram';

export interface OAuthIdToken {
  idToken: string;
  sub: string;
  aud: string;
  kid: string;
  iss: string;
}

// Ключ для хранения EPK в localStorage
const EPK_STORAGE_KEY = 'acki-rivals-epk-key';

// Минимальное время жизни EPK-фактора (контракт требует ≥ 300 сек)
const MIN_EPK_LIFE_TIME_SEC = 300;

export interface EpkKeyPair {
  public: string;
  secret: string;
  walletName: string;
  walletAddress: string;
  /** Unix timestamp (сек) когда EPK протухает */
  expiresAt: number;
  /** Когда был сохранён */
  savedAt: number;
}

/**
 * Получить сохранённый EPK-ключ из localStorage.
 * Возвращает null, если ключ протух или отсутствует.
 */
export function getStoredEpkKey(): EpkKeyPair | null {
  try {
    const raw = localStorage.getItem(EPK_STORAGE_KEY);
    if (!raw) return null;
    const key: EpkKeyPair = JSON.parse(raw);
    // Проверка срока
    const now = Math.floor(Date.now() / 1000);
    if (key.expiresAt <= now + MIN_EPK_LIFE_TIME_SEC) {
      // Протух или скоро протухнет — удаляем
      localStorage.removeItem(EPK_STORAGE_KEY);
      return null;
    }
    return key;
  } catch {
    localStorage.removeItem(EPK_STORAGE_KEY);
    return null;
  }
}

/**
 * Сохранить EPK-ключ в localStorage.
 */
export function storeEpkKey(key: EpkKeyPair): void {
  localStorage.setItem(EPK_STORAGE_KEY, JSON.stringify(key));
}

/**
 * Удалить сохранённый EPK-ключ.
 */
export function clearEpkKey(): void {
  localStorage.removeItem(EPK_STORAGE_KEY);
}

/**
 * Войти через Google с помощью Google Identity Services (GIS).
 *
 * GIS открывает popup/iframe на accounts.google.com и возвращает id_token
 * напрямую через callback — БЕЗ redirect_uri. Это работает в любом браузере
 * (мобильном и десктопном) и НЕ открывает нативные приложения.
 *
 * @returns {Promise<{ idToken: string; sub: string; aud: string; kid: string }>}
 */
export async function loginWithGoogle(): Promise<{
  idToken: string;
  sub: string;
  aud: string;
  kid: string;
}> {
  // Загружаем GIS SDK (если ещё не загружен)
  await loadGisScript();

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Время ожидания входа через Google истекло (5 мин).'));
    }, 5 * 60 * 1000);

    const gis = (window as any).google?.accounts?.id;
    if (!gis) {
      clearTimeout(timeoutId);
      reject(new Error('Google Identity Services не загрузился. Проверьте интернет.'));
      return;
    }

    const callback = (response: any) => {
      clearTimeout(timeoutId);
      try {
        if (response?.error) {
          reject(new Error(`Google sign-in error: ${response.error}`));
          return;
        }
        const idToken: string = response?.credential;
        if (!idToken) {
          reject(new Error('Google не вернул id_token.'));
          return;
        }
        const payload = decodeJwtPayload(idToken);
        const kid = decodeJwtHeader(idToken).kid;
        resolve({
          idToken,
          sub: payload.sub,
          aud: payload.aud,
          kid,
        });
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Не удалось обработать ответ Google.'));
      }
    };

    gis.initialize({
      client_id: CLIENT_ID,
      callback,
      auto_select: false,
      ux_mode: 'popup',
    });

    gis.prompt();
  });
}

/**
 * Войти через Telegram через OAuth-прокси oauth.gosh.sh (ZK Login Widget).
 *
 * Флоу (выяснен экспериментально 07.08.2026, прокси жив):
 * 1. Пользователь жмёт кнопку — открываем Telegram Login Widget бота
 *    (TELEGRAM_BOT_NAME). Виджет отдаёт { id, first_name, last_name,
 *    username, photo_url, auth_date, hash } (hash = HMAC подпись бота).
 * 2. POST https://oauth.gosh.sh/v1/telegram с телом
 *    { data, bot_name, hash, id, nonce, client_id } → { data: <JWT> }.
 *    client_id = app_dapp_id (0x26), nonce — из prepare_zk_login_v1().
 *
 * @param nonce — из prepare_zk_login_v1() (bind эфемерного ключа к JWT)
 */
export function loginWithTelegram(nonce: string): Promise<OAuthIdToken> {
  return new Promise((resolve, reject) => {
    if (!TELEGRAM_BOT_NAME) {
      reject(
        new Error(
          'Telegram-бот для входа не настроен: получите у @EugeneDAO bot_name и укажите VITE_TELEGRAM_BOT_NAME (client_id=0x26 уже настроен)',
        ),
      );
      return;
    }

    // Telegram Login Widget: грузим официальный скрипт виджета
    const existing = document.getElementById('tg-widget-script');
    if (!existing) {
      const s = document.createElement('script');
      s.id = 'tg-widget-script';
      s.async = true;
      s.src = 'https://telegram.org/js/telegram-widget.js?22';
      document.head.appendChild(s);
    }

    const botName = TELEGRAM_BOT_NAME;
    const clientId = TELEGRAM_CLIENT_ID;

    // Колбэк вызова после авторизации в Telegram
    (window as unknown as Record<string, unknown>).onTelegramAuth = async (user: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
      auth_date: number;
      hash: string;
    }) => {
      try {
        // Каноническая строка данных виджета (для проверки подписи на прокси)
        const parts: string[] = [];
        if (user.auth_date) parts.push(`auth_date=${user.auth_date}`);
        if (user.first_name) parts.push(`first_name=${user.first_name}`);
        if (user.id) parts.push(`id=${user.id}`);
        if (user.last_name) parts.push(`last_name=${user.last_name}`);
        if (user.photo_url) parts.push(`photo_url=${user.photo_url}`);
        if (user.username) parts.push(`username=${user.username}`);
        const dataCheckString = parts.join('&');

        const res = await fetch(`${TELEGRAM_OAUTH_URL}/v1/telegram`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: dataCheckString,
            bot_name: botName,
            hash: user.hash,
            id: user.id,
            nonce,
            client_id: clientId,
          }),
        });
        const json = (await res.json()) as Record<string, unknown>;
        if (!res.ok) {
          throw new Error(
            `Telegram OAuth failed (HTTP ${res.status}): ${JSON.stringify(json).slice(0, 200)}`,
          );
        }
        // Ответ вида { data: "<jwt>" } или { data: { id_token: "<jwt>" } }
        const raw = json.data as string | Record<string, unknown> | null;
        const idToken: string =
          typeof raw === 'string'
            ? raw
            : String((raw as Record<string, unknown>)?.id_token ?? '');
        if (!idToken) {
          throw new Error(`Telegram OAuth: нет id_token в ответе: ${JSON.stringify(json).slice(0, 200)}`);
        }
        const payload = decodeJwtPayload(idToken) as Record<string, string>;
        const kid = decodeJwtHeader(idToken).kid;
        resolve({
          idToken,
          sub: payload.sub,
          aud: payload.aud,
          kid,
          iss: payload.iss ?? TELEGRAM_OAUTH_URL,
        });
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };

    // Рендерим кнопку виджета и «нажимаем» её после короткой паузы
    const container = document.createElement('div');
    container.id = 'tg-login-widget';
    container.style.display = 'none';
    document.body.appendChild(container);

    const w = document.createElement('div');
    container.appendChild(w);

    const tryRender = () => {
      const global = window as unknown as { Telegram?: { Login: { init: (opts: object, onAuth: (user: Record<string, unknown> | null) => void) => void } } };
      if (!global.Telegram?.Login?.init) {
        setTimeout(tryRender, 300);
        return;
      }
      global.Telegram.Login.init(
        {
          bot_id: botName,
          origin: window.location.origin,
          request_access: true,
        },
        (user) => {
          if (user) {
            (window as unknown as { onTelegramAuth?: (u: typeof user) => void }).onTelegramAuth?.(user);
          } else {
            reject(new Error('Вход в Telegram отменён'));
          }
        },
      );
    };
    setTimeout(tryRender, 300);
  });
}

/**
 * Единая точка входа OAuth для zkLogin.
 */
export async function loginWithOAuth(
  provider: OAuthProvider,
  nonce: string,
): Promise<OAuthIdToken> {
  if (provider === 'telegram') {
    return loginWithTelegram(nonce);
  }
  const google = await loginWithGoogle();
  return {
    ...google,
    iss: 'https://accounts.google.com',
  };
}

/**
 * Динамически загрузить Google Identity Services SDK.
 */
function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.id) {
      resolve();
      return;
    }

    // Избегаем дубликатов
    if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      // Ждём загрузку
      const check = () => {
        if ((window as any).google?.accounts?.id) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Не удалось загрузить Google Identity Services.'));
    document.head.appendChild(script);
  });
}

/**
 * Удалено: старый popup-флоу с redirect_uri Энтропии больше не нужен.
 * GIS возвращает id_token через callback без редиректов.
 */

/**
 * Полный флоу zkLogin: вход через OAuth (Google/Telegram) → регистрация EPK → возврат ключей.
 *
 * @param walletName — имя кошелька (например, "v_o_g_e_l")
 * @param provider — zkLogin-провайдер (по умолчанию Google)
 * @param password — пароль-соль кошелька (если не указан — генерируется)
 * @returns EPK-ключи для подписи транзакций
 */
export async function zkLoginFullFlow(
  walletName: string,
  provider: OAuthProvider = 'google',
  password?: string,
): Promise<EpkKeyPair> {
  console.log('[zkLogin] Starting full zkLogin flow for wallet:', walletName, 'provider:', provider);

  // 1. Загружаем SDK
  const sdk = await getSdk();
  const wallet = new sdk.Wallet(ENDPOINTS, null, API_URL, APP_ID);

  try {
    // 2. prepare_zk_login_v1 — генерируем nonce, эфемерный ключ
    console.log('[zkLogin] Step 1: prepare_zk_login_v1');
    const prepareResult = wallet.prepare_zk_login_v1();
    const savedData = {
      maxEpoch: Number(prepareResult.max_epoch),
      randomness: prepareResult.randomness,
      ephemeralPrivateKey: prepareResult.ephemeral_private_key,
    };

    // Сохраняем nonce для OAuth
    sessionStorage.setItem('zklogin_nonce', prepareResult.nonce);

    // 3. Вход через OAuth-провайдера
    console.log('[zkLogin] Step 2: OAuth login (' + provider + ')');
    const oauthResult = await loginWithOAuth(provider, prepareResult.nonce);

    // 4. complete_zk_login_with_prover_v1
    console.log('[zkLogin] Step 3: complete_zk_login_with_prover_v1');
    const userPassword = password || generatePassword();
    const completeResult = await wallet.complete_zk_login_with_prover_v1({
      savedData,
      jwt: oauthResult.idToken,
      jwtSub: oauthResult.sub,
      jwtAud: oauthResult.aud,
      userPassword,
      proverUrl: PROVER_URL,
    });

    // 5. add_zkp_factor — регистрируем EPK на контракте
    console.log('[zkLogin] Step 4: add_zkp_factor');
    const epkExpireAt = Number(completeResult.max_epoch);
    const jwkExpiresAt = epkExpireAt + 86400; // +24h как запас

    const addResult = await wallet.add_zkp_factor({
      wallet_name: walletName,
      proof: completeResult.zk_proof_compressed,
      epk: completeResult.ephemeral_public_key_in_hex,
      esk: completeResult.ephemeral_secret_key_in_hex,
      header_base_64: completeResult.header_base64,
      epk_expire_at: epkExpireAt,
      jwk_expires_at: jwkExpiresAt,
      kid: oauthResult.kid,
      sub: oauthResult.sub,
      password: userPassword,
      zkid: completeResult.zkid,
    });

    // 6. Сохраняем EPK-ключ
    const epkKey: EpkKeyPair = {
      public: addResult.signing_keys.public,
      secret: addResult.signing_keys.secret,
      walletName: addResult.name,
      walletAddress: addResult.address,
      expiresAt: epkExpireAt,
      savedAt: Math.floor(Date.now() / 1000),
    };

    storeEpkKey(epkKey);
    console.log('[zkLogin] EPK factor registered successfully, address:', addResult.address);

    return epkKey;
  } finally {
    wallet.free();
  }
}

// ─── Helpers ───

/**
 * Получить JWK modulus (n) провайдера по kid из его JWKS.
 * jwk_modulus_expire_at — срок действия JWK (у Google в certs нет exp,
 * берём запас от EPK-экспирации).
 */
async function fetchJwkModulus(
  issuer: string,
  kid: string,
  epkExpireAt: number,
): Promise<{ jwkModulus: string; jwkModulusExpireAt: number }> {
  const jwksUrl = JWKS_URLS[issuer];
  if (!jwksUrl) {
    throw new Error(`Нет JWKS-эндпоинта для провайдера ${issuer} — уточнить у @EugeneDAO`);
  }
  const res = await fetch(jwksUrl);
  if (!res.ok) {
    throw new Error(`JWKS недоступен: ${jwksUrl} → ${res.status}`);
  }
  const jwks = (await res.json()) as { keys: Array<{ kid: string; n: string }> };
  const key = jwks.keys.find((k) => k.kid === kid);
  if (!key?.n) {
    throw new Error(`JWK с kid=${kid} не найден в ${jwksUrl}`);
  }
  return {
    jwkModulus: key.n,
    // +24h запас, как в существующем флоу (jwk_expires_at)
    jwkModulusExpireAt: epkExpireAt + 86400,
  };
}

/**
 * Полный флоу создания СОБСТВЕННОГО кошелька dApp: Telegram → deploy_wallet.
 *
 * Отличие от zkLoginFullFlow: вместо add_zkp_factor на существующий AN Wallet
 * разворачивается новый Multifactor-контракт (deploy_wallet), который
 * принадлежит приложению. Это решает 502 ERR_FACTOR_EXPIRED.
 *
 * @param walletName — имя кошелька (пользователь видит его в AN Wallet)
 * @param provider — zkLogin-провайдер (по умолчанию Telegram)
 * @param password — пароль-соль (если не указан — генерируется и сохраняется)
 * @returns EPK-ключи + адрес нового кошелька
 */
export async function deployWalletFlow(
  walletName: string,
  provider: OAuthProvider = 'telegram',
  password?: string,
): Promise<EpkKeyPair> {
  console.log('[zkLogin] deploy_wallet flow, provider:', provider, 'name:', walletName);

  const sdk = await getSdk();
  const wallet = new sdk.Wallet(ENDPOINTS, null, API_URL, APP_ID);

  try {
    // 1. prepare_zk_login_v1 — nonce + эфемерный ключ
    const prepareResult = wallet.prepare_zk_login_v1();
    const savedData = {
      maxEpoch: Number(prepareResult.max_epoch),
      randomness: prepareResult.randomness,
      ephemeralPrivateKey: prepareResult.ephemeral_private_key,
    };

    // 2. OAuth-вход (Telegram oauth.gosh.sh / Google GIS)
    const oauth = await loginWithOAuth(provider, prepareResult.nonce);

    // 3. complete_zk_login_with_prover_v1 — Groth16-доказательство
    const userPassword = password || generatePassword();
    const completeResult = await wallet.complete_zk_login_with_prover_v1({
      savedData,
      jwt: oauth.idToken,
      jwtSub: oauth.sub,
      jwtAud: oauth.aud,
      userPassword,
      proverUrl: PROVER_URL,
    });

    // 4. JWK modulus провайдера (нужен deploy_wallet)
    const epkExpireAt = Number(completeResult.max_epoch);
    const { jwkModulus, jwkModulusExpireAt } = await fetchJwkModulus(
      oauth.iss,
      oauth.kid,
      epkExpireAt,
    );

    // 5. deploy_wallet — создаём свой Multifactor-кошелёк
    console.log('[zkLogin] deploy_wallet...');
    const deployResult = await wallet.deploy_wallet({
      wallet_name: walletName,
      zkid: completeResult.zkid,
      password: userPassword,
      proof: completeResult.zk_proof_compressed,
      epk: completeResult.ephemeral_public_key_in_hex,
      esk: completeResult.ephemeral_secret_key_in_hex,
      jwk_modulus: jwkModulus,
      jwk_modulus_expire_at: jwkModulusExpireAt,
      index_mod_4: completeResult.iss_base64_details.index_mod4,
      iss_base_64: completeResult.iss_base64_details.value,
      header_base_64: completeResult.header_base64,
      epk_expire_at: epkExpireAt,
      kid: oauth.kid,
      sub: oauth.sub,
    });

    // 6. Сохраняем EPK-ключ
    const epkKey: EpkKeyPair = {
      public: deployResult.signing_keys.public,
      secret: deployResult.signing_keys.secret,
      walletName: deployResult.name,
      walletAddress: deployResult.address,
      expiresAt: epkExpireAt,
      savedAt: Math.floor(Date.now() / 1000),
    };

    storeEpkKey(epkKey);
    console.log('[zkLogin] Wallet deployed:', deployResult.address);

    return epkKey;
  } finally {
    wallet.free();
  }
}

let sdkModule: any = null;
let sdkInitPromise: Promise<void> | null = null;

async function getSdk(): Promise<any> {
  if (sdkModule) return sdkModule;
  if (sdkInitPromise) {
    await sdkInitPromise;
    return sdkModule;
  }

  sdkInitPromise = (async () => {
    const mod = await import('@teamgosh/bee-sdk');
    const wasmUrl = new URL('@teamgosh/bee-sdk/bee_sdk_bg.wasm', import.meta.url);
    await mod.default({ module_or_path: wasmUrl });
    sdkModule = mod;
  })();

  await sdkInitPromise;
  return sdkModule;
}

/**
 * Декодировать payload JWT (base64url → JSON).
 */
function decodeJwtPayload(jwt: string): Record<string, any> {
  const parts = jwt.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const payload = parts[1];
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
}

/**
 * Декодировать header JWT (извлекает kid).
 */
function decodeJwtHeader(jwt: string): { kid: string } {
  const parts = jwt.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const header = parts[0];
  return JSON.parse(atob(header.replace(/-/g, '+').replace(/_/g, '/')));
}

/**
 * Сгенерировать случайный пароль-соль.
 */
function generatePassword(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Проверить, жив ли EPK-фактор через get_epk_expire_at.
 * Возвращает true если фактор валиден.
 */
export async function verifyEpkFactor(
  walletAddress: string,
  epkPublic: string,
): Promise<boolean> {
  try {
    const sdk = await getSdk();
    const wallet = new sdk.Wallet(ENDPOINTS, null, API_URL, APP_ID);
    try {
      const result = await wallet.get_epk_expire_at({
        epk: epkPublic,
        multifactor_address: walletAddress,
      });
      const expireAt = Number(result.epk_expire_at);
      const now = Math.floor(Date.now() / 1000);
      return expireAt > now + MIN_EPK_LIFE_TIME_SEC;
    } finally {
      wallet.free();
    }
  } catch {
    return false;
  }
}