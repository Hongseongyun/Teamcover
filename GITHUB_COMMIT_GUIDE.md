# 🚀 GitHub 커밋 및 배포 가이드

## 📁 프로젝트 구조 (Monorepo)

```
Teamcover/                    # 루트 저장소
├── frontend/                 # React 프론트엔드
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vercel.json
├── backend/                  # Flask 백엔드
│   ├── blueprints/
│   ├── models.py
│   ├── app.py
│   ├── requirements.txt
│   └── railway.json
├── API_KEY/                  # API 키 (gitignore됨)
├── docker-compose.yml
├── .gitignore
└── README.md
```

## 🔄 커밋 전략

### 1️⃣ **한 번에 커밋** (권장)

프론트엔드와 백엔드를 **동시에 커밋**하는 것이 좋습니다.

```bash
# 루트 디렉토리에서 실행
git add .
git commit -m "feat: 프로젝트 초기 설정 및 배포 준비"
git push origin main
```

### 2️⃣ **개별 커밋** (선택사항)

특정 기능만 배포하고 싶을 때:

```bash
# 프론트엔드만 커밋
git add frontend/
git commit -m "feat: 프론트엔드 UI 개선"
git push origin main

# 백엔드만 커밋
git add backend/
git commit -m "feat: 백엔드 API 기능 추가"
git push origin main
```

## 📋 배포 전 체크리스트

### ✅ 필수 확인사항

#### 1. 보안 설정 확인

- [ ] `.gitignore`에 민감한 정보가 제외되어 있는지 확인
- [ ] `API_KEY/` 폴더가 gitignore에 포함되어 있는지 확인
- [ ] `.env` 파일들이 gitignore에 포함되어 있는지 확인

#### 2. 환경변수 설정

- [ ] `backend/env.example` 파일 생성 완료
- [ ] 실제 `.env` 파일은 커밋하지 않았는지 확인

#### 3. 배포 설정 파일

- [ ] `frontend/vercel.json` 설정 완료
- [ ] `backend/railway.json` 설정 완료
- [ ] `requirements.txt` 업데이트 완료

## 🚀 단계별 커밋 가이드

### 1단계: 초기 커밋 (최초 배포)

```bash
# 1. 현재 상태 확인
git status

# 2. 모든 파일 추가 (gitignore 제외)
git add .

# 3. 커밋 메시지 작성
git commit -m "feat: Teamcover 프로젝트 초기 설정

- React 프론트엔드 구성
- Flask 백엔드 API 구성
- PostgreSQL 데이터베이스 모델 설정
- Docker 컨테이너 설정
- Vercel/Railway 배포 설정
- Google OAuth 인증 시스템
- 볼링 팀 관리 기능 구현"

# 4. GitHub에 푸시
git push origin main
```

### 2단계: 기능별 커밋 (개발 중)

```bash
# 예시: 회원 관리 기능 추가
git add backend/blueprints/members.py
git add frontend/src/pages/Members.js
git commit -m "feat: 회원 관리 기능 추가

- 회원 등록/수정/삭제 API 구현
- 회원 목록 조회 및 통계 기능
- 회원별 에버 계산 로직
- 프론트엔드 회원 관리 UI 구현"

git push origin main
```

### 3단계: 배포 전 최종 커밋

```bash
# 1. 모든 변경사항 확인
git status
git diff

# 2. 빌드 테스트 (선택사항)
cd frontend && npm run build
cd ../backend && python -c "import app; print('Backend OK')"

# 3. 최종 커밋
git add .
git commit -m "chore: 배포 준비 완료

- 환경변수 설정 파일 추가
- 배포 설정 파일 업데이트
- 보안 설정 강화
- 문서 업데이트"

# 4. GitHub에 푸시
git push origin main
```

## 🔧 배포 서비스별 설정

### Vercel (프론트엔드)

1. GitHub 저장소 연결
2. Root Directory: `frontend`
3. Build Command: `npm run build`
4. Output Directory: `build`
5. Environment Variables:
   ```
   REACT_APP_API_URL=https://your-railway-backend-url.railway.app
   ```

### Railway (백엔드)

1. GitHub 저장소 연결
2. Root Directory: `backend`
3. Environment Variables 설정
4. PostgreSQL 데이터베이스 연결

## 📝 커밋 메시지 컨벤션

### 형식

```
<type>: <subject>

<body>

<footer>
```

### 타입 종류

- `feat`: 새로운 기능
- `fix`: 버그 수정
- `docs`: 문서 수정
- `style`: 코드 스타일 변경
- `refactor`: 코드 리팩토링
- `test`: 테스트 추가/수정
- `chore`: 빌드/배포 관련 작업

### 예시

```bash
# 기능 추가
git commit -m "feat: 팀 배정 알고리즘 구현

- 성별과 에버를 고려한 팀 밸런싱
- 팀 수와 팀 인원 설정 가능
- 최적화 알고리즘 적용"

# 버그 수정
git commit -m "fix: 회원 등록 시 중복 검사 오류 수정

- 이름 중복 검사 로직 개선
- 에러 메시지 정확성 향상"

# 문서 업데이트
git commit -m "docs: 배포 가이드 추가

- Vercel/Railway 배포 방법 설명
- 환경변수 설정 가이드 추가"
```

## ⚠️ 주의사항

### 절대 커밋하면 안 되는 것들

- `.env` 파일
- `API_KEY/` 폴더
- `node_modules/` 폴더
- `__pycache__/` 폴더
- 개인 정보가 포함된 파일

### 커밋 전 확인사항

1. `git status`로 추가될 파일들 확인
2. 민감한 정보가 포함되지 않았는지 확인
3. 빌드 오류가 없는지 확인
4. 테스트가 통과하는지 확인

## 🆘 문제 해결

### 커밋 취소

```bash
# 마지막 커밋 취소 (파일은 유지)
git reset --soft HEAD~1

# 마지막 커밋 완전 삭제
git reset --hard HEAD~1
```

### 민감한 정보 커밋 시

```bash
# 1. 커밋 히스토리에서 파일 제거
git filter-branch --force --index-filter \
'git rm --cached --ignore-unmatch API_KEY/teamcover-b5f742722476.json' \
--prune-empty --tag-name-filter cat -- --all

# 2. 강제 푸시
git push origin --force --all
```

## 📞 도움말

커밋이나 배포 과정에서 문제가 발생하면:

1. `git status`로 현재 상태 확인
2. `git log --oneline`으로 커밋 히스토리 확인
3. 에러 메시지 확인 후 해결 방법 검색
