# 다중 클럽 지원 구현 가이드

## 개요

이 가이드는 단일 클럽 관리 서비스를 다중 클럽 지원 서비스로 확장하는 방법을 설명합니다.

## 핵심 요구사항

- 사용자가 여러 클럽에 가입 가능
- 클럽별로 독립적인 역할 (한 클럽에서는 운영진, 다른 클럽에서는 일반 회원)
- 클럽별로 독립적인 데이터 관리 (스코어, 회비, 팀배정 등)
- 포인트 시스템은 클럽별로 선택적 (활성화/비활성화 가능)

---

## 1단계: 데이터베이스 모델 설계

### 1.1 새로운 모델 추가

#### Club 모델

```python
class Club(db.Model):
    """볼링 클럽 모델"""
    __tablename__ = 'clubs'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)  # 클럽 이름
    description = db.Column(db.Text, nullable=True)  # 클럽 설명
    is_points_enabled = db.Column(db.Boolean, default=False)  # 포인트 시스템 활성화 여부
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    # 관계
    creator = db.relationship('User', foreign_keys=[created_by])

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'is_points_enabled': self.is_points_enabled,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None
        }
```

#### ClubMember 모델 (사용자-클럽 다대다 관계)

```python
class ClubMember(db.Model):
    """사용자-클럽 관계 모델 (다대다)"""
    __tablename__ = 'club_members'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='member')  # 'member', 'admin', 'owner'
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)

    # 관계
    user = db.relationship('User', backref=db.backref('club_memberships', lazy=True))
    club = db.relationship('Club', backref=db.backref('memberships', lazy=True))

    # 중복 가입 방지
    __table_args__ = (db.UniqueConstraint('user_id', 'club_id', name='unique_user_club'),)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'club_id': self.club_id,
            'role': self.role,
            'joined_at': self.joined_at.strftime('%Y-%m-%d %H:%M:%S') if self.joined_at else None,
            'user_name': self.user.name if self.user else None,
            'club_name': self.club.name if self.club else None
        }
```

### 1.2 기존 모델 수정

모든 클럽 관련 데이터 모델에 `club_id` 추가:

```python
# Member 모델에 추가
club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=True)  # 마이그레이션 후 필수로 변경
club = db.relationship('Club', backref=db.backref('members', lazy=True))

# Score 모델에 추가
club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=True)

# Point 모델에 추가
club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=True)

# Payment 모델에 추가
club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=True)

# Post 모델에 추가
club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=True)

# FundState 모델에 추가
club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=True)

# FundLedger 모델에 추가
club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=True)
```

---

## 2단계: 마이그레이션 스크립트 작성

### 2.1 마이그레이션 SQL 스크립트 (PostgreSQL)

`backend/migrations/add_multi_club_support_postgres.sql` 파일 생성:

**PostgreSQL 전용 SQL 스크립트가 생성되었습니다.** 주요 특징:

- `SERIAL` 타입 사용 (자동 증가)
- `TIMESTAMP` 타입 사용
- `BOOLEAN` 기본값 `true/false` 사용
- `DO $$ ... END $$` 블록으로 조건부 실행
- 외래키 제약조건 및 인덱스 자동 생성
- `updated_at` 자동 업데이트 트리거 포함

**실행 방법:**

```bash
# psql을 사용하는 경우
psql -U postgres -d teamcover_db -f backend/migrations/add_multi_club_support_postgres.sql

# 또는 Python에서 실행
python -c "from sqlalchemy import create_engine, text; engine = create_engine('postgresql://...'); with open('backend/migrations/add_multi_club_support_postgres.sql') as f: engine.execute(text(f.read()))"
```

**스크립트 내용:**

- ✅ Club 테이블 생성
- ✅ ClubMember 테이블 생성 (다대다 관계)
- ✅ 기존 테이블에 `club_id` 컬럼 추가 (이미 존재 시 스킵)
- ✅ 기본 클럽 생성 및 기존 데이터 마이그레이션
- ✅ 기존 사용자들을 기본 클럽에 가입
- ✅ 외래키 제약조건 추가
- ✅ 성능 향상을 위한 인덱스 생성
- ✅ `updated_at` 자동 업데이트 트리거

**주의사항:**

- 스크립트는 멱등성(idempotent)을 보장합니다. 여러 번 실행해도 안전합니다.
- 기존 데이터는 모두 '기본 클럽'으로 마이그레이션됩니다.
- 기존 사용자 역할에 따라 클럽 역할이 자동 매핑됩니다:
  - `super_admin` → `owner`
  - `admin` → `admin`
  - `user` → `member`

### 2.2 Python 마이그레이션 스크립트

`backend/migrations/add_multi_club_migration.py` 파일 생성:

```python
"""
다중 클럽 지원 마이그레이션 스크립트
"""
from models import db, Club, ClubMember, User, Member, Score, Point, Payment, Post, FundState, FundLedger
from app import app

def migrate_to_multi_club():
    """기존 데이터를 다중 클럽 구조로 마이그레이션"""
    with app.app_context():
        try:
            # 1. 기본 클럽 생성
            default_club = Club.query.filter_by(name='기본 클럽').first()
            if not default_club:
                default_club = Club(
                    name='기본 클럽',
                    description='기존 데이터를 위한 기본 클럽',
                    is_points_enabled=True
                )
                db.session.add(default_club)
                db.session.commit()
                print(f"✅ 기본 클럽 생성 완료: ID={default_club.id}")

            club_id = default_club.id

            # 2. 기존 데이터에 club_id 설정
            Member.query.filter(Member.club_id.is_(None)).update({Member.club_id: club_id})
            Score.query.filter(Score.club_id.is_(None)).update({Score.club_id: club_id})
            Point.query.filter(Point.club_id.is_(None)).update({Point.club_id: club_id})
            Payment.query.filter(Payment.club_id.is_(None)).update({Payment.club_id: club_id})
            Post.query.filter(Post.club_id.is_(None)).update({Post.club_id: club_id})
            FundState.query.filter(FundState.club_id.is_(None)).update({FundState.club_id: club_id})
            FundLedger.query.filter(FundLedger.club_id.is_(None)).update({FundLedger.club_id: club_id})

            db.session.commit()
            print("✅ 기존 데이터에 club_id 설정 완료")

            # 3. 기존 사용자들을 기본 클럽에 가입
            users = User.query.all()
            for user in users:
                existing_membership = ClubMember.query.filter_by(
                    user_id=user.id,
                    club_id=club_id
                ).first()

                if not existing_membership:
                    # 역할 매핑: super_admin -> owner, admin -> admin, user -> member
                    role = 'owner' if user.role == 'super_admin' else ('admin' if user.role == 'admin' else 'member')

                    membership = ClubMember(
                        user_id=user.id,
                        club_id=club_id,
                        role=role
                    )
                    db.session.add(membership)

            db.session.commit()
            print("✅ 기존 사용자 클럽 가입 완료")

            print("✅ 마이그레이션 완료!")

        except Exception as e:
            db.session.rollback()
            print(f"❌ 마이그레이션 실패: {e}")
            raise

if __name__ == '__main__':
    migrate_to_multi_club()
```

---

## 3단계: 백엔드 API 구현

### 3.1 클럽 관리 Blueprint 생성

`backend/blueprints/clubs.py` 파일 생성:

```python
from flask import Blueprint, request, jsonify, make_response
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Club, ClubMember, User
from datetime import datetime

clubs_bp = Blueprint('clubs', __name__, url_prefix='/api/clubs')

@clubs_bp.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = make_response()
        from flask import current_app
        allowed_origins = current_app.config.get('CORS_ALLOWED_ORIGINS', [])
        request_origin = request.headers.get('Origin')
        if request_origin and request_origin in allowed_origins:
            response.headers.add("Access-Control-Allow-Origin", request_origin)
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization,X-Requested-With")
        response.headers.add('Access-Control-Allow-Methods', "GET,PUT,POST,DELETE,OPTIONS")
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

def get_user_club_role(user_id, club_id):
    """사용자의 클럽 내 역할 조회"""
    membership = ClubMember.query.filter_by(user_id=user_id, club_id=club_id).first()
    return membership.role if membership else None

def check_club_permission(user_id, club_id, required_role='member'):
    """클럽 권한 확인"""
    role = get_user_club_role(user_id, club_id)
    if not role:
        return False

    role_hierarchy = {'member': 1, 'admin': 2, 'owner': 3}
    return role_hierarchy.get(role, 0) >= role_hierarchy.get(required_role, 0)

# 클럽 목록 조회 (사용자가 가입한 클럽)
@clubs_bp.route('/', methods=['GET'])
@jwt_required()
def get_user_clubs():
    """사용자가 가입한 클럽 목록 조회"""
    try:
        user_id = int(get_jwt_identity())
        memberships = ClubMember.query.filter_by(user_id=user_id).all()

        clubs_data = []
        for membership in memberships:
            club_data = membership.club.to_dict()
            club_data['role'] = membership.role
            club_data['joined_at'] = membership.joined_at.strftime('%Y-%m-%d %H:%M:%S')
            clubs_data.append(club_data)

        return jsonify({
            'success': True,
            'clubs': clubs_data
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'클럽 목록 조회 실패: {str(e)}'}), 500

# 클럽 생성
@clubs_bp.route('/', methods=['POST'])
@jwt_required()
def create_club():
    """새 클럽 생성"""
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json()

        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        is_points_enabled = data.get('is_points_enabled', False)

        if not name:
            return jsonify({'success': False, 'message': '클럽 이름을 입력해주세요.'}), 400

        # 클럽 생성
        club = Club(
            name=name,
            description=description,
            is_points_enabled=is_points_enabled,
            created_by=user_id
        )
        db.session.add(club)
        db.session.flush()  # ID 생성

        # 생성자를 owner로 가입
        membership = ClubMember(
            user_id=user_id,
            club_id=club.id,
            role='owner'
        )
        db.session.add(membership)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '클럽이 생성되었습니다.',
            'club': club.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'클럽 생성 실패: {str(e)}'}), 500

# 클럽 상세 조회
@clubs_bp.route('/<int:club_id>', methods=['GET'])
@jwt_required()
def get_club(club_id):
    """클럽 상세 정보 조회"""
    try:
        user_id = int(get_jwt_identity())

        # 클럽 존재 확인
        club = Club.query.get_or_404(club_id)

        # 가입 여부 확인
        membership = ClubMember.query.filter_by(user_id=user_id, club_id=club_id).first()
        if not membership:
            return jsonify({'success': False, 'message': '가입하지 않은 클럽입니다.'}), 403

        club_data = club.to_dict()
        club_data['role'] = membership.role

        return jsonify({
            'success': True,
            'club': club_data
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'클럽 조회 실패: {str(e)}'}), 500

# 클럽 가입
@clubs_bp.route('/<int:club_id>/join', methods=['POST'])
@jwt_required()
def join_club(club_id):
    """클럽 가입"""
    try:
        user_id = int(get_jwt_identity())

        # 클럽 존재 확인
        club = Club.query.get_or_404(club_id)

        # 이미 가입했는지 확인
        existing = ClubMember.query.filter_by(user_id=user_id, club_id=club_id).first()
        if existing:
            return jsonify({'success': False, 'message': '이미 가입한 클럽입니다.'}), 400

        # 가입
        membership = ClubMember(
            user_id=user_id,
            club_id=club_id,
            role='member'
        )
        db.session.add(membership)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '클럽에 가입되었습니다.',
            'club': club.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'클럽 가입 실패: {str(e)}'}), 500

# 클럽 탈퇴
@clubs_bp.route('/<int:club_id>/leave', methods=['POST'])
@jwt_required()
def leave_club(club_id):
    """클럽 탈퇴"""
    try:
        user_id = int(get_jwt_identity())

        membership = ClubMember.query.filter_by(user_id=user_id, club_id=club_id).first()
        if not membership:
            return jsonify({'success': False, 'message': '가입하지 않은 클럽입니다.'}), 400

        # owner는 탈퇴 불가 (다른 owner에게 권한 이전 필요)
        if membership.role == 'owner':
            return jsonify({'success': False, 'message': '클럽 소유자는 탈퇴할 수 없습니다. 먼저 소유권을 이전해주세요.'}), 400

        db.session.delete(membership)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '클럽에서 탈퇴했습니다.'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'클럽 탈퇴 실패: {str(e)}'}), 500

# 현재 선택된 클럽 설정 (JWT에 포함하거나 별도 저장)
@clubs_bp.route('/<int:club_id>/select', methods=['POST'])
@jwt_required()
def select_club(club_id):
    """현재 사용할 클럽 선택"""
    try:
        user_id = int(get_jwt_identity())

        # 가입 여부 확인
        membership = ClubMember.query.filter_by(user_id=user_id, club_id=club_id).first()
        if not membership:
            return jsonify({'success': False, 'message': '가입하지 않은 클럽입니다.'}), 403

        # 클럽 정보 반환 (프론트엔드에서 localStorage에 저장)
        club = Club.query.get_or_404(club_id)
        club_data = club.to_dict()
        club_data['role'] = membership.role

        return jsonify({
            'success': True,
            'message': '클럽이 선택되었습니다.',
            'club': club_data
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'클럽 선택 실패: {str(e)}'}), 500
```

### 3.2 기존 API에 클럽 필터링 추가

모든 API 엔드포인트에서:

1. 요청 헤더에서 `X-Club-Id` 읽기
2. 사용자가 해당 클럽에 가입했는지 확인
3. 클럽별 데이터 필터링
4. 권한 확인 (클럽별 역할 사용)

예시 (`backend/blueprints/members.py` 수정):

```python
def get_current_club_id():
    """현재 선택된 클럽 ID 가져오기"""
    club_id = request.headers.get('X-Club-Id')
    if club_id:
        try:
            return int(club_id)
        except:
            return None
    return None

def require_club_membership(user_id, club_id):
    """클럽 가입 여부 확인"""
    if not club_id:
        return False, '클럽이 선택되지 않았습니다.'

    membership = ClubMember.query.filter_by(user_id=user_id, club_id=club_id).first()
    if not membership:
        return False, '가입하지 않은 클럽입니다.'

    return True, membership

@members_bp.route('/', methods=['GET'])
@jwt_required(optional=True)
def get_members():
    """회원 목록 조회 API (클럽별)"""
    try:
        user_id = get_jwt_identity()
        current_user_obj = User.query.get(int(user_id)) if user_id else None

        # 클럽 ID 가져오기
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400

        # 클럽 가입 확인
        if user_id:
            is_member, membership = require_club_membership(int(user_id), club_id)
            if not is_member:
                return jsonify({'success': False, 'message': membership}), 403

        # 클럽별 회원 조회
        members = Member.query.filter_by(
            club_id=club_id,
            is_deleted=False
        ).order_by(Member.name.asc()).all()

        # ... 나머지 코드 (개인정보 마스킹 등)
```

---

## 4단계: 프론트엔드 구현

### 4.1 ClubContext 생성

`frontend/src/contexts/ClubContext.js` 파일 생성:

```javascript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { clubAPI } from '../services/api';

const ClubContext = createContext();

export const useClub = () => {
  const context = useContext(ClubContext);
  if (!context) {
    throw new Error('useClub must be used within a ClubProvider');
  }
  return context;
};

export const ClubProvider = ({ children }) => {
  const [clubs, setClubs] = useState([]);
  const [currentClub, setCurrentClub] = useState(null);
  const [loading, setLoading] = useState(true);

  // 클럽 목록 로드
  const loadClubs = async () => {
    try {
      const response = await clubAPI.getUserClubs();
      if (response.data.success) {
        setClubs(response.data.clubs);

        // 저장된 클럽이 있으면 선택
        const savedClubId = localStorage.getItem('currentClubId');
        if (savedClubId) {
          const savedClub = response.data.clubs.find(
            (c) => c.id === parseInt(savedClubId)
          );
          if (savedClub) {
            setCurrentClub(savedClub);
          }
        } else if (response.data.clubs.length > 0) {
          // 첫 번째 클럽을 기본으로 선택
          selectClub(response.data.clubs[0].id);
        }
      }
    } catch (error) {
      console.error('클럽 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 클럽 선택
  const selectClub = async (clubId) => {
    try {
      const response = await clubAPI.selectClub(clubId);
      if (response.data.success) {
        setCurrentClub(response.data.club);
        localStorage.setItem('currentClubId', clubId.toString());

        // 페이지 새로고침하여 클럽별 데이터 로드
        window.location.reload();
      }
    } catch (error) {
      console.error('클럽 선택 실패:', error);
    }
  };

  // 클럽 생성
  const createClub = async (clubData) => {
    try {
      const response = await clubAPI.createClub(clubData);
      if (response.data.success) {
        await loadClubs();
        await selectClub(response.data.club.id);
        return { success: true, message: response.data.message };
      }
      return { success: false, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || '클럽 생성에 실패했습니다.',
      };
    }
  };

  // 클럽 가입
  const joinClub = async (clubId) => {
    try {
      const response = await clubAPI.joinClub(clubId);
      if (response.data.success) {
        await loadClubs();
        return { success: true, message: response.data.message };
      }
      return { success: false, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || '클럽 가입에 실패했습니다.',
      };
    }
  };

  useEffect(() => {
    loadClubs();
  }, []);

  const value = {
    clubs,
    currentClub,
    loading,
    selectClub,
    createClub,
    joinClub,
    loadClubs,
    isAdmin: currentClub?.role === 'admin' || currentClub?.role === 'owner',
    isOwner: currentClub?.role === 'owner',
  };

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
};
```

### 4.2 API 서비스에 클럽 헤더 추가

`frontend/src/services/api.js` 수정:

```javascript
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// 요청 인터셉터: 클럽 ID 헤더 추가
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 현재 선택된 클럽 ID 추가
    const currentClubId = localStorage.getItem('currentClubId');
    if (currentClubId) {
      config.headers['X-Club-Id'] = currentClubId;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ... 기존 코드 ...

export const clubAPI = {
  getUserClubs: () => api.get('/api/clubs'),
  createClub: (data) => api.post('/api/clubs', data),
  getClub: (clubId) => api.get(`/api/clubs/${clubId}`),
  joinClub: (clubId) => api.post(`/api/clubs/${clubId}/join`),
  leaveClub: (clubId) => api.post(`/api/clubs/${clubId}/leave`),
  selectClub: (clubId) => api.post(`/api/clubs/${clubId}/select`),
};
```

### 4.3 클럽 선택 UI 컴포넌트

`frontend/src/components/ClubSelector.js` 파일 생성:

```javascript
import React, { useState } from 'react';
import { useClub } from '../contexts/ClubContext';
import './ClubSelector.css';

const ClubSelector = () => {
  const { clubs, currentClub, selectClub, loading } = useClub();
  const [isOpen, setIsOpen] = useState(false);

  if (loading || !currentClub) {
    return <div className="club-selector-loading">로딩 중...</div>;
  }

  return (
    <div className="club-selector">
      <button
        className="club-selector-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="club-name">{currentClub.name}</span>
        <span className="club-role">
          {currentClub.role === 'owner'
            ? '소유자'
            : currentClub.role === 'admin'
            ? '운영진'
            : '회원'}
        </span>
        <span className="dropdown-arrow">▼</span>
      </button>

      {isOpen && (
        <div className="club-dropdown">
          {clubs.map((club) => (
            <div
              key={club.id}
              className={`club-item ${
                club.id === currentClub.id ? 'active' : ''
              }`}
              onClick={() => {
                selectClub(club.id);
                setIsOpen(false);
              }}
            >
              <div className="club-item-name">{club.name}</div>
              <div className="club-item-role">
                {club.role === 'owner'
                  ? '소유자'
                  : club.role === 'admin'
                  ? '운영진'
                  : '회원'}
              </div>
            </div>
          ))}
          <div className="club-item-divider"></div>
          <div
            className="club-item"
            onClick={() => {
              /* 클럽 생성 모달 열기 */
            }}
          >
            + 새 클럽 만들기
          </div>
        </div>
      )}
    </div>
  );
};

export default ClubSelector;
```

### 4.4 App.js에 ClubProvider 추가

`frontend/src/App.js` 수정:

```javascript
import { AuthProvider } from './contexts/AuthContext';
import { ClubProvider } from './contexts/ClubContext';
import ClubSelector from './components/ClubSelector';

function App() {
  return (
    <AuthProvider>
      <ClubProvider>
        <div className="App">
          <header>
            <ClubSelector />
            {/* 기존 Navbar 등 */}
          </header>
          {/* 기존 라우팅 */}
        </div>
      </ClubProvider>
    </AuthProvider>
  );
}
```

---

## 5단계: 포인트 시스템 선택적 활성화

### 5.1 포인트 API 수정

`backend/blueprints/points.py` 수정:

```python
@points_bp.route('/', methods=['GET'])
@jwt_required(optional=True)
def get_points():
    """포인트 내역 조회 API"""
    try:
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400

        # 클럽의 포인트 시스템 활성화 여부 확인
        club = Club.query.get_or_404(club_id)
        if not club.is_points_enabled:
            return jsonify({
                'success': False,
                'message': '이 클럽은 포인트 시스템을 사용하지 않습니다.',
                'is_points_enabled': False
            }), 400

        # ... 나머지 포인트 조회 로직
```

---

## 6단계: 구현 체크리스트

### 백엔드

- [ ] Club, ClubMember 모델 추가
- [ ] 기존 모델에 club_id 추가
- [ ] 마이그레이션 스크립트 작성 및 실행
- [ ] clubs.py Blueprint 생성
- [ ] 기존 API에 클럽 필터링 추가
- [ ] 클럽별 권한 체크 함수 추가
- [ ] 포인트 시스템 활성화 체크 추가

### 프론트엔드

- [ ] ClubContext 생성
- [ ] ClubSelector 컴포넌트 생성
- [ ] API 서비스에 X-Club-Id 헤더 추가
- [ ] App.js에 ClubProvider 추가
- [ ] 클럽 생성/가입 페이지 생성
- [ ] Navbar에 ClubSelector 추가

### 테스트

- [ ] 기본 클럽 생성 및 데이터 마이그레이션 테스트
- [ ] 클럽 생성/가입/탈퇴 테스트
- [ ] 클럽별 데이터 격리 테스트
- [ ] 클럽별 역할 권한 테스트
- [ ] 포인트 시스템 활성화/비활성화 테스트

---

## 주의사항

1. **데이터 마이그레이션**: 기존 데이터를 안전하게 마이그레이션해야 합니다.
2. **하위 호환성**: 기존 사용자들이 기본 클럽에 자동 가입되도록 해야 합니다.
3. **성능**: 클럽별 인덱스 추가를 고려하세요 (`club_id`에 인덱스).
4. **보안**: 클럽별 데이터 접근 권한을 철저히 체크해야 합니다.

---

## 다음 단계

구현이 완료되면:

1. 클럽 검색 기능 추가
2. 클럽 초대 기능 추가
3. 클럽 통계 대시보드 추가
4. 클럽 설정 페이지 추가
