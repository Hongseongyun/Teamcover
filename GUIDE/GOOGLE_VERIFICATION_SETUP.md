# 🔐 구글 로그인 인증 코드 시스템

## 📋 개요

구글 로그인 시 인증 코드 입력을 통한 승인 시스템이 추가되었습니다.

### 인증 방식

- **일반 회원가입**: 이메일 인증 방식 (기존 유지)
- **구글 로그인**: 인증 코드 입력 방식 (신규)

## 🔄 작동 흐름

### 일반 회원가입 (이메일 인증)

```
회원가입 → 이메일 발송 → 이메일 링크 클릭 → 인증 완료 → 로그인 가능
```

### 구글 로그인 (인증 코드)

```
구글 로그인 시도
    ↓
신규 사용자 감지
    ↓
계정 생성 (비활성화 상태)
    ↓
6자리 인증 코드 생성 (24시간 유효)
    ↓
📧 사용자 이메일로 인증 코드 자동 발송
    ↓
인증 코드 입력 페이지로 이동
    ↓
사용자가 이메일에서 인증 코드 확인
    ↓
인증 코드 입력
    ↓
인증 완료 → 계정 활성화 → 자동 로그인
```

## 🚀 설치 및 설정

### 1. 데이터베이스 마이그레이션

**중요**: 새로운 필드가 추가되었으므로 데이터베이스를 업데이트해야 합니다.

```bash
cd backend

# 방법 1: Flask-Migrate 사용 (권장)
flask db migrate -m "Add verification fields to User model"
flask db upgrade

# 방법 2: 기존 사용자 마이그레이션 스크립트 실행
python migrate_existing_users.py
```

**마이그레이션 스크립트 자동 실행**:

```bash
AUTO_MIGRATE=yes python migrate_existing_users.py
```

### 2. 추가된 데이터베이스 필드

`User` 모델에 다음 필드가 추가되었습니다:

```python
is_verified = Boolean  # 인증 완료 여부
verification_method = String(20)  # 'email', 'code', 'auto'
verification_code = String(10)  # 인증 코드 (6자리)
verification_code_expires = DateTime  # 코드 만료 시간
verified_at = DateTime  # 인증 완료 시간
```

### 3. 프론트엔드 설정

새로운 페이지가 추가되었습니다:

- `/verify-code` - 인증 코드 입력 페이지

## 📡 API 엔드포인트

### 1. 인증 코드 검증

```http
POST /api/auth/verify-code
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456"
}
```

**응답 (성공)**:

```json
{
  "success": true,
  "message": "인증이 완료되었습니다. 로그인되었습니다.",
  "user": { ... },
  "access_token": "..."
}
```

### 2. 인증 코드 조회 (관리자 전용)

```http
GET /api/auth/get-verification-code/:email
Authorization: Bearer <admin_token>
```

**응답**:

```json
{
  "success": true,
  "verification_code": "123456",
  "expires_at": "2025-10-01 12:00:00",
  "is_expired": false,
  "user": {
    "email": "user@example.com",
    "name": "홍길동",
    "created_at": "2025-09-30 12:00:00"
  }
}
```

### 3. 인증 코드 재생성 (관리자 전용)

```http
POST /api/auth/regenerate-verification-code
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**응답**:

```json
{
  "success": true,
  "message": "새로운 인증 코드가 생성되었습니다.",
  "verification_code": "789012",
  "expires_at": "2025-10-01 12:00:00"
}
```

## 👨‍💼 관리자 사용 가이드

### 인증 코드 확인 방법

1. **백엔드 로그 확인**:

   - 사용자가 구글 로그인 시도 시 콘솔에 인증 코드가 출력됩니다
   - 로그 예시:
     ```
     Created new user with verification code: <User user@example.com>
     Verification code: 123456 (expires: 2025-10-01 12:00:00)
     ```

2. **API를 통한 조회**:

   - 관리자 계정으로 로그인
   - `/api/auth/get-verification-code/:email` API 호출
   - Postman, curl 등 사용 가능

3. **데이터베이스 직접 조회**:
   ```sql
   SELECT email, name, verification_code, verification_code_expires
   FROM users
   WHERE is_verified = false
   AND verification_code IS NOT NULL;
   ```

### 인증 코드 전달 방법 ⭐ 자동화

1. 사용자가 구글 로그인 시도
2. 시스템이 자동으로 **사용자 이메일로 인증 코드 발송**
3. 사용자가 자신의 이메일에서 6자리 인증 코드 확인
4. 인증 코드 입력 페이지에서 코드 입력
5. 인증 완료 → 자동 로그인

**💡 관리자 개입 불필요!** 사용자가 직접 이메일에서 코드를 확인할 수 있습니다.

## 🔒 보안 고려사항

### 인증 코드

- **길이**: 6자리 숫자
- **유효 기간**: 24시간
- **저장 방식**: 평문 (DB에 저장, 일회용)
- **재사용 방지**: 인증 완료 시 코드 삭제

### 권장사항

1. **HTTPS 필수**: 프로덕션에서는 반드시 HTTPS 사용
2. **인증 코드 전달**: 안전한 채널 사용 (직접 통화, 암호화된 메신저 등)
3. **로그 관리**: 인증 코드가 포함된 로그는 정기적으로 삭제
4. **관리자 권한**: 인증 코드 조회 권한을 최소한의 관리자로 제한

## 🧪 테스트 방법

### 1. 로컬 환경 테스트

```bash
# 백엔드 실행
cd backend
python app.py

# 프론트엔드 실행 (새 터미널)
cd frontend
npm start
```

### 2. 구글 로그인 테스트

1. `http://localhost:3000/login` 접속
2. "구글로 로그인" 버튼 클릭
3. 구글 계정 선택 및 로그인
4. 인증 코드 입력 페이지로 자동 이동
5. 백엔드 콘솔에서 인증 코드 확인:
   ```
   Verification code: 123456
   ```
6. 인증 코드 입력 페이지에서 코드 입력
7. 인증 완료 및 자동 로그인 확인

### 3. 일반 회원가입 테스트

1. `http://localhost:3000/login` 접속
2. "회원가입" 탭 선택
3. 이메일, 이름, 비밀번호 입력
4. 이메일 확인하여 인증 링크 클릭
5. 인증 완료 후 로그인

## 🐛 문제 해결

### 인증 코드가 생성되지 않는 경우

1. 데이터베이스 마이그레이션 확인
2. 백엔드 로그에서 오류 확인
3. User 모델의 새 필드가 추가되었는지 확인

### 인증 코드가 작동하지 않는 경우

1. **코드 만료 확인**: 24시간 경과 시 새로 로그인 필요
2. **이메일 확인**: 대소문자 구분 없음
3. **코드 형식**: 6자리 숫자만 입력
4. **데이터베이스 확인**: 사용자 레코드 존재 여부

### 기존 사용자가 로그인 불가한 경우

마이그레이션 스크립트 실행:

```bash
cd backend
python migrate_existing_users.py
```

## 📊 데이터베이스 스키마

### 기존 (Before)

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(120) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  google_id VARCHAR(100) UNIQUE,
  password_hash VARCHAR(128),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);
```

### 변경 후 (After)

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(120) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  google_id VARCHAR(100) UNIQUE,
  password_hash VARCHAR(128),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,

  -- 새로 추가된 필드
  is_verified BOOLEAN DEFAULT FALSE,
  verification_method VARCHAR(20),
  verification_code VARCHAR(10),
  verification_code_expires TIMESTAMP,
  verified_at TIMESTAMP
);
```

## 🔧 커스터마이징

### 인증 코드 길이 변경

`backend/blueprints/auth.py`:

```python
def generate_verification_code():
    """6자리 인증 코드 생성"""
    return ''.join(random.choices(string.digits, k=6))  # k 값 변경
```

### 인증 코드 유효 기간 변경

`backend/blueprints/auth.py`:

```python
verification_expires = datetime.utcnow() + timedelta(hours=24)  # hours 값 변경
```

### 인증 방식 변경

다른 인증 방식을 추가하려면:

1. `verification_method` 필드에 새로운 값 추가
2. 해당 방식의 검증 로직 구현
3. 프론트엔드 UI 추가

## 📈 모니터링

### 대기 중인 인증 확인

```sql
SELECT
  email,
  name,
  verification_code,
  verification_code_expires,
  created_at
FROM users
WHERE is_verified = false
  AND verification_code IS NOT NULL
ORDER BY created_at DESC;
```

### 인증 통계

```sql
-- 인증 방식별 사용자 수
SELECT
  verification_method,
  COUNT(*) as count
FROM users
WHERE is_verified = true
GROUP BY verification_method;

-- 인증 완료율
SELECT
  COUNT(*) FILTER (WHERE is_verified = true) * 100.0 / COUNT(*) as verification_rate
FROM users;
```

이제 구글 로그인 시 인증 코드 시스템이 완전히 구현되었습니다! 🎉
