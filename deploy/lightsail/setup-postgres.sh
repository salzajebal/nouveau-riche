#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "sudo bash deploy/lightsail/setup-postgres.sh 로 실행하세요." >&2
  exit 1
fi

DB_USER="${DB_USER:-npay_app}"
DB_NAME="${DB_NAME:-myapp}"

if [[ ! "$DB_USER" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || [[ ! "$DB_NAME" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
  echo "DB_USER와 DB_NAME에는 영문, 숫자, 밑줄만 사용할 수 있습니다." >&2
  exit 1
fi

if [[ -z "${DB_PASSWORD:-}" ]]; then
  read -rsp "새 PostgreSQL 앱 사용자 비밀번호: " DB_PASSWORD
  echo
fi
if [[ -z "$DB_PASSWORD" ]]; then
  echo "DB 비밀번호는 비워둘 수 없습니다." >&2
  exit 1
fi

sudo -u postgres psql --set=ON_ERROR_STOP=1 \
  --set=db_user="$DB_USER" --set=db_password="$DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'db_user', :'db_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'db_user') \gexec
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'db_user', :'db_password') \gexec
SQL

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1; then
  sudo -u postgres createdb --owner="$DB_USER" "$DB_NAME"
fi
sudo -u postgres psql --set=ON_ERROR_STOP=1 --dbname="$DB_NAME" \
  -c "ALTER DATABASE \"$DB_NAME\" OWNER TO \"$DB_USER\";"
sudo -u postgres psql --set=ON_ERROR_STOP=1 --dbname="$DB_NAME" \
  -c "GRANT ALL ON SCHEMA public TO \"$DB_USER\";"

ENCODED_PASSWORD="$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=\"\"))' "$DB_PASSWORD")"
echo
echo "PostgreSQL 준비 완료"
echo "DATABASE_URL=postgresql://${DB_USER}:${ENCODED_PASSWORD}@localhost:5432/${DB_NAME}"
echo "위 DATABASE_URL을 /etc/npay/app.env에 저장하세요."