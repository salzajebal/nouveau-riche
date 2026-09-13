#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "sudo bash deploy/lightsail/install.sh 로 실행하세요." >&2
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl git nginx postgresql postgresql-contrib postgresql-client

if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'Number(process.versions.node.split(`.`)[0])')" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

npm install -g pm2
systemctl enable --now postgresql
systemctl enable --now nginx
install -d -m 750 /etc/npay

echo "Node $(node --version), npm $(npm --version), PostgreSQL 및 Nginx 설치 완료"