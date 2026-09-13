---
name: Lightsail 배포 주의점
description: 단일 Ubuntu 서버 배포에서 확인된 npm 및 PM2 운영 제약
---

운영 환경에서도 스키마 적용과 프런트엔드 빌드가 끝나기 전까지 개발 의존성을 제외하지 않는다. PM2 자동 시작을 등록할 때는 기존 사용자 PM2 데몬을 종료한 뒤 systemd가 저장된 프로세스를 직접 복원하게 한다.

**Why:** `NODE_ENV=production` 상태의 기본 npm 설치는 빌드 도구를 제외하며, 이미 실행 중인 PM2 데몬은 systemd의 PID 추적과 충돌해 서비스 시작이 실패할 수 있다.

**How to apply:** Lightsail 신규 배포와 서버 재구성에서 의존성 설치 옵션과 PM2 systemd 전환 순서를 함께 점검한다.