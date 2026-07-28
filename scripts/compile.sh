#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════
#  Acki Rivals — Local Contract Compiler
#  Компилирует .sol → .code + .abi через sold
#  Линкует .code → .tvc через tvm_linker
# ═══════════════════════════════════════════════════════════════

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/build"

echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo -e "${CYAN}  Acki Rivals — Contract Compiler         ${NC}"
echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo ""

mkdir -p "$BUILD_DIR"

# ─── 1. Проверка sold ────────────────────────────────
echo -e "${YELLOW}[1/4] Проверка sold...${NC}"

SOLD=""
if command -v sold &>/dev/null; then
  SOLD=$(command -v sold)
  echo -e "${GREEN}✅ sold найден: $SOLD${NC}"
else
  # Ищем в ~/.cargo/bin или в PROJECT_DIR
  for TRY in "$HOME/.cargo/bin/sold" "$PROJECT_DIR/sold/target/release/sold" "$PROJECT_DIR/TVM-Solidity-Compiler/sold/target/release/sold"; do
    if [ -x "$TRY" ]; then
      SOLD="$TRY"
      echo -e "${GREEN}✅ sold найден: $SOLD${NC}"
      break
    fi
  done
fi

if [ -z "$SOLD" ]; then
  echo -e "${YELLOW}⚠️  sold не установлен. Установка через cargo...${NC}"
  if ! command -v cargo &>/dev/null; then
    echo -e "${RED}❌ cargo (Rust) не найден!${NC}"
    echo ""
    echo -e "${YELLOW}Варианты:${NC}"
    echo "  1. Установи Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo "  2. Используй GitHub Actions: запушь коммит → CI сам соберёт"
    echo ""
    echo -e "${YELLOW}Рекомендуется вариант 2 — CI соберёт быстрее.${NC}"
    exit 1
  fi

  echo "Клонирую TVM-Solidity-Compiler..."
  git clone --depth 1 --recurse-submodules \
    https://github.com/everx-labs/TVM-Solidity-Compiler.git \
    "$PROJECT_DIR/TVM-Solidity-Compiler" 2>/dev/null || true

  echo "Сборка sold (займёт ~5-10 мин)..."
  cd "$PROJECT_DIR/TVM-Solidity-Compiler/sold"
  cargo build --release
  SOLD="$PROJECT_DIR/TVM-Solidity-Compiler/sold/target/release/sold"
  cd "$PROJECT_DIR"
  echo -e "${GREEN}✅ sold собран${NC}"
fi

# ─── 2. Проверка tvm_linker ──────────────────────────
echo -e "${YELLOW}[2/4] Проверка tvm_linker...${NC}"

TVM_LINKER=""
if command -v tvm_linker &>/dev/null; then
  TVM_LINKER=$(command -v tvm_linker)
  echo -e "${GREEN}✅ tvm_linker найден: $TVM_LINKER${NC}"
else
  for TRY in "$HOME/.cargo/bin/tvm_linker" "$PROJECT_DIR/TVM-Solidity-Compiler/tvm_linker/target/release/tvm_linker"; do
    if [ -x "$TRY" ]; then
      TVM_LINKER="$TRY"
      echo -e "${GREEN}✅ tvm_linker найден: $TVM_LINKER${NC}"
      break
    fi
  done
fi

if [ -z "$TVM_LINKER" ]; then
  echo -e "${YELLOW}⚠️  tvm_linker не найден. Собираю...${NC}"
  if [ -d "$PROJECT_DIR/TVM-Solidity-Compiler/tvm_linker" ]; then
    cd "$PROJECT_DIR/TVM-Solidity-Compiler/tvm_linker"
    cargo build --release
    TVM_LINKER="$PROJECT_DIR/TVM-Solidity-Compiler/tvm_linker/target/release/tvm_linker"
    cd "$PROJECT_DIR"
    echo -e "${GREEN}✅ tvm_linker собран${NC}"
  else
    echo -e "${YELLOW}⚠️  tvm_linker не собран — .tvc не будет создан. Используй GitHub Actions.${NC}"
  fi
fi

# ─── 3. Поиск stdlib_sol.tvm ─────────────────────────
STDLIB=""
if [ -n "$TVM_LINKER" ]; then
  echo -e "${YELLOW}[3/4] Поиск stdlib_sol.tvm...${NC}"
  for TRY in \
    "$PROJECT_DIR/TVM-Solidity-Compiler/tvm_linker/stdlib_sol.tvm" \
    "$PROJECT_DIR/TVM-Solidity-Compiler/tvm_linker/res/stdlib_sol.tvm" \
    "$PROJECT_DIR/TVM-Solidity-Compiler/solidity/stdlib/stdlib_sol.tvm" \
    "$PROJECT_DIR/TVM-Solidity-Compiler/libs/stdlib_sol.tvm"; do
    if [ -f "$TRY" ]; then
      STDLIB="$TRY"
      echo -e "${GREEN}✅ stdlib_sol.tvm: $STDLIB${NC}"
      break
    fi
  done
  if [ -z "$STDLIB" ]; then
    echo -e "${YELLOW}⚠️  stdlib_sol.tvm не найден — tvm_linker может использовать встроенную.${NC}"
  fi
fi

# ─── 4. Компиляция ──────────────────────────────────
echo -e "${YELLOW}[4/4] Компиляция контрактов...${NC}"

CONTRACTS=(
  "GameCardNFTToken"
  "GameCardNFTCollection"
  "GameMatch"
  "PvPStaking"
  "Marketplace"
)

# Компилируем interfaces.sol отдельно (он — зависимость)
echo "📦 Compiling interfaces.sol..."
$SOLD \
  --tvm-version gosh \
  --output-dir "$BUILD_DIR" \
  --contract "$PROJECT_DIR/contracts/interfaces.sol" \
  "$PROJECT_DIR/contracts/interfaces.sol" || {
  echo -e "${RED}❌ interfaces.sol failed${NC}"
  exit 1
}

for CONTRACT in "${CONTRACTS[@]}"; do
  SRC="$PROJECT_DIR/contracts/${CONTRACT}.sol"
  if [ ! -f "$SRC" ]; then
    echo -e "${YELLOW}⚠️  ${SRC} — пропускаем${NC}"
    continue
  fi

  echo -e "${CYAN}📦 Compiling ${CONTRACT}...${NC}"
  $SOLD \
    --tvm-version gosh \
    --output-dir "$BUILD_DIR" \
    --contract "$PROJECT_DIR/contracts/interfaces.sol" \
    "$SRC" || {
    echo -e "${RED}❌ ${CONTRACT} failed${NC}"
    exit 1
  }

  # Линковка .code → .tvc
  if [ -f "$TVM_LINKER" ] && [ -f "$BUILD_DIR/${CONTRACT}.code" ]; then
    echo -e "   🔗 Linking ${CONTRACT}.code → .tvc..."
    TVM_LINKER_CMD=("$TVM_LINKER" compile "$BUILD_DIR/${CONTRACT}.code" --abi "$BUILD_DIR/${CONTRACT}.abi.json" -o "$BUILD_DIR/${CONTRACT}.tvc")
    if [ -n "$STDLIB" ]; then
      TVM_LINKER_CMD+=(--lib "$STDLIB")
    fi
    "${TVM_LINKER_CMD[@]}" || {
      echo -e "${YELLOW}   ⚠️  tvm_linker failed for ${CONTRACT} (продолжаем без .tvc)${NC}"
    }
  fi
done

# ─── Итог ────────────────────────────────────────────
echo ""
echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo -e "${CYAN}  build/ contents:                        ${NC}"
echo -e "${CYAN}══════════════════════════════════════════${NC}"
ls -lh "$BUILD_DIR"/*.{tvc,code,abi.json} 2>/dev/null || echo "(no files)"
echo ""

TVC_COUNT=$(ls "$BUILD_DIR"/*.tvc 2>/dev/null | wc -l)
if [ "$TVC_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✅ ${TVC_COUNT} .tvc файлов готово!${NC}"
  echo ""
  echo -e "Деплой: ${CYAN}bash scripts/deploy.sh${NC}"
else
  echo -e "${YELLOW}⚠️  .tvc файлы не созданы.${NC}"
  echo "   Используй GitHub Actions для получения .tvc."
  echo "   1. Запушь коммит: git add . && git commit -m 'contracts' && git push"
  echo "   2. GitHub Actions → скомпилирует → артефакты → скачай build/"
  echo "   3. Запусти: bash scripts/deploy.sh"
fi
