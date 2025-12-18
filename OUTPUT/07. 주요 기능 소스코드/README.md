## 07. 주요 기능 소스코드 정리

Teamcover 레포지토리에서 **핵심 기능별로 소스코드 위치와 역할**을 정리하는 문서입니다.

### 1. 프론트엔드(Frontend)

- **엔트리 및 전역 스타일**

  - `frontend/src/App.js`
  - `frontend/src/App.css`

- **레이아웃 / 공통 컴포넌트**

  - `frontend/src/components/Navbar.js` / `Navbar.css`
    - 상단 내비게이션, 로그인 상태, 메뉴 이동 등
  - `frontend/src/components/Footer.js` / `Footer.css`
    - 하단 공통 푸터
  - `frontend/src/components/BowlingHero.js`
    - 랜딩/메인에서 사용하는 히어로 섹션(볼링 관련 비주얼)

- **페이지 (예시)**

  - `frontend/src/pages/Landing.js`
    - 초기 진입 페이지, 서비스 소개, CTA 버튼 등
  - `frontend/src/pages/UserManagement.css` 및 관련 JS
    - 회원 관리 화면 스타일 및 레이아웃

- **컨텍스트/서비스**
  - `frontend/src/contexts/*`
    - 전역 상태 관리(예: 인증, 클럽 정보 등)
  - `frontend/src/services/*`
    - API 호출 로직, 백엔드 통신 래퍼

### 2. 백엔드(Backend)

> 백엔드 폴더(`backend/`)에는 다수의 TypeScript/JavaScript 파일이 존재합니다.  
> 여기에는 개략적인 분류만 적어두고, 필요 시 세부 파일/클래스 목록을 추가해 주세요.

- **주요 영역(예시)**
  - `backend/src` 내
    - `routes` 또는 `controllers`: HTTP 엔드포인트 정의
    - `services`: 비즈니스 로직
    - `models` 또는 `entities`: DB 엔티티 정의
    - `config`: 환경 설정, DB 연결 등

### 3. 기능별 맵핑 예시

| 기능           | 프론트엔드                    | 백엔드                         | 비고           |
| -------------- | ----------------------------- | ------------------------------ | -------------- |
| 회원 목록 조회 | `pages/UserManagement.*`      | `GET /api/members` 관련 핸들러 | 검색/필터 포함 |
| 회원 상세 조회 | `pages/UserDetail.*` (있다면) | `GET /api/members/:id`         | 점수/출석 이력 |
| 경기 일정 관리 | `pages/Matches.*`             | `GET/POST /api/matches`        |                |
| 정산/회비 관리 | `pages/Billing.*`             | `/api/billing/*`               |                |

### 4. 코드 리딩 가이드

- 신규 팀원이 빠르게 이해할 수 있도록:
  - “기능 → 어떤 파일을 먼저 보면 좋은지”를 위 표처럼 계속 채워 나갑니다.
  - 복잡한 기능(예: 티어 시스템, 복합 정산 로직 등)은 별도 문서 또는 섹션으로 상세 설명을 추가합니다.

### 5. 변경 이력

- 주요 기능/파일 구조가 크게 변경될 때마다, 날짜와 함께 요약을 남겨 주세요.
