# Railway Database Migration 가이드

## is_staff 컬럼 추가하기

### 방법 1: Railway 웹 콘솔 사용 (가장 쉬움)

1. Railway 웹사이트 접속 (https://railway.app)
2. 프로젝트 선택
3. PostgreSQL 데이터베이스 서비스 클릭
4. "Query" 탭 선택
5. 아래 SQL 실행:

```sql
ALTER TABLE members
ADD COLUMN IF NOT EXISTS is_staff BOOLEAN DEFAULT FALSE NOT NULL;
```

### 방법 2: Railway CLI 사용

```bash
# Railway CLI 설치 (없는 경우)
npm i -g @railway/cli

# 로그인
railway login

# 프로젝트 연결
railway link

# PostgreSQL 인스턴스 접속
railway db

# 또는 직접 SQL 실행
railway connect -t postgres
```

접속 후:

```sql
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_staff BOOLEAN DEFAULT FALSE NOT NULL;
```

### 방법 3: 로컬에서 Railway DB 연결

```bash
# Railway 접속 정보 확인
railway variables

# psql로 직접 연결
psql $DATABASE_URL

# SQL 실행
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_staff BOOLEAN DEFAULT FALSE NOT NULL;
```

## 확인 방법

마이그레이션 실행 후 아래 쿼리로 확인:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'members' AND column_name = 'is_staff';
```

결과가 나오면 성공적으로 컬럼이 추가된 것입니다!

## 주의사항

- 이 마이그레이션은 안전합니다 (`ADD COLUMN IF NOT EXISTS` 사용)
- 기존 데이터는 모두 `false`로 설정됩니다
- 작업 중 서비스 다운타임 없음
