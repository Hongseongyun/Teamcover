# Vercel 배포 설정 가이드

## 🚀 Vercel 환경변수 설정

### Frontend (teamcover-frontend.vercel.app)

Vercel 프로젝트 설정에서 다음 환경변수를 추가하세요:

```
REACT_APP_API_URL=https://api.hsyun.store
```

### Backend (Railway 또는 다른 서버)

Railway 또는 백엔드 서버의 환경변수에 다음을 추가하세요:

```
CORS_ORIGINS=http://localhost:3000,https://hsyun.store,https://teamcover-frontend.vercel.app
```

## 📝 변경 사항

### 1. 백엔드 (backend/app.py)

- ✅ CORS allowed_origins에 `https://teamcover-frontend.vercel.app` 추가
- ✅ 코드에 기본값으로 하드코딩됨

### 2. 프론트엔드 (frontend/src/services/api.js)

- ✅ API_BASE_URL을 환경변수(`REACT_APP_API_URL`)로 읽도록 변경
- ✅ 기본값: `https://api.hsyun.store`

## 🔧 배포 후 확인 사항

1. **프론트엔드 콘솔** (F12 개발자 도구)

   ```javascript
   // 'API Base URL: https://api.hsyun.store' 확인
   ```

2. **API 연결 테스트**

   - 로그인 시도
   - 네트워크 탭에서 API 요청 확인
   - CORS 에러가 없어야 함

3. **백엔드 로그**
   - OPTIONS preflight 요청 확인
   - CORS 헤더 확인

## ⚠️ Vercel 재배포 필요

환경변수 변경 후 반드시 **재배포**해야 적용됩니다:

```bash
# Vercel CLI 사용 시
vercel --prod

# 또는 Git push로 자동 배포
git push origin main
```

## 🌐 도메인 목록

| 환경     | 프론트엔드                    | 백엔드          |
| -------- | ----------------------------- | --------------- |
| 로컬     | localhost:3000                | localhost:5000  |
| 프로덕션 | hsyun.store                   | api.hsyun.store |
| Vercel   | teamcover-frontend.vercel.app | api.hsyun.store |

## 🔍 문제 해결

### CORS 에러가 계속 발생하는 경우:

1. 백엔드 서버 재시작
2. 브라우저 캐시 삭제
3. 시크릿 모드에서 테스트
4. 백엔드 로그에서 `allowed_origins` 출력 확인
