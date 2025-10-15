# 구글 시트 연동 가이드

## 1. 구글 시트 템플릿

### 회원 관리 시트 템플릿

다음 형식으로 구글 시트를 준비하세요:

| 이름   | 전화번호      | 성별 | 레벨 | 이메일         | 메모   |
| ------ | ------------- | ---- | ---- | -------------- | ------ |
| 김철수 | 010-1234-5678 | 남   | 중급 | kim@email.com  | 팀장   |
| 이영희 | 010-9876-5432 | 여   | 고급 | lee@email.com  | 부팀장 |
| 박민수 | 010-5555-1234 | 남   | 초급 | park@email.com | 신입   |

**지원하는 컬럼명:**

- **이름**: `이름`, `name`, `Name` (필수)
- **전화번호**: `전화번호`, `phone`, `Phone`
- **성별**: `성별`, `gender`, `Gender` (남/여, 남성/여성, male/female, m/f)
- **레벨**: `레벨`, `level`, `Level` (초급/중급/고급/전문)
- **이메일**: `이메일`, `email`, `Email`
- **메모**: `메모`, `note`, `Note`

### 스코어 관리 시트 템플릿

다음 형식으로 구글 시트를 준비하세요:

| 이름   | 날짜       | 1게임 | 2게임 | 3게임 | 메모           |
| ------ | ---------- | ----- | ----- | ----- | -------------- |
| 김철수 | 2025-01-20 | 158   | 145   | 166   | 좋은 컨디션    |
| 이영희 | 2025-01-19 | 172   | 159   | 157   | 스트라이크 3개 |
| 박민수 | 2025-01-18 | 138   | 145   | 143   | 초보자         |

**지원하는 컬럼명:**

- **이름**: `이름`, `name`, `Name` (필수)
- **날짜**: `날짜`, `date`, `Date` (YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY, DD/MM/YYYY)
- **1게임**: `1게임`, `score1`, `Score1`
- **2게임**: `2게임`, `score2`, `Score2`
- **3게임**: `3게임`, `score3`, `Score3`
- **메모**: `메모`, `note`, `Note`

## 2. 구글 서비스 계정 설정

### 2-1. Google Cloud Console 설정

1. **Google Cloud Console** 접속: https://console.cloud.google.com/
2. **새 프로젝트 생성** 또는 기존 프로젝트 선택
3. **Google Sheets API 활성화**:
   - API 및 서비스 → API 및 서비스 사용 설정
   - "Google Sheets API" 검색 후 활성화

### 2-2. 서비스 계정 생성

1. **IAM 및 관리** → **서비스 계정**
2. **서비스 계정 만들기** 클릭
3. **서비스 계정 세부정보**:
   - 서비스 계정 이름: `teamcover-sheets`
   - 서비스 계정 ID: 자동 생성
   - 설명: `TeamCover 구글 시트 연동용`
4. **키 만들기** → **JSON** 선택
5. **JSON 키 파일 다운로드**

### 2-3. 인증 방법 (2가지 선택)

#### 방법 1: JSON 파일 사용 (권장)

1. **API_KEY 폴더 생성**: 프로젝트 루트에 `API_KEY` 폴더 생성
2. **JSON 파일 복사**: 다운로드한 JSON 키 파일을 `API_KEY` 폴더에 복사
3. **파일명 변경**: `teamcover-b5f742722476.json` (또는 원하는 이름으로 변경)

```
프로젝트_루트/
├── API_KEY/
│   └── teamcover-b5f742722476.json
├── app.py
├── google_sheets.py
└── ...
```

#### 방법 2: 환경 변수 사용

프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가:

```env
# PostgreSQL 데이터베이스 설정
DB_HOST=localhost
DB_PORT=5432
DB_NAME=teamcover_db
DB_USER=postgres
DB_PASSWORD=teamcover123

# Flask 설정
FLASK_SECRET_KEY=teamcover_secret_key_2025
FLASK_ENV=development

# Google 서비스 계정 설정 (JSON 키 파일 내용에서 추출)
GOOGLE_TYPE=service_account
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_PRIVATE_KEY_ID=your-private-key-id
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CLIENT_EMAIL=teamcover-sheets@your-project-id.iam.gserviceaccount.com
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
GOOGLE_TOKEN_URI=https://oauth2.googleapis.com/token
GOOGLE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
GOOGLE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/teamcover-sheets%40your-project-id.iam.gserviceaccount.com
```

**중요**: `GOOGLE_PRIVATE_KEY`는 JSON 키 파일에서 `private_key` 값을 그대로 복사하되, 줄바꿈을 `\n`으로 변경해야 합니다.

### 2-4. 구글 시트 공유 설정

1. **구글 시트 열기**
2. **공유** 버튼 클릭
3. **사용자 및 그룹 추가**:
   - 이메일: 서비스 계정 이메일 (예: `teamcover-sheets@your-project-id.iam.gserviceaccount.com`)
   - 권한: **편집자** 선택
4. **완료** 클릭

## 3. 사용 방법

### 3-1. 회원 가져오기

1. **회원 관리 페이지** 접속: `http://localhost:5000/members`
2. **구글 시트에서 회원 가져오기** 섹션에서:
   - 구글 시트 URL 입력
   - 워크시트 이름 입력 (선택사항)
3. **구글 시트에서 가져오기** 버튼 클릭

### 3-2. 스코어 가져오기

1. **스코어 관리 페이지** 접속: `http://localhost:5000/scores`
2. **구글 시트에서 스코어 가져오기** 섹션에서:
   - 구글 시트 URL 입력
   - 워크시트 이름 입력 (선택사항)
3. **구글 시트에서 가져오기** 버튼 클릭

## 4. 주의사항

### 4-1. 데이터 형식

- **이름**: 필수 입력 항목
- **전화번호**: 자동으로 형식 정리 (010-1234-5678)
- **성별**: 남/여로 자동 변환
- **레벨**: 초급/중급/고급/전문만 인식
- **날짜**: 다양한 형식 지원
- **스코어**: 숫자만 추출하여 처리

### 4-2. 중복 처리

- **회원**: 이름이 동일한 경우 건너뜀
- **스코어**: 회원명과 날짜가 동일한 경우 건너뜀

### 4-3. 오류 처리

- 파싱할 수 없는 데이터는 건너뛰고 오류 로그 출력
- 등록되지 않은 회원의 스코어는 건너뜀
- 필수 필드가 없는 행은 건너뜀

## 5. 문제 해결

### 5-1. 인증 오류

- **JSON 파일 사용 시**: `API_KEY` 폴더에 JSON 파일이 올바르게 있는지 확인
- **환경 변수 사용 시**: `.env` 파일의 모든 필수 필드가 설정되었는지 확인
- Google Sheets API가 활성화되었는지 확인

### 5-2. 권한 오류

- 구글 시트가 서비스 계정과 공유되었는지 확인
- 서비스 계정에 편집 권한이 있는지 확인

### 5-3. 데이터 파싱 오류

- 구글 시트 형식이 템플릿과 일치하는지 확인
- 컬럼명이 지원되는 형식인지 확인
- 데이터에 특수문자나 이상한 값이 없는지 확인

### 5-4. 서버 로그 확인

서버 콘솔에서 다음과 같은 메시지를 확인할 수 있습니다:

- `"API_KEY 폴더에서 JSON 파일로 인증 성공: API_KEY/teamcover-b5f742722476.json"`
- `"환경 변수로 인증 성공"`
- `"구글 인증 오류: ..."` (오류 발생 시)
