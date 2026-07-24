#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════
#  Acki Rivals — Deploy to Shellnet
#  Деплоит всю связку: Collection → TokenCode → Mint → GameMatch
#  → PvPStaking → Marketplace
# ═══════════════════════════════════════════════════════════════

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Acki Rivals — Full Deploy to Shellnet    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Paths ──────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/build"
KEYS_DIR="$PROJECT_DIR/keys"

# ─── 1. Check dependencies ─────────────────────────────
echo -e "${YELLOW}[1/7] Проверка инструментов...${NC}"

if ! command -v tvm-cli &> /dev/null; then
    echo -e "${RED}❌ tvm-cli не найден!${NC}"
    echo "   curl -sL https://github.com/everx-labs/ever-cli/releases/latest/download/ever-cli-linux.gz | gunzip > tvm-cli"
    exit 1
fi
echo -e "${GREEN}✅ tvm-cli $(tvm-cli --version 2>&1 | head -1)${NC}"

# ─── 2. Check .tvc files ─────────────────────────────
echo -e "${YELLOW}[2/7] Проверка .tvc файлов...${NC}"

REQUIRED=(
    "GameCardNFTToken.tvc"
    "GameCardNFTCollection.tvc"
    "GameMatch.tvc"
    "PvPStaking.tvc"
    "Marketplace.tvc"
)

for F in "${REQUIRED[@]}"; do
    if [ ! -f "$BUILD_DIR/$F" ]; then
        echo -e "${RED}❌ $F не найден в build/${NC}"
        echo "   Сначала скомпилируй контракты:"
        echo "   - GitHub Actions: запушь контракты, скачай артефакт"
        echo "   - Локально: запусти scripts/compile.sh"
        exit 1
    fi
done
echo -e "${GREEN}✅ Все .tvc файлы на месте${NC}"

# ─── 3. Setup Shellnet ────────────────────────────────
echo -e "${YELLOW}[3/7] Настройка Shellnet...${NC}"
tvm-cli config -g --url shellnet.ackinacki.org 2>/dev/null || true
echo -e "${GREEN}✅ Shellnet настроен${NC}"

# ─── 4. Generate keys ────────────────────────────────
echo -e "${YELLOW}[4/7] Ключи деплоя...${NC}"
mkdir -p "$KEYS_DIR"

if [ ! -f "$KEYS_DIR/deploy.keys.json" ]; then
    SEED=$(tvm-cli genphrase --dump "$KEYS_DIR/deploy.keys.json" 2>&1 | head -1)
    echo -e "${GREEN}✅ Ключи сгенерированы: $KEYS_DIR/deploy.keys.json${NC}"
    echo -e "${RED}⚠️  СИД-ФРАЗА: $SEED${NC}"
    echo -e "${RED}⚠️  СОХРАНИ ЕЁ В НАДЁЖНОМ МЕСТЕ!${NC}"
else
    echo -e "${GREEN}✅ Ключи существуют: $KEYS_DIR/deploy.keys.json${NC}"
fi

PUBKEY=$(python3 -c "import json; print(json.load(open('$KEYS_DIR/deploy.keys.json'))['public'])")

# ─── 5. Calculate addresses ───────────────────────────
echo -e "${YELLOW}[5/7] Расчёт адресов...${NC}"

calc_addr() {
    local TVC="$1"
    local PARAMS="${2:-}"
    if [ -n "$PARAMS" ]; then
        tvm-cli genaddr "$TVC" --setkey "$KEYS_DIR/deploy.keys.json" --data "$PARAMS" 2>&1 \
            | awk '/Raw address:/{print $NF}'
    else
        tvm-cli genaddr "$TVC" --setkey "$KEYS_DIR/deploy.keys.json" 2>&1 \
            | awk '/Raw address:/{print $NF}'
    fi
}

COLLECTION_ADDR=$(calc_addr "$BUILD_DIR/GameCardNFTCollection.tvc" \
    "{\"_ownerPubkey\": \"0x$PUBKEY\", \"_admin\": \"0x0000000000000000000000000000000000000000\"}")

GAMEMATCH_ADDR=$(calc_addr "$BUILD_DIR/GameMatch.tvc")

PVPSTAKING_ADDR=$(calc_addr "$BUILD_DIR/PvPStaking.tvc")

MARKETPLACE_ADDR=$(calc_addr "$BUILD_DIR/Marketplace.tvc")

echo -e "${CYAN}📦 Collection:     $COLLECTION_ADDR${NC}"
echo -e "${CYAN}🎲 GameMatch:      $GAMEMATCH_ADDR${NC}"
echo -e "${CYAN}⚔️ PvPStaking:     $PVPSTAKING_ADDR${NC}"
echo -e "${CYAN}🏪 Marketplace:    $MARKETPLACE_ADDR${NC}"

# ─── 6. Deploy instructions ───────────────────────────
echo -e "${YELLOW}[6/7] Готов к деплою! Выполни шаги:${NC}"
echo ""

echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ШАГ 1 — Попроси SHELL токены в Telegram чате   ${NC}"
echo -e "${GREEN}  Acki Nacki на адрес: ${NC}"
echo -e "${CYAN}  $COLLECTION_ADDR${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo ""

echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ШАГ 2 — Деплой GameCardNFTCollection           ${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo "tvm-cli deploy \\"
echo "  --abi $BUILD_DIR/GameCardNFTCollection.abi.json \\"
echo "  --sign $KEYS_DIR/deploy.keys.json \\"
echo "  $BUILD_DIR/GameCardNFTCollection.tvc \\"
echo "  '{\"_ownerPubkey\": \"0x$PUBKEY\", \"_admin\": \"АДРЕС_АДМИНА\"}'"
echo ""

echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ШАГ 3 — Установить код токена (setTokenCode)   ${NC}"
echo -e "${GREEN}  ⚠️  Нужен TvmCell из GameCardNFTToken.tvc      ${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo "tvm-cli call \\"
echo "  --abi $BUILD_DIR/GameCardNFTCollection.abi.json \\"
echo "  --sign $KEYS_DIR/deploy.keys.json \\"
echo "  $COLLECTION_ADDR \\"
echo "  setTokenCode \\"
echo "  '{\"_tokenCode\": \"te6ccgEC...\"}'"
echo ""

echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ШАГ 4 — Заминтить тестовую карту               ${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo "tvm-cli call \\"
echo "  --abi $BUILD_DIR/GameCardNFTCollection.abi.json \\"
echo "  --sign $KEYS_DIR/deploy.keys.json \\"
echo "  $COLLECTION_ADDR \\"
echo "  mint \\"
echo "  '{\"gameCardId\": 1, \"data\": {\"cardId\": 1, \"name\": \"Малый Блок\", \"power\": 3, \"damage\": 2, \"ability\": \"+1 pillz\", \"rarity\": \"common\", \"clan\": \"Неоновые Наемники\", \"uri\": \"https://acki-rivals.vercel.app/api/cards/1.json\"}, \"to\": \"ТВОЙ_АДРЕС\"}'"
echo ""

echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ШАГ 5 — Деплой GameMatch                       ${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo "tvm-cli deploy \\"
echo "  --abi $BUILD_DIR/GameMatch.abi.json \\"
echo "  --sign $KEYS_DIR/deploy.keys.json \\"
echo "  $BUILD_DIR/GameMatch.tvc \\"
echo "  '{\"_ownerPubkey\": \"0x$PUBKEY\"}'"
echo ""

echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ШАГ 6 — Деплой PvPStaking                      ${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo "tvm-cli deploy \\"
echo "  --abi $BUILD_DIR/PvPStaking.abi.json \\"
echo "  --sign $KEYS_DIR/deploy.keys.json \\"
echo "  $BUILD_DIR/PvPStaking.tvc \\"
echo "  '{\"_ownerPubkey\": \"0x$PUBKEY\", \"_admin\": \"АДРЕС_АДМИНА\", \"_nacklTokenRoot\": \"АДРЕС_NACKL_TOKEN_ROOT\"}'"
echo ""

echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ШАГ 7 — Деплой Marketplace                     ${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo "tvm-cli deploy \\"
echo "  --abi $BUILD_DIR/Marketplace.abi.json \\"
echo "  --sign $KEYS_DIR/deploy.keys.json \\"
echo "  $BUILD_DIR/Marketplace.tvc \\"
echo "  '{\"_ownerPubkey\": \"0x$PUBKEY\", \"_admin\": \"АДРЕС_АДМИНА\", \"_nacklTokenRoot\": \"АДРЕС_NACKL_TOKEN_ROOT\"}'"
echo ""

# ─── 7. Summary ──────────────────────────────────────
echo -e "${YELLOW}[7/7] Сводка по деплою${NC}"
echo ""
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}              КОНФИГУРАЦИЯ ДЕПЛОЯ                  ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo "COLLECTION_ADDRESS=$COLLECTION_ADDR"
echo "GAMEMATCH_ADDRESS=$GAMEMATCH_ADDR"
echo "PVPSTAKING_ADDRESS=$PVPSTAKING_ADDR"
echo "MARKETPLACE_ADDRESS=$MARKETPLACE_ADDR"
echo "OWNER_PUBKEY=0x$PUBKEY"
echo ""
echo -e "${YELLOW}⚙️  После деплоя, в PvPStaking вызови:${NC}"
echo "  setGameMatch($GAMEMATCH_ADDR)  — привязать GameMatch"
echo ""
echo -e "${YELLOW}⚙️  После деплоя, в Marketplace/PvPStaking вызови:${NC}"
echo "  deployTokenWallet()           — развернуть TIP-3 кошелёк"
echo "  setNacklTokenRoot(АДРЕС)       — указать NACKL TokenRoot"
echo ""

echo -e "${GREEN}✅ Скрипт завершён!${NC}"
