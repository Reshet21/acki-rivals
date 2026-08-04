/**
 * zkLoginService.ts
 *
 * Полный флоу zkLogin для браузера:
 * 1. prepare_zk_login_v1() → nonce + эфемерный ключ
 * 2. Google OAuth (редирект) → id_token
 * 3. complete_zk_login_with_prover_v1() → Groth16-доказательство
 * 4. add_zkp_factor() → регистрация EPK на контракте Multifactor
 * 5. Использование EPK-keypair для send_tokens_direct
 *
 * Основано на документации интеграции zkLogin для Acki Nacki.
 *
 * @see ИНТЕГРАЦИЯ_кошелька_zkLogin.md
 */

import { ENDPOINTS, API_URL, APP_ID } from './beeEngine';

// Константы приложения (добыты из официального приложения Acki Nacki)
const CLIENT_ID = '222414061721-4tu2gsfms6rvagqvt4mp0mjmbom6flbl.apps.googleusercontent.com';
const REDIRECT_URI = 'com.googleusercontent.apps.222414061721-4tu2gsfms6rvagqvt4mp0mjmbom6flbl:/oauth2redirect';
const PROVER_URL = 'https://proover.ackinacki.org/v1';

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
 * Открыть Google OAuth в новом окне и получить id_token.
 *
 * Использует popup вместо редиректа, чтобы не терять состояние dApp.
 * После успешного входа id_token будет отправлен обратно через postMessage.
 *
 * @returns {Promise<{ idToken: string; sub: string; aud: string; kid: string }>}
 */
export async function loginWithGoogle(): Promise<{
  idToken: string;
  sub: string;
  aud: string;
  kid: string;
}> {
  // Генерируем code_verifier и code_challenge для PKCE
  const codeVerifier = generateCodeVerifier();

  // Сохраняем verifier для обмена code → token
  sessionStorage.setItem('zklogin_code_verifier', codeVerifier);

  // Строим URL Google OAuth
  const state = crypto.randomUUID();
  sessionStorage.setItem('zklogin_oauth_state', state);

  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  return new Promise((resolve, reject) => {
    // Открываем popup
    const popup = window.open(
      oauthUrl,
      'google-login',
      'width=600,height=700,popup=yes',
    );

    if (!popup) {
      reject(new Error('Pop-up заблокирован. Разрешите всплывающие окна для этого сайта.'));
      return;
    }

    // Слушаем сообщение от popup (через redirect_uri)
    const handleMessage = async (event: MessageEvent) => {
      // Проверяем origin (redirect_uri)
      if (event.origin !== window.location.origin) return;

      const { type, code, error, state: returnedState } = event.data || {};

      if (type === 'zklogin_oauth_code') {
        window.removeEventListener('message', handleMessage);

        if (error) {
          reject(new Error(`Google OAuth error: ${error}`));
          return;
        }

        if (returnedState !== sessionStorage.getItem('zklogin_oauth_state')) {
          reject(new Error('State mismatch — возможна CSRF-атака'));
          return;
        }

        // Обмениваем code на id_token
        exchangeCodeForToken(code).then(resolve).catch(reject);
      }
    };

    window.addEventListener('message', handleMessage);

    // Таймаут на 5 минут
    setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      popup.close();
      reject(new Error('Время ожидания входа через Google истекло (5 мин).'));
    }, 5 * 60 * 1000);
  });
}

/**
 * Обменять authorization code на id_token.
 */
async function exchangeCodeForToken(code: string): Promise<{
  idToken: string;
  sub: string;
  aud: string;
  kid: string;
}> {
  const savedVerifier = sessionStorage.getItem('zklogin_code_verifier');
  if (!savedVerifier) {
    throw new Error('Code verifier not found');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
      code_verifier: savedVerifier,
    }),
  });

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${errText}`);
  }

  const tokenData = await tokenResponse.json();
  const idToken: string = tokenData.id_token;

  // Декодируем JWT (без проверки подписи — только читаем поля)
  const jwtPayload = decodeJwtPayload(idToken);
  const kid = decodeJwtHeader(idToken).kid;

  return {
    idToken,
    sub: jwtPayload.sub,
    aud: jwtPayload.aud,
    kid,
  };
}

/**
 * Создать popup-обработчик для редиректа OAuth.
 * Вызывается из App.tsx или WalletPanel.tsx при монтировании.
 * Если в URL есть code от Google — обрабатываем его.
 */
export function handleOAuthRedirect(): void {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const error = urlParams.get('error');

  if (code || error) {
    // Очищаем URL от параметров
    window.history.replaceState({}, '', window.location.pathname);

    // Отправляем код обратно в открывшее окно
    if (window.opener) {
      window.opener.postMessage(
        { type: 'zklogin_oauth_code', code, error, state },
        window.location.origin,
      );
      window.close();
    }
  }
}

/**
 * Полный флоу zkLogin: вход через Google → регистрация EPK → возврат ключей.
 *
 * @param walletName — имя кошелька (например, "v_o_g_e_l")
 * @param password — пароль-соль кошелька (если не указан — генерируется)
 * @returns EPK-ключи для подписи транзакций
 */
export async function zkLoginFullFlow(
  walletName: string,
  password?: string,
): Promise<EpkKeyPair> {
  console.log('[zkLogin] Starting full zkLogin flow for wallet:', walletName);

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

    // 3. Вход через Google
    console.log('[zkLogin] Step 2: Google OAuth login');
    const googleResult = await loginWithGoogle();

    // 4. complete_zk_login_with_prover_v1
    console.log('[zkLogin] Step 3: complete_zk_login_with_prover_v1');
    const userPassword = password || generatePassword();
    const completeResult = await wallet.complete_zk_login_with_prover_v1({
      savedData,
      jwt: googleResult.idToken,
      jwtSub: googleResult.sub,
      jwtAud: googleResult.aud,
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
      kid: googleResult.kid,
      sub: googleResult.sub,
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
 * Сгенерировать PKCE code_verifier.
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64urlEncode(array);
}

/**
 * Сгенерировать PKCE code_challenge (S256).
 */
function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  return crypto.subtle.digest('SHA-256', data).then((hash) => {
    const array = new Uint8Array(hash);
    return base64urlEncode(array);
  });
}

function base64urlEncode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
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