# 📧 이메일 인증 설정 가이드

## 🆓 완전 무료 이메일 인증 시스템

Gmail SMTP를 사용한 무료 이메일 인증 기능을 구현했습니다.

## 🔧 Gmail 앱 비밀번호 설정

### 1단계: Gmail 2단계 인증 활성화

1. [Google 계정 설정](https://myaccount.google.com/) 접속
2. "보안" → "2단계 인증" 선택
3. 2단계 인증 활성화 (휴대폰 번호 등록 필요)

### 2단계: 앱 비밀번호 생성

1. Google 계정 설정에서 "보안" → "앱 비밀번호" 선택
2. "앱 선택" → "메일" 선택
3. "기기 선택" → "기타(맞춤 이름)" 선택
4. 이름 입력: "Teamcover Email Service"
5. "생성" 클릭
6. **16자리 앱 비밀번호 복사** (예: `abcd efgh ijkl mnop`)

## ⚙️ 환경 변수 설정

### 백엔드 환경 변수 (.env)

```env
# 이메일 인증 설정 (Gmail SMTP)
MAIL_USERNAME=your-gmail@gmail.com
MAIL_PASSWORD=your-16-digit-app-password
```

### 프론트엔드 환경 변수 (.env)

```env
REACT_APP_API_URL=http://localhost:5000
```

## 🚀 사용 방법

### 1. 회원가입 프로세스

1. 사용자가 회원가입
2. **자동으로 이메일 인증 링크 발송**
3. 사용자가 이메일에서 링크 클릭
4. 이메일 인증 완료 후 로그인 가능

### 2. 이메일 인증 페이지

- URL: `http://localhost:3000/verify-email?token=인증토큰`
- 자동으로 토큰 검증
- 인증 실패 시 재발송 기능 제공

## 📊 무료 한도

### Gmail SMTP 한도

- **일일 발송**: 500개 이메일
- **월 발송**: 15,000개 이메일
- **완전 무료** (Gmail 계정만 있으면 됨)

### 대안 (더 많은 이메일 필요 시)

- **SendGrid**: 월 100개 무료
- **Mailgun**: 월 5,000개 무료
- **Amazon SES**: 월 62,000개 무료 (AWS 계정 필요)

## 🔍 테스트 방법

### 1. 로컬 테스트

```bash
# 백엔드 실행
cd backend
python app.py

# 프론트엔드 실행
cd frontend
npm start
```

### 2. 회원가입 테스트

1. `http://localhost:3000/login` 접속
2. "회원가입" 탭 선택
3. 이메일, 이름, 비밀번호 입력
4. "회원가입" 클릭
5. 이메일 확인하여 인증 링크 클릭

## 🛠️ 문제 해결

### 이메일이 발송되지 않는 경우

1. **Gmail 앱 비밀번호 확인**: 16자리 정확히 입력
2. **2단계 인증 활성화**: 필수 조건
3. **방화벽 확인**: 587 포트 차단 여부
4. **로그 확인**: 백엔드 콘솔에서 오류 메시지 확인

### 인증 링크가 작동하지 않는 경우

1. **토큰 만료**: 1시간 후 만료 (재발송 필요)
2. **URL 인코딩**: 특수문자 문제
3. **도메인 설정**: FRONTEND_BASE_URL 확인

### 일반적인 오류

```
SMTPAuthenticationError: Username and Password not accepted
→ Gmail 앱 비밀번호 재확인

SMTPRecipientsRefused: Recipient address rejected
→ 이메일 주소 형식 확인

Connection refused
→ 네트워크/방화벽 문제
```

## 📧 이메일 템플릿 커스터마이징

`backend/email_service.py`에서 이메일 내용을 수정할 수 있습니다:

```python
def send_verification_email(email, name):
    # HTML 템플릿 수정
    html_body = f"""
    <html>
    <body>
        <h1>🎳 Teamcover</h1>
        <h2>이메일 인증</h2>
        <p>안녕하세요 {name}님!</p>
        <!-- 여기에 원하는 내용 추가 -->
    </body>
    </html>
    """
```

## 🔒 보안 고려사항

1. **토큰 만료**: 1시간 후 자동 만료
2. **HTTPS 사용**: 프로덕션에서는 반드시 HTTPS
3. **이메일 검증**: 실제 이메일 주소만 허용
4. **재발송 제한**: 스팸 방지를 위한 제한 고려

## 📈 모니터링

### 이메일 발송 상태 확인

- 백엔드 로그에서 발송 성공/실패 확인
- 데이터베이스에서 사용자 활성화 상태 확인

### 통계 수집 (선택사항)

- 일일/월별 이메일 발송 수
- 인증 성공률
- 재발송 요청 수

이제 완전 무료로 이메일 인증 기능을 사용할 수 있습니다! 🎉
