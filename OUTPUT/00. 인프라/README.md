## 00. 인프라 개요

- **프로젝트명**: Teamcover
- **목적**: 볼링 클럽/리그 운영을 위한 회원 관리, 정산, 알림 등 백오피스 & 웹 서비스 인프라 정리 문서

### 1. 전체 아키텍처

- **Frontend**: React (Vite/CRA 등) 기반 SPA, 배포 대상: Vercel/Static Hosting 등
- **Backend**: Node.js (Express/NestJS 등), Railway 등 PaaS 사용
- **Database**: PostgreSQL (Railway) 기준
- **인증/인가**: JWT 또는 세션 기반 로그인, Google OAuth, Firebase 등 외부 서비스 연동
- **CI/CD**: GitHub + (Vercel / Railway / 기타) 자동 배포 파이프라인

> 실제 인프라 구성이 확정되면, 아래 항목에 구체적인 서비스/계정/리소스를 채워 넣으세요.

### 2. 배포 환경

- **개발 환경(Dev)**

  - 도메인: `http://localhost:3000/`

- **운영 환경(Prod)**
  - 도메인: `hsyun.store` (예시)
  - 배포 방식: GitHub 브랜치(`main`) 머지 시 자동 배포

### 3. 서버/호스팅 자원

- **Frontend Hosting**

  - 서비스: Vercel
  - 프로젝트 이름 / ID: teamcover-frontend

- **Backend Hosting**

  - 서비스: Railway
  - 서비스 이름: Teamcover-backend
  - 환경 변수 관리 방법: `.env` 파일 + Railway Dashboard

  - **DB Hosting**
  - 서비스: Railway
  - 서비스 이름: TeamcoverDB

### 4. 환경 변수(.env) 관리

- **공통 규칙**
  - `.env` 파일은 Git에 커밋하지 않는다.
  - `.env.example` 에 필수 키 목록만 남긴다.
- **주요 키 예시**
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - `FIREBASE_API_KEY` 등

### 5. 모니터링 & 로그

- **애플리케이션 로그**
  - Backend: 콘솔 로그 + 호스팅 서비스 로그 뷰어 사용
  - Error 로그 규칙: `[시간][요청ID][사용자ID] 메시지` 형태 추천
- **성능 모니터링**
  - 서비스: (예) Sentry, Logtail, Datadog 등 도입 검토

### 6. 백업 & 장애 대응

- **DB 백업**
  - 주기: 최소 1일 1회 (자동 스냅샷 활용)
  - 복구 방법: Railway 또는 DB 관리 콘솔에서 스냅샷 복구 절차 문서화
- **장애 대응 플로우**
  1. 장애 감지(모니터링 알림 또는 사용자 제보)
  2. 로그/헬스체크 확인
  3. 임시 조치(롤백/재시작 등)
  4. 원인 분석 & 재발 방지 액션 기록

### 7. 인프라 변경 관리

- **변경 요청 절차**
  - 인프라 수준 변경(서버 스펙, 네트워크, DB 마이그레이션 등)은 이 문서에 변경 이력 기록
  - PR 템플릿에 “인프라 영향” 항목 추가하여 영향 범위 명시

### 8. 참고 문서

- `GUIDE` 폴더 내 각종 설정 가이드
- `SQL` 폴더 내 마이그레이션/쿼리 스크립트
- 배포/연동 관련 외부 Notion 또는 Wiki 링크
