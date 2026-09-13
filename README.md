# Npay Lightsail 자체 운영 가이드

이 프로젝트는 AWS Lightsail Ubuntu 한 대에서 Node.js 앱과 PostgreSQL을 함께 운영할 수 있습니다. PostgreSQL은 서버 내부 `localhost`에서만 사용하고, 외부에는 Nginx가 HTTP/HTTPS만 공개하는 구성을 권장합니다.

> 기존 서비스와 원본 DB는 이 문서의 명령만으로 바뀌지 않습니다. 수동 데이터 이전 명령은 **대상 VPS DB의 기존 객체를 교체**하므로 반드시 점검 시간에 실행하세요.

## 1. 서버 준비

Lightsail에서 Ubuntu 인스턴스를 만들고, 네트워킹 화면에서 다음 포트만 엽니다.

- `22` — SSH
- `80` — HTTP
- `443` — HTTPS 인증서 적용 후

SSH로 접속한 뒤 소스를 `/opt/npay`에 복제합니다.

```bash
sudo apt-get update
sudo apt-get install -y git
sudo mkdir -p /opt/npay
sudo chown "$USER":"$USER" /opt/npay
git clone <현재-프로젝트-Git-저장소-주소> /opt/npay
cd /opt/npay
sudo bash deploy/lightsail/install.sh
sudo bash deploy/lightsail/setup-postgres.sh
```

`setup-postgres.sh`는 기본값으로 권한을 분리한 `npay_app` 사용자와 `myapp` 데이터베이스를 준비합니다. 다른 이름이 필요하면 다음처럼 실행합니다.

```bash
sudo DB_USER=npay DB_NAME=npay_app bash deploy/lightsail/setup-postgres.sh
```

PostgreSQL은 기본적으로 로컬 연결만 사용합니다. `postgresql.conf`의 `listen_addresses`를 외부 IP로 변경하거나 Lightsail 방화벽에서 5432 포트를 열지 마세요.

## 2. 앱 환경변수 만들기

실제 환경변수 파일은 Git에 올리지 않습니다.

```bash
sudo cp .env.example /etc/npay/app.env
sudo chown "$USER":"$USER" /etc/npay/app.env
sudo chmod 640 /etc/npay/app.env
nano /etc/npay/app.env
```

아래 값을 실제 값으로 변경합니다.

```dotenv
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://npay_app:여기에_설정한_URL인코딩_DB_비밀번호@localhost:5432/myapp
SESSION_SECRET=여기에_긴_무작위_문자열
ADMIN_INITIAL_PASSWORD=처음_생성할_관리자_강력한_비밀번호
```

`SESSION_SECRET`은 다음 명령으로 생성할 수 있습니다.

```bash
openssl rand -base64 48
```

DB 비밀번호에 `@`, `:`, `/`, `#`, `%` 같은 문자가 있으면 URL 인코딩한 값을 `DATABASE_URL`에 넣어야 합니다. 예를 들어 `@`는 `%40`입니다.

`ADMIN_INITIAL_PASSWORD`는 빈 DB에서 최초 `admin` 계정을 만들 때만 사용됩니다. 계정이 생성된 뒤에는 `/etc/npay/app.env`에서 이 값을 삭제할 수 있습니다. 프로덕션에서는 이 값과 `SESSION_SECRET`, `DATABASE_URL`이 없으면 앱이 시작되지 않습니다.

`DATABASE_URL`이 설정되지 않은 로컬 개발 환경에서는 앱이 `postgresql://postgres:password@localhost:5432/myapp`을 기본값으로 참조합니다. 운영 환경에서는 반드시 `/etc/npay/app.env`의 실제 값으로 설정하세요.

## 3. 신규 VPS DB 초기화

빈 PostgreSQL DB라면 앱 스키마를 먼저 적용합니다.

```bash
cd /opt/npay
set -a
. /etc/npay/app.env
set +a
npm ci
npm run db:migrate
```

앱을 처음 실행하면 PostgreSQL 세션 테이블도 자동 생성됩니다. 이미 운영 데이터를 복원할 계획이면 이 단계 대신 아래의 데이터 복원부터 수행해도 됩니다.

## 4. 원하는 시점에 기존 전체 데이터 이전

`scripts/migrate-data.js`는 앱 시작이나 배포 중에는 절대 자동 실행되지 않습니다. 관리자가 터미널에서 직접 실행하고 `--confirm`을 지정했을 때만 동작합니다.

이 도구는 원본 PostgreSQL에서 모든 스키마와 데이터를 임시 custom dump로 추출한 뒤, `/etc/npay/app.env`의 VPS 로컬 DB로 복원합니다. 실행 전에 원본 DB가 Lightsail 서버의 IP 연결을 허용하는지 확인하세요.

```bash
cd /opt/npay

# 서비스 쓰기를 잠시 중단합니다.
pm2 stop npay-app

# VPS 로컬 대상 DB 주소를 불러옵니다.
set -a
. /etc/npay/app.env
set +a

# 원본 주소는 현재 터미널 세션에만 입력합니다.
export SOURCE_DATABASE_URL='postgresql://원본사용자:원본비밀번호@원본호스트:5432/원본DB'

# 명시적인 확인 옵션이 없으면 실행되지 않습니다.
node scripts/migrate-data.js --confirm

# 접속 정보를 터미널 환경에서 제거하고 앱을 다시 시작합니다.
unset SOURCE_DATABASE_URL
pm2 start ecosystem.config.cjs --only npay-app --update-env
pm2 save
```

`npm run migrate:data -- --confirm`도 같은 명령입니다. 스크립트는 원본과 대상 주소가 같으면 중단하며, 임시 덤프는 성공·실패와 관계없이 제거합니다. 접속 문자열이나 덤프 파일을 Git에 저장하지 마세요.

## 5. 앱 빌드 및 24시간 실행

```bash
cd /opt/npay
bash deploy/lightsail/deploy-app.sh
pm2 status
pm2 logs npay-app
```

PM2를 서버 재부팅 후에도 자동 시작하도록 설정합니다. 출력되는 `sudo ...` 명령을 한 번 복사해 실행한 뒤 저장합니다.

```bash
pm2 startup systemd -u "$USER" --hp "$HOME"
pm2 save
```

앱은 기본적으로 `0.0.0.0:3000`에서 실행되고, Nginx가 외부 요청을 `127.0.0.1:3000`으로 전달합니다. 앱 코드는 `process.env.PORT || 3000`을 사용하므로 `/etc/npay/app.env`에서 변경할 수 있습니다. Nginx 포트도 함께 변경해야 합니다. WebSocket 프록시 설정도 포함되어 있습니다.

## 6. Nginx 연결

도메인을 Lightsail IP에 연결한 뒤, `deploy/lightsail/nginx-npay.conf`의 `server_name _;`를 실제 도메인으로 바꾸고 기본 설정을 적용합니다.

```bash
sudo cp /opt/npay/deploy/lightsail/nginx-npay.conf /etc/nginx/sites-available/npay
sudo ln -sf /etc/nginx/sites-available/npay /etc/nginx/sites-enabled/npay
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

그 다음 Certbot으로 HTTPS를 적용합니다.

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com
```

## 7. 운영·업데이트 명령

```bash
# 상태 및 로그
pm2 status
pm2 logs npay-app
sudo systemctl status postgresql nginx

# 새 코드 배포
cd /opt/npay
git pull
bash deploy/lightsail/deploy-app.sh

# DB 접속
psql "$(grep '^DATABASE_URL=' /etc/npay/app.env | cut -d= -f2-)"
```

문제가 생기면 먼저 `pm2 logs npay-app`, `sudo journalctl -u nginx -n 100`, `sudo journalctl -u postgresql -n 100`을 확인하세요.
