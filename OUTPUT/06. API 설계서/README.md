## 06. API 설계서

Teamcover 서비스의 **백엔드 API**를 정리하는 문서입니다.

### 1. 공통 규칙

- **Base URL**
  - 개발: `http://localhost:5000/` (예시)
  - 운영: `teamcover-backend.up.railway.app` (예시)
- **인증 방식**
  - Authorization 헤더에 JWT 토큰 사용 예: `Authorization: Bearer <token>`
- **응답 포맷**
  - 공통 래퍼 예시:
    ```json
    {
      "success": true,
      "data": {},
      "error": null
    }
    ```

### 2. 엔드포인트 목록(예시)

| 구분    | Method | Path                   | 설명           |
| ------- | ------ | ---------------------- | -------------- |
| Auth    | POST   | `/api/auth/login`      | 로그인         |
| Auth    | POST   | `/api/auth/logout`     | 로그아웃       |
| Members | GET    | `/api/members`         | 회원 목록 조회 |
| Members | GET    | `/api/members/:id`     | 회원 상세 조회 |
| Members | POST   | `/api/members`         | 회원 생성      |
| Members | PATCH  | `/api/members/:id`     | 회원 정보 수정 |
| Matches | GET    | `/api/matches`         | 경기 목록 조회 |
| Billing | GET    | `/api/billing/summary` | 정산 요약 조회 |

### 3. 상세 API 스펙 템플릿

#### 예시: 회원 목록 조회 API

- **Endpoint**
  - `GET /api/members`
- **Query Parameters**
  - `page` (number, optional, default: 1)
  - `pageSize` (number, optional, default: 20)
  - `keyword` (string, optional)
  - `status` (string, optional)
- **Response 예시**
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "uuid",
          "name": "홍길동",
          "phone": "010-0000-0000",
          "status": "ACTIVE"
        }
      ],
      "totalCount": 123
    },
    "error": null
  }
  ```

### 4. 에러 응답 규칙

- **공통 에러 형식**
  ```json
  {
    "success": false,
    "data": null,
    "error": {
      "code": "MEMBER_NOT_FOUND",
      "message": "해당 회원을 찾을 수 없습니다."
    }
  }
  ```
- **주요 에러 코드 예시**
  - `UNAUTHORIZED`
  - `FORBIDDEN`
  - `VALIDATION_ERROR`
  - `INTERNAL_SERVER_ERROR`

### 5. 버전 관리

- URL 버전 예시: `/api/v1/...`
- 호환성 깨지는 변경 시 v2, v3 등으로 분리

### 6. 문서화 도구

- Swagger / OpenAPI, Postman Collection 등을 사용해 실제 요청/응답 예제를 관리하는 것을 권장합니다.
