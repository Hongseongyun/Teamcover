## 05. 데이터베이스 설계

Teamcover 서비스의 **DB(Entity) 설계**를 정리하는 문서입니다.

### 1. ERD 개요

- **핵심 엔티티 (예시)**
  - `members` (회원)
  - `clubs` (클럽)
  - `memberships` (회원-클럽 관계)
  - `matches` (경기/게임)
  - `scores` (점수/프레임 기록)
  - `payments` (회비/정산)
  - `notifications` (알림/공지)

> 실제 ERD는 외부 툴(DB Diagram, Draw.io, Notion 등)에 작성 후 링크를 남겨 주세요.

### 2. 테이블 정의 템플릿

#### 예시: `members` 테이블

| 컬럼명     | 타입         | PK  | FK  | Nullable | 설명                |
| ---------- | ------------ | --- | --- | -------- | ------------------- |
| id         | uuid         | Y   |     | N        | 회원 고유 ID        |
| name       | varchar(100) |     |     | N        | 이름                |
| phone      | varchar(20)  |     |     | Y        | 연락처              |
| email      | varchar(255) |     |     | Y        | 이메일              |
| status     | varchar(20)  |     |     | N        | 활성/비활성 등 상태 |
| created_at | timestamptz  |     |     | N        | 생성일시            |
| updated_at | timestamptz  |     |     | N        | 수정일시            |

#### 예시: `matches` 테이블

| 컬럼명     | 타입        | PK  | FK             | Nullable | 설명            |
| ---------- | ----------- | --- | -------------- | -------- | --------------- |
| id         | uuid        | Y   |                | N        | 경기 ID         |
| club_id    | uuid        |     | Y (`clubs.id`) | N        | 클럽 ID         |
| date       | date        |     |                | N        | 경기 날짜       |
| lane       | varchar(50) |     |                | Y        | 레인 정보(선택) |
| created_at | timestamptz |     |                | N        | 생성일시        |

### 3. 인덱스/성능 고려

- 자주 조회되는 컬럼(예: 회원 이름, 전화번호, 경기 날짜 등)에 대한 인덱스 설계
- 정산/통계 쿼리의 성능을 고려한 집계용 테이블 또는 뷰 사용 여부

### 4. 마이그레이션 관리

- **SQL 폴더 활용**
  - `SQL` 디렉터리에 주요 마이그레이션 스크립트 저장
  - 파일명 규칙: `YYYYMMDD_description.sql`
- **마이그레이션 도구**
  - (예) Prisma, TypeORM, Knex 등 사용 시 설정과 규칙 요약

### 5. 데이터 정합성 규칙

- 삭제 정책(Soft Delete vs Hard Delete)
- 참조 무결성(ON DELETE CASCADE / RESTRICT 등)
- 유니크 제약(중복 가입 방지 등)

### 6. 보안/권한

- DB 계정 구분(운영/개발/로컬)
- 직접 쿼리 가능 범위 제한, 읽기 전용 계정 필요 여부
