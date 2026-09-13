#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-/etc/npay/app.env}"

if [[ ! -r "$ENV_FILE" ]]; then
  echo "$ENV_FILE을 읽을 수 없습니다. README의 환경변수 설정 단계를 먼저 진행하세요." >&2
  exit 1
fi

cd "$APP_DIR"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

npm ci \
  --registry=https://registry.npmjs.org \
  --replace-registry-host=always
npm run db:migrate
npm run build

if pm2 describe npay-app >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --only npay-app --update-env
else
  pm2 start ecosystem.config.cjs --only npay-app
fi
pm2 save