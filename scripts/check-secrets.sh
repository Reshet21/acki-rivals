#!/bin/bash
# check-secrets.sh — защита от утечек секретов в публичный репозиторий.
#
# Проверяет ИНДЕКСИРОВАННЫЕ (staged) файлы перед коммитом:
#   1. запрещённые имена файлов (.env*, *.keys.json, .agent-sync/, AGENTS.md и т.п.)
#   2. паттерны секретов в содержимом (Vercel/GitHub токены, service role, приватные ключи)
#   3. весь tracked-список — не появилось ли лишнего в самом git (git ls-files)
#
# Использование:
#   scripts/check-secrets.sh            # проверка staged (для pre-commit hook)
#   scripts/check-secrets.sh --all      # полная проверка рабочего дерева
# Exit code: 0 — чисто, 1 — найдены утечки (коммит блокируется).

set -u

# ── 1. Запрещённые имена (в staged или в git ls-files) ──
FORBIDDEN_NAMES=(
  '^\.env([^.]|$)'
  '\.keys\.json$'
  '\.agent-sync/'
  '(^|/)AGENTS\.md$'
  '(^|/)STATE\.md$'
  '(^|/)ERROR_REPORT\.md$'
  '(^|/)LOOP\.md$'
  '(^|/)loop-(budget|constraints|run-log)\.md$'
  '(^|/)\.claude/'
  '(^|/)\.opencode/'
  '(^|/)payments/'
  '(^|/)secrets/'
  '(^|/)credentials/'
)

# ── 2. Паттерны секретов в содержимом ──
SECRET_PATTERNS=(
  'vcp_[A-Za-z0-9]{20,}'
  'ghp_[A-Za-z0-9]{20,}'
  'github_pat_[A-Za-z0-9_]{20,}'
  'glpat-[A-Za-z0-9_-]{20,}'
  'sb_secret_[A-Za-z0-9]{20,}'
  'sb_publishable_[A-Za-z0-9]{20,}'
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'   # JWT header (supabase service token)
  '-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----'
  'SUPABASE_SERVICE_ROLE_KEY=[A-Za-z0-9]'
  'TREASURY_OWNER_SECRET=[A-Za-z0-9]'
)

# ── 3. Сбор кандидатов ──
if [ "${1:-}" = "--all" ]; then
  FILES="$(git ls-files)"
else
  FILES="$(git diff --cached --name-only -z | tr '\0' '\n')"
fi

if [ -z "$FILES" ]; then
  exit 0
fi

FAIL=0

# ── Имена файлов ──
for f in $FILES; do
  for pat in "${FORBIDDEN_NAMES[@]}"; do
    if echo "$f" | grep -qE "$pat"; then
      echo "🔴 check-secrets: запрещённый файл в git: $f (паттерн: $pat)"
      FAIL=1
    fi
  done
done

# ── Содержимое ──
while IFS= read -r f; do
  [ -f "$f" ] || continue
  # пропускаем явно безопасные примеры
  case "$f" in
    .env.example) continue ;;
    scripts/check-secrets.sh) continue ;; # сам скрипт хранит паттерны по определению
  esac
  for pat in "${SECRET_PATTERNS[@]}"; do
    if grep -qE "$pat" "$f" 2>/dev/null; then
      echo "🔴 check-secrets: паттерн '$pat' найден в $f"
      FAIL=1
    fi
  done
done <<< "$FILES"

if [ "$FAIL" -eq 1 ]; then
  echo "⛔ Коммит заблокирован: утечка секретов. Убери файлы/строки из индекса."
  exit 1
fi

exit 0
