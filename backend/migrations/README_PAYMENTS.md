# Payment 테이블 생성 가이드

## 개요

납입 관리 기능을 위한 `payments` 테이블을 생성합니다.

## 데이터베이스에 따라 SQL 파일 선택

### PostgreSQL 사용 시

```bash
psql -U your_username -d your_database -f create_payments_table.sql
```

또는 PostgreSQL 클라이언트에서 직접 실행:

```sql
\i backend/migrations/create_payments_table.sql
```

### MySQL 사용 시

```bash
mysql -u your_username -p your_database < create_payments_table_mysql.sql
```

또는 MySQL 클라이언트에서 직접 실행:

```sql
source backend/migrations/create_payments_table_mysql.sql
```

## 테이블 구조

| 컬럼명       | 타입           | 설명         | 제약조건                             |
| ------------ | -------------- | ------------ | ------------------------------------ |
| id           | INTEGER/SERIAL | 납입 내역 ID | PRIMARY KEY, AUTO_INCREMENT          |
| member_id    | INTEGER        | 회원 ID      | NOT NULL, FOREIGN KEY -> members(id) |
| payment_type | VARCHAR(20)    | 납입 유형    | NOT NULL (monthly/game)              |
| amount       | INTEGER        | 납입 금액    | NOT NULL                             |
| payment_date | DATE           | 납입일       | NOT NULL                             |
| month        | VARCHAR(10)    | 월           | YYYY-MM 형식                         |
| is_paid      | BOOLEAN        | 납입 여부    | DEFAULT TRUE                         |
| note         | TEXT           | 비고         | -                                    |
| created_at   | TIMESTAMP      | 등록 시간    | DEFAULT CURRENT_TIMESTAMP            |
| updated_at   | TIMESTAMP      | 수정 시간    | DEFAULT CURRENT_TIMESTAMP            |

## 인덱스

- idx_payments_member_id: 회원별 검색
- idx_payments_payment_type: 납입 유형별 검색
- idx_payments_month: 월별 검색
- idx_payments_payment_date: 날짜별 정렬
- idx_payments_is_paid: 납입 여부 검색

## 데이터베이스 연결 확인 후 실행

SQL 파일을 실행하기 전에 데이터베이스 연결이 올바르게 설정되어 있는지 확인하세요.

```bash
# PostgreSQL 연결 테스트
psql -U username -d database_name -c "SELECT version();"

# MySQL 연결 테스트
mysql -u username -p database_name -e "SELECT VERSION();"
```

## 확인

테이블이 생성되었는지 확인:

**PostgreSQL:**

```sql
\dt payments
\d payments
```

**MySQL:**

```sql
SHOW TABLES LIKE 'payments';
DESCRIBE payments;
```
