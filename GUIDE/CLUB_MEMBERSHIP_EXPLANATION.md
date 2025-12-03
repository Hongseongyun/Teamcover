# 클럽 멤버십 구조 설명

## 데이터베이스 구조

### 테이블 관계

```
users (사용자)
  ↓ (1:N)
club_members (중간 테이블)
  ↓ (N:1)
clubs (클럽)
```

### 테이블 구조

#### 1. `users` 테이블

- 사용자 기본 정보만 저장
- 클럽 정보는 **직접 저장하지 않음**

#### 2. `club_members` 테이블 (중간 테이블)

- `user_id`: 사용자 ID (외래키)
- `club_id`: 클럽 ID (외래키)
- `role`: 클럽 내 역할 ('member', 'admin', 'owner')
- `joined_at`: 가입일시

#### 3. `clubs` 테이블

- 클럽 기본 정보 저장

## 클럽 조회 방법

### 사용자가 가입한 클럽 목록 조회

```python
# 1. 사용자 ID로 club_members 테이블에서 멤버십 조회
user_id = 1
memberships = ClubMember.query.filter_by(user_id=user_id).all()

# 2. 각 멤버십을 통해 클럽 정보 접근
for membership in memberships:
    club = membership.club  # 관계를 통해 클럽 정보 접근
    role = membership.role  # 해당 클럽에서의 역할
```

### 실제 API 코드 (backend/blueprints/clubs.py)

```python
@clubs_bp.route('/', methods=['GET'])
@jwt_required()
def get_user_clubs():
    """사용자가 가입한 클럽 목록 조회"""
    user_id = int(get_jwt_identity())

    # club_members 테이블에서 해당 사용자의 모든 멤버십 조회
    memberships = ClubMember.query.filter_by(user_id=user_id).all()

    clubs_data = []
    for membership in memberships:
        # membership.club을 통해 클럽 정보 접근
        club_data = membership.club.to_dict()
        club_data['role'] = membership.role  # 클럽 내 역할
        clubs_data.append(club_data)

    return jsonify({'success': True, 'clubs': clubs_data})
```

## 왜 이렇게 설계했나요?

### 다대다 관계 (Many-to-Many)

한 사용자는 여러 클럽에 가입할 수 있고, 한 클럽에는 여러 사용자가 가입할 수 있습니다.

- ❌ User 테이블에 `club_id` 컬럼 추가: 한 사용자가 한 클럽에만 가입 가능
- ✅ `club_members` 중간 테이블 사용: 한 사용자가 여러 클럽에 가입 가능

### 장점

1. **다중 클럽 지원**: 한 사용자가 여러 클럽에 가입 가능
2. **클럽별 역할 관리**: 같은 사용자가 클럽마다 다른 역할 가능
   - 예: A 클럽에서는 'owner', B 클럽에서는 'member'
3. **유연한 구조**: 클럽 가입/탈퇴가 쉬움

## 데이터 흐름

1. **회원가입 시**:

   - `users` 테이블에 사용자 생성
   - `club_members` 테이블에 사용자-클럽 관계 생성

2. **로그인 시**:

   - JWT에서 `user_id` 추출
   - `club_members` 테이블에서 `user_id`로 조회
   - 가입한 모든 클럽 정보 반환

3. **클럽 선택 시**:
   - 선택한 `club_id`를 localStorage에 저장
   - 이후 API 요청 시 `X-Club-Id` 헤더로 전송
   - 백엔드에서 해당 클럽의 데이터만 필터링

## SQL 쿼리 예시

```sql
-- 사용자가 가입한 클럽 목록 조회
SELECT
    c.id,
    c.name,
    c.description,
    cm.role,
    cm.joined_at
FROM clubs c
INNER JOIN club_members cm ON c.id = cm.club_id
WHERE cm.user_id = 1;
```
