# 🃏 Acki Rivals — Blockchain Card Battle on Acki Nacki

**Карточная PvP-игра на блокчейне Acki Nacki.**  
Каждая карта — TIP-4 NFT. Покупай паки, собирай коллекцию, торгуй на маркетплейсе, сражайся с AI или другими игроками.

---

## 📋 Содержание

- [Архитектура](#архитектура)
- [Смарт-контракты](#смарт-контракты)
  - [interfaces.sol](#interfacessol)
  - [GameCardNFTToken.sol](#gamecardnfttokensol)
  - [GameCardNFTCollection.sol](#gamecardnftcollectionsol)
  - [GameMatch.sol](#gamematchsol)
  - [PvPStaking.sol](#pvpstakingsol)
  - [Marketplace.sol](#marketplacesol)
- [Фронтенд](#фронтенд)
- [CI/CD](#cicd)
- [Деплой](#деплой)
- [Разработка](#разработка)
- [Переменные окружения](#переменные-окружения)

---

## Архитектура

```
┌─────────────────────────────────────────────────┐
│                 AN Wallet (Bee SDK)              │
│        ┌─────────────────────────────────┐       │
│        │         Acki Rivals Frontend    │       │
│        │  ┌─────┐ ┌──────┐ ┌─────────┐  │       │
│        │  │Shop │ │Deck  │ │Marketpl.│  │       │
│        │  └──┬──┘ └──┬───┘ └────┬────┘  │       │
│        │     │       │          │        │       │
│        │  ┌──▼───────▼──────────▼────┐   │       │
│        │  │    contractService.ts    │   │       │
│        │  └──────────┬───────────────┘   │       │
│        └─────────────┼───────────────────┘       │
└──────────────────────┼───────────────────────────┘
                       │
        ┌──────────────┼──────────────────┐
        │  ┌───────────▼──────────────┐   │
        │  │    GameCardNFTCollection  │   │
        │  │  (TIP-4.1/4.2 коллекция)  │   │
        │  └───────┬───────────────────┘   │
        │          │ deploys               │
        │  ┌───────▼───────────────────┐   │
        │  │    GameCardNFTToken       │   │
        │  │  (TIP-4.1/4.2 NFT карта)  │   │
        │  └───────────────────────────┘   │
        │                                  │
        │  ┌───────────────────────────┐   │
        │  │      Marketplace          │   │
        │  │  (P2P торговля за NACKL)  │   │
        │  └───────────────────────────┘   │
        │                                  │
        │  ┌───────────────────────────┐   │
        │  │      PvPStaking           │   │
        │  │  (NACKL escrow + матчи)   │   │
        │  └───────────────────────────┘   │
        │                                  │
        │  ┌───────────────────────────┐   │
        │  │      GameMatch            │   │
        │  │  (Commit-reveal RNG)      │   │
        │  └───────────────────────────┘   │
        │                                  │
        │         Acki Nacki Blockchain    │
        └──────────────────────────────────┘
```

---

## Смарт-контракты

Все контракты написаны на **ton-solidity >= 0.58.0** под архитектуру **GOSH** (Acki Nacki).

### interfaces.sol

Базовые интерфейсы для всего стека:

| Интерфейс | Описание |
|-----------|----------|
| `ITIP4_1NFT` | TIP-4.1: `transfer(to, sendGasTo, callbacks)`, `owner()`, `collection()` |
| `ITIP4_1Collection` | TIP-4.1: `supportsInterface()`, `tokenAddresses()`, `totalSupply()` |
| `ITIP4_2JSON` | TIP-4.2: метаданные + `TokenMetadataUpdated` |
| `ITIP4_3Index` / `ITIP4_3IndexBasis` | TIP-4.3: индексы (v2, зарезервированы) |
| `ITIP3TokenRoot` / `ITIP3TokenWallet` | TIP-3: стандарт fungible tokens |
| `IAcceptTokensTransferCallback` | Callback для приёма TIP-3 токенов |
| `IGameMatch` | Интерфейс GameMatch контракта |
| `IPvPStaking` | Интерфейс PvPStaking |
| `IMarketplace` | Интерфейс маркетплейса |

### GameCardNFTToken.sol

Индивидуальный TIP-4.1/4.2 NFT токен для каждой карты.

**Ключевые особенности:**
- **Уникальный адрес** через `varInit { _initTokenId: tokenId }` — защита от front-run mint
- **TIP-4.1 transfer** с поддержкой callback'ов
- **`simpleTransfer()`** — упрощённый трансфер для маркетплейса
- **Улучшение (upgrade)** — увеличение звёзд, силы и урона (только от коллекции)
- **Сожжение (burn)** — владелец может сжечь карту
- **`supportsInterface()`** — TIP-4.1 (0x3204ec29), TIP-4.2 (0x9b37ea52), ERC-165 (0x01ffc9a7)

**Игровые характеристики:**
- `cardId` — ID карты в игре (1-44)
- `power` — сила
- `damage` — урон
- `ability` — способность
- `rarity` — редкость
- `clan` — клан (Frostguard / Emberclaw)
- `stars` — звёзды: 0-5, +1 к power и damage за звезду

### GameCardNFTCollection.sol

TIP-4.1/4.2 коллекция — фабрика карт.

**Возможности:**
- **Mint** — выпуск одной карты
- **Batch mint** — до 8 карт за раз (ограничение gas cap Acki Nacki)
- **CardTemplate registry** — регистрация шаблонов карт (по `cardId`)
- **Pausable** — экстренная остановка минтинга
- **Royalty** — роялти 5% (настраивается, макс 10%)
- **`supportsInterface()`** — полная поддержка TIP-4.1/4.2
- **Owner/Admin разделение** — владелец (pubkey) и администратор (address)
- **TODO v2:** TIP-4.3 Index/IndexBasis — отдельные контракты для поиска NFT

### GameMatch.sol

Commit-reveal механизм для честного RNG в PvP.

**Как работает:**
1. **Commіт:** игроки отправляют хэш (SHA-256) своего секрета
2. **Reveal:** игроки раскрывают секрет
3. **Результат:** `winner = (hashA xor hashB) mod 2` — детерминированный, но непредсказуемый до reveal

**Защита:**
- Таймаут reveal — если игрок не раскрыл секрет, второй выигрывает автоматически
- AllowList для PvPStaking — только авторизованные контракты могут вызывать `startMatch`

### PvPStaking.sol

NACKL escrow контракт для PvP ставок.

**Механика:**
- Игроки отправляют NACKL через TIP-3 `transfer()` с payload `{ action, roomId }`
- `onAcceptTokensTransfer()` обрабатывает входящие переводы:
  - `action = 0` → создание комнаты
  - `action = 1` → присоединение к комнате
- После создания комнаты вызывается `GameMatch.startMatch()`
- По результату матча (через `onGameMatchResult`) — NACKL уходят победителю
- **TODO:** cancel комната по таймауту, распределение при ничьей

### Marketplace.sol

P2P маркетплейс для торговли NFT картами за NACKL.

**Как работает:**
1. **List:** продавец вызывает `setManager(marketplaceAddress)` на своей NFT, затем `list()`
2. **Buy:** покупатель отправляет NACKL через TIP-3 `transfer()` с payload `{ action: "buy", tokenAddress }`
3. **Cancel:** продавец отменяет листинг
4. **Fee:** комиссия маркетплейса (по умолчанию 2.5%)

**Обработка платежа:**
- Основной путь: `onAcceptTokensTransfer()` — TIP-3 callback с декодированием payload
- Запасной путь: `buy()` — для кошельков без поддержки TIP-3 payload

---

## Фронтенд

**Стек:** React 18 + Vite + TypeScript + Tailwind CSS

**Ключевые компоненты:**

| Компонент | Описание |
|-----------|----------|
| `Shop.tsx` | Магазин паков с анимацией открытия |
| `Marketplace.tsx` | P2P торговая площадка (3 вкладки: купить/мои/продать) |
| `DeckBuilder.tsx` | Сбор колоды (макс 8 карт) |
| `BattleScreen.tsx` | PvE битва против AI |
| `PvpLobby.tsx` | Лобби PvP матчей |
| `PvpBattleScreen.tsx` | PvP битва в реальном времени |
| `WalletPanel.tsx` | Подключение AN Wallet |
| `MiningPanel.tsx` | Майнинг NACKL/SHELL |

**Сервисы:**

| Сервис | Описание |
|--------|----------|
| `beeEngine.ts` | Wrapper для @teamgosh/bee-sdk (подключение кошелька, балансы, майнинг) |
| `contractService.ts` | Взаимодействие со смарт-контрактами (mint, marketplace, чтение NFT) |
| `paymentService.ts` | Покупка паков за NACKL |
| `pvpService.ts` | PvP матчмейкинг через Supabase |

---

## CI/CD

**GitHub Actions:** `.github/workflows/compile-contracts.yml`

Процесс сборки:
1. **Checkout** репозитория
2. **Установка sold** (сборка из исходников через `cargo`)
3. **Компиляция** всех `.sol` файлов → `.code` + `.abi.json`
4. **TVM Linker** (TODO: добавить `tvm-linker` для получения `.tvc`)
5. **Smoke test** — проверка что `.code` файлы > 500 байт
6. **SHA256 checksums** для артефактов

**Netlify:** `netlify.toml` — деплой фронта
**Vercel:** `vercel.json` — альтернативный деплой фронта (live на `acki-rivals.vercel.app`)

---

## Деплой

### 1. Подготовка

```bash
# Установить sold (если нет)
cargo install --git https://github.com/everx-labs/TVM-Solidity-Compiler sold

# Собрать контракты
./scripts/deploy.sh build
```

### 2. Деплой контрактов в Shellnet

```bash
# Настроить переменные
export SHELLNET_RPC=https://shellnet.ackinacki.org
export OWNER_PUBKEY=<ваш pubkey>
export ADMIN_ADDRESS=<ваш адрес>

# Задеплоить коллекцию
./scripts/deploy.sh deploy-collection $OWNER_PUBKEY $ADMIN_ADDRESS

# Задеплоить маркетплейс
./scripts/deploy.sh deploy-marketplace $OWNER_PUBKEY $ADMIN_ADDRESS $NACKL_TOKEN_ROOT

# Установить код токена в коллекции
./scripts/deploy.sh set-token-code $COLLECTION_ADDRESS $TOKEN_CODE

# Зарегистрировать шаблоны карт
./scripts/deploy.sh set-templates $COLLECTION_ADDRESS $TEMPLATES_JSON
```

### 3. Фронтенд

```bash
# Установить зависимости
npm install

# Запустить dev сервер
npm run dev

# Собрать для прода
npm run build
```

---

## Переменные окружения

Создай `.env` из `.env.example`:

```env
# Acki Nacki RPC
VITE_AN_RPC_URL=https://mainnet.ackinacki.org

# Адреса контрактов (после деплоя)
VITE_COLLECTION_ADDRESS=0:...
VITE_MARKETPLACE_ADDRESS=0:...
VITE_GAMEMATCH_ADDRESS=0:...
VITE_PVPSTAKING_ADDRESS=0:...

# NACKL TokenRoot на Acki Nacki
VITE_NACKL_TOKEN_ROOT=0:...

# Supabase (только для PvP матчмейкинга, если используется)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Telegram Bot ID для Mini App
VITE_TELEGRAM_BOT_ID=
```

---

## Разработка

```bash
# Установка
git clone https://github.com/Reshet21/acki-rivals.git
cd acki-rivals
npm install

# Запуск
npm run dev     # http://localhost:5173

# Сборка
npm run build   # → dist/

# Линтинг
npm run lint    # tsc --noEmit
```

---

## TODO / Фазы

- [x] **B1:** interfaces.sol — TIP-3, TIP-4.1/4.2/4.3, IGameMatch, IMarketplace
- [x] **B2:** GameCardNFTToken.sol v2 — полный TIP-4.1/4.2
- [x] **B3:** GameCardNFTCollection.sol v2 — TIP-4 с mint batch + pause + royalty
- [x] **B4:** GameMatch.sol — commit-reveal RNG
- [x] **B5:** PvPStaking.sol — NACKL escrow
- [x] **B6:** Marketplace.sol — P2P торговля
- [ ] **B7:** Деплой в Shellnet + проверка
- [ ] **v2:** TIP-4.3 Index/IndexBasis контракты
- [ ] **v2:** Real-time on-chain PvP (Supabase → GameMatch)
- [ ] **v2:** Встроенный Marketplace.Listings indexer
- [ ] **v2:** Своя Wrapped NACKL (accTIP-3) для внутренних расчётов

---

## Лицензия

MIT
