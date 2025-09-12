# 🚀 Teamcover 무료 배포 가이드

## 📋 배포 구조

- **프론트엔드**: Vercel (무료)
- **백엔드**: Railway (무료 티어)
- **데이터베이스**: Railway PostgreSQL (무료 티어)
- **도메인**: 가비아 도메인 연결

## 1️⃣ Railway 백엔드 배포

### 1.1 Railway 계정 생성 및 프로젝트 생성

1. [Railway.app](https://railway.app) 접속
2. GitHub 계정으로 로그인
3. "New Project" → "Deploy from GitHub repo" 선택
4. Teamcover 저장소 선택

### 1.2 데이터베이스 설정

1. Railway 대시보드에서 "New" → "Database" → "PostgreSQL" 선택
2. 데이터베이스 생성 후 연결 정보 복사

### 1.3 백엔드 서비스 배포

1. Railway에서 "New Service" → "GitHub Repo" 선택
2. `backend` 폴더 선택
3. 환경변수 설정:
   ```
   FLASK_ENV=production
   FLASK_SECRET_KEY=your-secret-key-here
   DB_HOST=your-db-host
   DB_PORT=5432
   DB_NAME=railway
   DB_USER=postgres
   DB_PASSWORD=your-db-password
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   JWT_SECRET_KEY=your-jwt-secret-key
   ```

### 1.4 도메인 설정

1. Railway 서비스 설정에서 "Settings" → "Domains" 선택
2. "Generate Domain" 클릭하여 백엔드 도메인 생성
3. 생성된 도메인을 복사 (예: `https://your-app.railway.app`)

## 2️⃣ Vercel 프론트엔드 배포

### 2.1 Vercel 계정 생성 및 프로젝트 생성

1. [Vercel.com](https://vercel.com) 접속
2. GitHub 계정으로 로그인
3. "New Project" → "Import Git Repository" 선택
4. Teamcover 저장소 선택

### 2.2 프론트엔드 설정

1. Root Directory를 `frontend`로 설정
2. Build Command: `npm run build`
3. Output Directory: `build`
4. 환경변수 설정:
   ```
   REACT_APP_API_URL=https://your-railway-backend-url.railway.app
   ```

### 2.3 도메인 연결

1. Vercel 프로젝트 설정에서 "Domains" 선택
2. 가비아에서 구매한 도메인 추가
3. DNS 설정 안내에 따라 가비아 DNS 설정

## 3️⃣ 가비아 도메인 설정

### 3.1 DNS 레코드 설정

가비아 DNS 관리에서 다음 레코드 추가:

```
Type: CNAME
Name: www
Value: cname.vercel-dns.com

Type: A
Name: @
Value: 76.76.19.61
```

### 3.2 서브도메인 설정 (선택사항)

API 서브도메인을 위한 설정:

```
Type: CNAME
Name: api
Value: your-railway-backend-url.railway.app
```

## 4️⃣ 환경변수 설정

### 4.1 Google OAuth 설정

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. "APIs & Services" → "Credentials" 선택
4. "Create Credentials" → "OAuth 2.0 Client IDs" 선택
5. Authorized redirect URIs에 다음 추가:
   - `https://your-domain.com/google-callback`
   - `https://your-railway-backend-url.railway.app/auth/google/callback`

### 4.2 Google Sheets API 설정

1. Google Cloud Console에서 "APIs & Services" → "Library" 선택
2. "Google Sheets API" 검색 후 활성화
3. "Google Drive API" 검색 후 활성화
4. 서비스 계정 생성 및 JSON 키 다운로드
5. JSON 키를 Railway 환경변수에 추가

## 5️⃣ 데이터베이스 초기화

### 5.1 슈퍼 관리자 계정 생성

Railway 터미널에서 다음 명령 실행:

```bash
cd backend
python -c "
from app import app, db, User
with app.app_context():
    db.create_all()
    admin = User(email='admin@yourdomain.com', name='Admin', role='super_admin')
    admin.set_password('your-password')
    db.session.add(admin)
    db.session.commit()
    print('슈퍼 관리자 계정이 생성되었습니다.')
"
```

## 6️⃣ 배포 확인

### 6.1 서비스 상태 확인

- 프론트엔드: `https://your-domain.com`
- 백엔드 API: `https://your-railway-backend-url.railway.app`
- 데이터베이스: Railway 대시보드에서 확인

### 6.2 기능 테스트

1. 회원가입/로그인 테스트
2. 회원 관리 기능 테스트
3. 스코어 등록 기능 테스트
4. 팀 배정 기능 테스트

## 💰 비용 정보

### 무료 티어 한도

- **Vercel**: 월 100GB 대역폭, 무제한 배포
- **Railway**: 월 $5 크레딧 (충분한 사용량)
- **PostgreSQL**: 1GB 저장공간

### 예상 월 비용

- **완전 무료** (무료 티어 내에서 사용 시)

## 🔧 문제 해결

### 일반적인 문제

1. **CORS 오류**: Railway 환경변수에서 `FLASK_ENV=production` 확인
2. **데이터베이스 연결 오류**: Railway PostgreSQL 연결 정보 확인
3. **Google OAuth 오류**: 리다이렉트 URI 설정 확인

### 로그 확인

- **Railway**: 서비스 로그에서 백엔드 오류 확인
- **Vercel**: Functions 로그에서 프론트엔드 오류 확인

## 📞 지원

배포 과정에서 문제가 발생하면:

1. Railway 대시보드의 로그 확인
2. Vercel 대시보드의 Functions 로그 확인
3. 브라우저 개발자 도구의 Network 탭 확인
