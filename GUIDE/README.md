# Teamcover - 볼링 팀 관리 시스템

볼링 팀 관리와 스코어 추적을 위한 통합 플랫폼입니다.

## 🏗️ 프로젝트 구조

```
Teamcover/
├── backend/                 # 백엔드 API 서버 (Flask)
│   ├── blueprints/         # Flask Blueprint 모듈들
│   │   ├── __init__.py     # Blueprint 패키지 초기화
│   │   ├── members.py      # 회원 관리 API
│   │   ├── scores.py       # 스코어 관리 API
│   │   ├── points.py       # 포인트 관리 API
│   │   ├── teams.py        # 팀 배정 API
│   │   ├── ocr.py          # OCR 처리 API
│   │   └── sheets.py       # 구글 시트 연동 API
│   ├── app.py              # 메인 Flask 애플리케이션
│   ├── models.py           # 데이터베이스 모델
│   ├── config.py           # 설정 파일
│   ├── requirements.txt    # Python 의존성
│   ├── Dockerfile         # 백엔드 Docker 설정
│   ├── google_sheets.py   # 구글 시트 연동
│   ├── ocr_module.py      # OCR 기능
│   └── bowling_team_maker.py # 팀 배정 알고리즘
├── frontend/               # 프론트엔드 (React)
│   ├── src/               # React 소스 코드
│   │   ├── components/    # React 컴포넌트
│   │   ├── pages/        # 페이지 컴포넌트
│   │   ├── services/     # API 서비스
│   │   ├── App.js        # 메인 앱
│   │   └── index.js      # 진입점
│   ├── public/           # 정적 파일
│   ├── package.json      # Node.js 의존성
│   └── Dockerfile        # 프론트엔드 Docker 설정
├── docker-compose.yml     # 전체 시스템 Docker 설정
├── start-dev.bat         # 개발 환경 실행 스크립트
├── start-docker.bat      # Docker 환경 실행 스크립트
└── README.md             # 프로젝트 문서
```

## 🚀 주요 기능

- **회원 관리**: 팀커버 회원들의 정보를 체계적으로 관리
- **스코어 관리**: 볼링 게임 결과를 기록하고 개인별 통계 확인
- **포인트 관리**: 회원들의 포인트 적립과 사용 내역 관리
- **팀 배정**: 공정하고 균형잡힌 팀을 자동으로 구성
- **OCR 기능**: 이미지에서 스코어 자동 추출
- **구글 시트 연동**: 외부 데이터 가져오기 및 동기화

## 🛠️ 기술 스택

### 백엔드

- **Flask**: Python 웹 프레임워크
- **SQLAlchemy**: ORM
- **PostgreSQL**: 관계형 데이터베이스
- **Flask-CORS**: 크로스 오리진 리소스 공유
- **Blueprint**: 모듈화된 라우팅 구조

### 프론트엔드

- **React**: 사용자 인터페이스
- **React Router**: 페이지 라우팅
- **Axios**: HTTP 클라이언트
- **CSS3**: 스타일링

### 인프라

- **Docker**: 컨테이너화
- **Docker Compose**: 다중 서비스 관리
- **Nginx**: 웹 서버 (프론트엔드)
- **Gunicorn**: WSGI 서버 (백엔드)

## 📋 설치 및 실행

### 1. 사전 요구사항

- Docker
- Docker Compose

### 2. 프로젝트 클론

```bash
git clone <repository-url>
cd Teamcover
```

### 3. 환경 설정

```bash
# API 키 파일이 API_KEY/ 디렉토리에 있는지 확인
ls API_KEY/
```

### 4. Docker로 실행

```bash
# 전체 시스템 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 서비스 중지
docker-compose down
```

### 5. 개별 서비스 실행

#### 백엔드

```bash
cd backend
pip install -r requirements.txt
python app.py
```

#### 프론트엔드

```bash
cd frontend
npm install
npm start
```

## 🌐 접속 정보

- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:5000
- **데이터베이스**: localhost:5432

## 📚 API 문서

### 회원 관리

- `GET /api/members` - 회원 목록 조회
- `POST /api/members` - 회원 등록
- `PUT /api/members/<id>` - 회원 정보 수정
- `DELETE /api/members/<id>` - 회원 삭제
- `GET /api/members/<id>/average` - 회원별 에버 조회
- `GET /api/members/averages` - 전체 회원 에버 조회

### 스코어 관리

- `GET /api/scores` - 스코어 목록 조회
- `POST /api/scores` - 스코어 등록
- `PUT /api/scores/<id>` - 스코어 수정
- `DELETE /api/scores/<id>` - 스코어 삭제

### 포인트 관리

- `GET /api/points` - 포인트 목록 조회
- `POST /api/points` - 포인트 등록
- `PUT /api/points/<id>` - 포인트 수정
- `DELETE /api/points/<id>` - 포인트 삭제

### 팀 배정

- `POST /api/add-player` - 선수 추가
- `GET /api/get-players` - 선수 목록 조회
- `POST /api/delete-player` - 선수 삭제
- `POST /api/clear-players` - 모든 선수 삭제
- `POST /api/make-teams` - 팀 구성

### OCR 및 구글 시트

- `POST /api/ocr` - 이미지 OCR 처리
- `POST /api/scores/import-from-sheets` - 구글 시트에서 스코어 가져오기
- `POST /api/members/import-from-sheets` - 구글 시트에서 회원 가져오기
- `POST /api/points/import-from-sheets` - 구글 시트에서 포인트 가져오기

## 🧪 개발 환경 설정

### 백엔드 개발

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

### 프론트엔드 개발

```bash
cd frontend
npm install
npm start
```

## 🔧 환경 변수

### 백엔드

- `FLASK_ENV`: Flask 환경 (development/production)
- `DB_HOST`: 데이터베이스 호스트
- `DB_PORT`: 데이터베이스 포트
- `DB_NAME`: 데이터베이스 이름
- `DB_USER`: 데이터베이스 사용자
- `DB_PASSWORD`: 데이터베이스 비밀번호

### 프론트엔드

- `REACT_APP_API_URL`: 백엔드 API URL

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 📞 문의

프로젝트에 대한 문의사항이 있으시면 이슈를 생성해 주세요.
