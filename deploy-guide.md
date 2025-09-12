# Teamcover 도메인 배포 가이드

## 🚀 Vercel 배포 (추천)

### 1단계: Vercel CLI 설치 및 로그인

```bash
npm install -g vercel
vercel login
```

### 2단계: 백엔드 배포

```bash
cd backend
vercel --prod
# 배포 후 받은 URL을 기록해두세요 (예: https://teamcover-backend.vercel.app)
```

### 3단계: 프론트엔드 배포

```bash
cd ../frontend
# 환경변수 설정
echo "REACT_APP_API_URL=https://your-backend-url.vercel.app" > .env.production
vercel --prod
```

### 4단계: 도메인 연결

1. Vercel 대시보드 (vercel.com) 접속
2. 프로젝트 선택 → Settings → Domains
3. 가비아에서 구매한 도메인 추가
4. DNS 설정에서 CNAME 레코드 추가:
   - Type: CNAME
   - Name: @ (또는 www)
   - Value: cname.vercel-dns.com

## 🔧 가비아 DNS 설정

### 1단계: 가비아 DNS 관리

1. 가비아 관리자 페이지 로그인
2. 도메인 관리 → DNS 관리

### 2단계: DNS 레코드 추가

```
Type: CNAME
Name: @
Value: cname.vercel-dns.com

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

## 🌐 다른 배포 옵션

### AWS S3 + CloudFront

```bash
# AWS CLI 설치
aws configure

# 프론트엔드 빌드
cd frontend
npm run build

# S3에 업로드
aws s3 sync build/ s3://your-bucket-name --delete

# CloudFront 배포 생성
aws cloudfront create-distribution --distribution-config file://cloudfront-config.json
```

### 가비아 호스팅

1. 가비아에서 웹호스팅 서비스 신청
2. FTP 접속 정보 확인
3. 빌드된 파일을 public_html 폴더에 업로드

## 📝 배포 체크리스트

- [ ] 백엔드 API URL 확인
- [ ] Google OAuth 설정 (프로덕션 도메인 추가)
- [ ] 데이터베이스 연결 설정
- [ ] HTTPS 인증서 확인
- [ ] 도메인 DNS 설정 완료
- [ ] 테스트 배포 확인

## 🔍 문제 해결

### CORS 오류

```python
# backend/app.py에서 CORS 설정 확인
CORS(app, origins=["https://your-domain.com"])
```

### 환경변수 오류

```bash
# Vercel에서 환경변수 설정
vercel env add REACT_APP_API_URL
vercel env add GOOGLE_CLIENT_ID
```

### 도메인 연결 오류

- DNS 전파 시간 대기 (최대 48시간)
- CNAME 레코드 확인
- Vercel 도메인 설정 확인
