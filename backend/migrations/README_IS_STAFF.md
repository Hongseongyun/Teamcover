# is_staff 컬럼 추가 가이드

Members 테이블에 운영진 여부를 나타내는 `is_staff` 컬럼을 추가합니다.

## SQL 실행 방법

### PostgreSQL 사용 시

```bash
psql -U your_username -d your_database_name -f backend/migrations/add_is_staff_to_members.sql
```

또는 psql 접속 후:

```sql
\i backend/migrations/add_is_staff_to_members.sql
```

### MySQL 사용 시

```bash
mysql -u your_username -p your_database_name < backend/migrations/add_is_staff_to_members_mysql.sql
```

또는 MySQL 접속 후:

```sql
source backend/migrations/add_is_staff_to_members_mysql.sql;
```

## 변경 사항

### 데이터베이스

- `members` 테이블에 `is_staff` (BOOLEAN, 기본값: FALSE) 컬럼 추가

### 백엔드

- `Member` 모델에 `is_staff` 필드 추가
- 회원 등록 API에서 운영진 설정 기능 추가 (admin/super_admin만 가능)
- 회원 수정 API에서 운영진 설정 기능 추가 (admin/super_admin만 가능)

### 프론트엔드

- 회원 등록/수정 폼에 운영진 체크박스 추가 (슈퍼관리자만 표시)
- 회원 목록에 운영진 배지 표시
- 운영진/일반회원 필터링 기능 추가
- 통계 섹션에 운영진/일반회원 수 표시
- 인라인 편집에서 운영진 여부 수정 가능 (슈퍼관리자만)

## 사용 방법

### 운영진으로 설정하기

1. 슈퍼관리자로 로그인
2. 회원 추가 시 "운영진 회원" 체크박스 선택
3. 또는 기존 회원 수정 시 운영진 여부 변경

### 필터링

- "운영진만" 버튼: 운영진 회원만 표시
- "일반회원만" 버튼: 일반회원만 표시
- "전체보기" 버튼: 전체 회원 표시

## 참고

- `is_staff`는 admin/super_admin 권한을 가진 사용자만 설정/수정 가능합니다.
- 기존 회원은 자동으로 `is_staff=FALSE`로 설정됩니다.
