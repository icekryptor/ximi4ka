#!/usr/bin/env bash
# Скрипт: добавить все изменения, закоммитить и отправить на GitHub.
# Используется глобальный git config (user.name, user.email).
#
# Использование:
#   ./commit-push.sh "сообщение коммита"
#   ./commit-push.sh                    # запросит сообщение интерактивно

set -e
cd "$(dirname "$0")"

REMOTE="${GIT_REMOTE:-origin}"
BRANCH="${GIT_BRANCH:-main}"

if [[ -n "$1" ]]; then
  MSG="$1"
else
  echo -n "Сообщение коммита: "
  read -r MSG
  if [[ -z "$MSG" ]]; then
    echo "Ошибка: сообщение коммита не задано."
    exit 1
  fi
fi

echo "→ git add ."
git add .

if git diff --staged --quiet; then
  echo "Нет изменений для коммита."
  exit 0
fi

echo "→ git commit -m \"$MSG\""
git commit -m "$MSG"

echo "→ git push $REMOTE $BRANCH"
git push "$REMOTE" "$BRANCH"

echo "Готово."
