# Google OAuth 2.0 설정 가이드

## 1. Google Cloud Console에서 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. "API 및 서비스" > "사용자 인증 정보"로 이동

## 2. OAuth 2.0 클라이언트 ID 생성

1. "사용자 인증 정보 만들기" > "OAuth 2.0 클라이언트 ID" 선택
2. 애플리케이션 유형: "웹 애플리케이션"
3. 이름: "Teamcover"
4. 승인된 자바스크립트 원본:
   - `http://localhost:3000` (개발 환경)
   - `https://hsyun.store` (프론트엔드 배포 환경)
   - `https://api.hsyun.store` (백엔드)
5. 승인된 리디렉션 URI:
   - `http://localhost:3000/google-callback` (개발 환경)
   - `http://localhost:5000/api/auth/google/callback` (개발 환경)
   - `https://hsyun.store/google-callback` (프론트엔드 배포 환경)
   - `https://api.hsyun.store/api/auth/google/callback` (백엔드 배포 환경)

## 3. 환경변수 설정

### 백엔드 설정 (backend/config.py 또는 환경변수)

```bash
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
```

### 프론트엔드 설정 (frontend/.env 또는 Vercel 환경변수)

```bash
REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id-here
REACT_APP_API_URL=http://localhost:5000      # 개발 환경
REACT_APP_API_URL=https://api.hsyun.store   # 배포 환경
```

## 4. 필요한 라이브러리 설치

### 백엔드

```bash
pip install google-auth google-auth-oauthlib google-auth-httplib2
```

### 프론트엔드

```bash
npm install
```

## 5. 테스트

1. 백엔드 서버 실행: `python app.py`
2. 프론트엔드 서버 실행: `npm start`
3. `http://localhost:3000` 접속
4. 로그인 페이지에서 "구글로 로그인" 버튼 클릭

## 6. 문제 해결

### 400 Bad Request 오류 (redirect_uri_mismatch)

- Google Cloud Console에서 리디렉션 URI가 정확히 설정되었는지 확인
- 개발 환경과 배포 환경의 URI가 모두 등록되어 있는지 확인
- 클라이언트 ID와 시크릿이 올바른지 확인
- 도메인이 승인된 자바스크립트 원본에 포함되어 있는지 확인
- Railway와 Vercel의 환경변수가 올바르게 설정되었는지 확인

### CORS 오류

- 백엔드 CORS 설정에서 `http://localhost:3000`이 허용되어 있는지 확인

### 토큰 검증 오류

- Google OAuth 라이브러리가 올바르게 설치되었는지 확인
- 클라이언트 ID가 올바른지 확인
