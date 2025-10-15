# 🚀 Gmail SMTP 빠른 설정 가이드

## ⚡ 5분 만에 Gmail SMTP 설정하기

### 1단계: Gmail 2단계 인증 활성화 (2분)

1. **[Google 계정 설정](https://myaccount.google.com/security)** 접속
2. **"2단계 인증"** 클릭
3. **"시작하기"** 클릭
4. 휴대폰 번호 입력하여 인증
5. **"사용함"** 상태로 변경

### 2단계: 앱 비밀번호 생성 (2분)

1. **"앱 비밀번호"** 클릭 (2단계 인증 활성화 후 나타남)
2. **"앱 선택"** → **"메일"** 선택
3. **"기기 선택"** → **"기타(맞춤 이름)"** 선택
4. 이름: **"Teamcover Email Service"**
5. **"생성"** 클릭
6. **16자리 비밀번호 복사** (예: `abcd efgh ijkl mnop`)

### 3단계: 환경 변수 설정 (1분)

```env
# backend/.env 파일에 추가
MAIL_USERNAME=your-gmail@gmail.com
MAIL_PASSWORD=abcdefghijklmnop
```

**중요:**

- `MAIL_USERNAME`: Gmail 주소 (예: `test@gmail.com`)
- `MAIL_PASSWORD`: 앱 비밀번호 16자리 (공백 제거)
- Gmail 계정 비밀번호가 아님!

### 4단계: 백엔드 재시작

```bash
cd backend
python app.py
```

### 5단계: 설정 확인

브라우저에서 확인:

```
GET http://localhost:5000/api/auth/email-config
```

**성공 응답:**

```json
{
  "success": true,
  "mail_username": "your-gmail@gmail.com",
  "mail_password_set": true,
  "mail_server": "smtp.gmail.com",
  "mail_port": 587,
  "mail_use_tls": true
}
```

## 🔧 문제 해결

### "앱 비밀번호" 옵션이 보이지 않는 경우

- 2단계 인증이 완전히 활성화되었는지 확인
- 페이지 새로고침 후 다시 시도

### "Username and Password not accepted" 오류

- 앱 비밀번호가 16자리인지 확인
- 공백 제거: `abcd efgh ijkl mnop` → `abcdefghijklmnop`
- Gmail 주소가 정확한지 확인

### 이메일이 발송되지 않는 경우

- 방화벽에서 587 포트 차단 여부 확인
- 회사/학교 네트워크에서 Gmail SMTP 차단 여부 확인

## ✅ 테스트

1. 회원가입 시도
2. "이메일을 확인하여 인증을 완료해주세요" 메시지 확인
3. 이메일에서 인증 링크 클릭
4. 인증 완료 후 로그인 가능

## 📞 도움말

설정이 안 되면:

1. 백엔드 콘솔 로그 확인
2. `http://localhost:5000/api/auth/email-config` 응답 확인
3. Gmail 2단계 인증 상태 재확인

**이제 무조건 이메일 인증이 필요합니다!** 🎉
