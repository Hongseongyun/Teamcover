from flask import Blueprint, request, jsonify, make_response
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import (
    db,
    Club,
    ClubMember,
    User,
    Member,
    Score,
    Point,
    Payment,
    Post,
    FundState,
    FundLedger,
)
from datetime import datetime

clubs_bp = Blueprint('clubs', __name__, url_prefix='/api/clubs')

@clubs_bp.before_request
def handle_preflight():
    """OPTIONS 요청 처리 (CORS 프리플라이트)"""
    if request.method == "OPTIONS":
        response = make_response()
        response.status_code = 200
        from flask import current_app
        allowed_origins = current_app.config.get('CORS_ALLOWED_ORIGINS', [
            "http://localhost:3000",
            "http://localhost:8080",
            "https://hsyun.store",
            "https://www.hsyun.store",
            "https://teamcover-frontend.vercel.app"
        ])
        request_origin = request.headers.get('Origin')
        if request_origin:
            if request_origin in allowed_origins:
                response.headers.add("Access-Control-Allow-Origin", request_origin)
            else:
                # 개발 환경에서는 모든 origin 허용
                response.headers.add("Access-Control-Allow-Origin", request_origin)
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization,X-Requested-With,X-Club-Id,X-Privacy-Token")
        response.headers.add('Access-Control-Allow-Methods', "GET,PUT,POST,DELETE,OPTIONS")
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Access-Control-Max-Age', '3600')
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

# 모든 클럽 목록 조회 (회원가입용 - 가입 여부와 관계없이)
@clubs_bp.route('/public', methods=['GET'])
def get_all_clubs():
    """회원가입 시 선택할 수 있는 모든 클럽 목록 조회 (인증 불필요)"""
    try:
        clubs = Club.query.order_by(Club.name.asc()).all()
        clubs_data = [club.to_dict() for club in clubs]
        
        return jsonify({
            'success': True,
            'clubs': clubs_data
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'클럽 목록 조회 실패: {str(e)}'}), 500

# 클럽 목록 조회 (사용자가 가입한 클럽)
@clubs_bp.route('/', methods=['GET'])
@jwt_required()
def get_user_clubs():
    """사용자가 가입한 클럽 목록 조회 (슈퍼관리자는 모든 클럽 조회)"""
    try:
        user_id = int(get_jwt_identity())
        current_user = User.query.get(user_id)
        is_super_admin = current_user and current_user.role == 'super_admin'
        
        if is_super_admin:
            # 슈퍼관리자는 모든 클럽 조회 (승인 여부와 관계없이)
            all_clubs = Club.query.order_by(Club.name.asc()).all()
            clubs_data = []
            for club in all_clubs:
                club_data = club.to_dict()
                # 가입 여부 확인
                membership = ClubMember.query.filter_by(user_id=user_id, club_id=club.id).first()
                if membership:
                    club_data['role'] = membership.role
                    club_data['status'] = membership.status
                    club_data['joined_at'] = membership.joined_at.strftime('%Y-%m-%d %H:%M:%S') if membership.joined_at else None
                else:
                    club_data['role'] = None  # 가입하지 않은 클럽
                    club_data['status'] = None
                    club_data['joined_at'] = None
                clubs_data.append(club_data)
        else:
            # 일반 사용자는 승인된 클럽만 조회
            memberships = ClubMember.query.filter_by(
                user_id=user_id,
                status='approved'
            ).all()
            clubs_data = []
            for membership in memberships:
                club_data = membership.club.to_dict()
                club_data['role'] = membership.role
                club_data['status'] = membership.status
                club_data['joined_at'] = membership.joined_at.strftime('%Y-%m-%d %H:%M:%S') if membership.joined_at else None
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
        
        # 사용자 정보 확인
        current_user = User.query.get(user_id)
        is_super_admin = current_user and current_user.role == 'super_admin'
        
        # 가입 여부 확인 (슈퍼관리자는 가입하지 않아도 선택 가능)
        membership = ClubMember.query.filter_by(user_id=user_id, club_id=club_id).first()
        if not membership and not is_super_admin:
            return jsonify({'success': False, 'message': '가입하지 않은 클럽입니다.'}), 403
        
        club_data = club.to_dict()
        if membership:
            club_data['role'] = membership.role
        else:
            # 슈퍼관리자가 가입하지 않은 클럽을 선택한 경우
            club_data['role'] = 'super_admin'  # 슈퍼관리자 권한으로 표시
        
        return jsonify({
            'success': True,
            'club': club_data
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'클럽 조회 실패: {str(e)}'}), 500

# 클럽 가입
@clubs_bp.route('/available', methods=['GET'])
@jwt_required(optional=True)
def get_available_clubs():
    """가입 가능한 클럽 목록 조회 (회원가입 시 클럽 선택용)"""
    try:
        clubs = Club.query.all()
        clubs_data = [club.to_dict() for club in clubs]
        
        return jsonify({
            'success': True,
            'clubs': clubs_data
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'클럽 목록 조회 실패: {str(e)}'}), 500

@clubs_bp.route('/select-after-signup', methods=['POST'])
def select_club_after_signup():
    """구글 로그인 후 클럽 선택 및 가입 처리"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        club_id = data.get('club_id')
        email = data.get('email')
        
        if not user_id or not club_id or not email:
            return jsonify({'success': False, 'message': '필수 정보가 누락되었습니다.'}), 400
        
        # 사용자 확인
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다.'}), 404
        
        # 이메일 확인 (보안)
        if user.email != email:
            return jsonify({'success': False, 'message': '이메일이 일치하지 않습니다.'}), 403
        
        # 클럽 존재 확인
        club = Club.query.get_or_404(club_id)
        
        # 이미 가입했는지 확인
        existing = ClubMember.query.filter_by(user_id=user_id, club_id=club_id).first()
        if existing:
            return jsonify({'success': False, 'message': '이미 가입한 클럽입니다.'}), 400
        
        # 슈퍼관리자는 즉시 승인, 일반 회원은 승인 대기
        is_super_admin = user.role == 'super_admin'
        
        if is_super_admin:
            membership = ClubMember(
                user_id=user_id,
                club_id=club_id,
                role='member',
                status='approved',
                requested_at=datetime.utcnow(),
                approved_at=datetime.utcnow(),
                approved_by=user_id
            )
        else:
            membership = ClubMember(
                user_id=user_id,
                club_id=club_id,
                role='member',
                status='pending',
                requested_at=datetime.utcnow()
            )
        
        db.session.add(membership)
        db.session.commit()
        
        # 로그인 처리
        from flask_login import login_user
        login_user(user, remember=True)
        user.last_login = datetime.utcnow()
        
        # JWT 토큰 생성
        from flask_jwt_extended import create_access_token
        from datetime import timedelta
        import uuid
        jti = str(uuid.uuid4())
        access_token = create_access_token(
            identity=str(user.id),
            expires_delta=timedelta(days=7),
            additional_claims={"jti": jti}
        )
        
        # 새 토큰의 jti를 활성 토큰으로 저장
        user.active_token = jti
        db.session.commit()
        
        # 클럽 정보와 멤버십 상태 포함
        club_data = club.to_dict()
        club_data['membership_status'] = membership.status
        
        return jsonify({
            'success': True,
            'message': '클럽이 선택되었습니다.' if is_super_admin else '클럽 가입 요청이 제출되었습니다. 승인을 기다려주세요.',
            'user': user.to_dict(),
            'access_token': access_token,
            'club': club_data
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'클럽 선택 실패: {str(e)}'}), 500

@clubs_bp.route('/<int:club_id>/join', methods=['POST'])
@jwt_required()
def join_club(club_id):
    """클럽 가입 요청 (승인 대기 상태)"""
    try:
        user_id = int(get_jwt_identity())
        current_user = User.query.get(user_id)
        
        # 슈퍼관리자는 즉시 가입
        is_super_admin = current_user and current_user.role == 'super_admin'
        
        # 클럽 존재 확인
        club = Club.query.get_or_404(club_id)
        
        # 이미 가입했는지 확인
        existing = ClubMember.query.filter_by(user_id=user_id, club_id=club_id).first()
        if existing:
            if existing.status == 'approved':
                return jsonify({'success': False, 'message': '이미 가입한 클럽입니다.'}), 400
            elif existing.status == 'pending':
                return jsonify({'success': False, 'message': '이미 가입 요청이 대기 중입니다.'}), 400
            elif existing.status == 'rejected':
                # 거부된 경우 다시 요청 가능
                existing.status = 'pending'
                existing.requested_at = datetime.utcnow()
                existing.approved_at = None
                existing.approved_by = None
                db.session.commit()
                return jsonify({
                    'success': True,
                    'message': '클럽 가입 요청이 다시 제출되었습니다. 승인을 기다려주세요.',
                    'club': club.to_dict()
                })
        
        # 가입 요청 생성
        if is_super_admin:
            # 슈퍼관리자는 즉시 승인
            membership = ClubMember(
                user_id=user_id,
                club_id=club_id,
                role='member',
                status='approved',
                requested_at=datetime.utcnow(),
                approved_at=datetime.utcnow(),
                approved_by=user_id
            )
            message = '클럽에 가입되었습니다.'
        else:
            # 일반 회원은 승인 대기
            membership = ClubMember(
                user_id=user_id,
                club_id=club_id,
                role='member',
                status='pending',
                requested_at=datetime.utcnow()
            )
            message = '클럽 가입 요청이 제출되었습니다. 슈퍼관리자의 승인을 기다려주세요.'
        
        db.session.add(membership)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': message,
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

# 클럽에서 사용자 강제 탈퇴 (슈퍼관리자 전용)
@clubs_bp.route('/<int:club_id>/members/<int:user_id>/remove', methods=['POST'])
@jwt_required()
def remove_member_from_club(club_id, user_id):
    """클럽에서 사용자 강제 탈퇴 (슈퍼관리자만 가능)"""
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)
        
        if not current_user or current_user.role != 'super_admin':
            return jsonify({'success': False, 'message': '권한이 없습니다.'}), 403
        
        membership = ClubMember.query.filter_by(user_id=user_id, club_id=club_id).first()
        if not membership:
            return jsonify({'success': False, 'message': '해당 클럽에 가입된 사용자가 아닙니다.'}), 404
        
        # owner는 탈퇴 불가 (다른 owner에게 권한 이전 필요)
        if membership.role == 'owner':
            return jsonify({'success': False, 'message': '클럽 소유자는 탈퇴시킬 수 없습니다. 먼저 소유권을 이전해주세요.'}), 400
        
        user_name = membership.user.name if membership.user else 'Unknown'
        club_name = membership.club.name if membership.club else 'Unknown'
        
        db.session.delete(membership)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'{user_name}님을 {club_name}에서 탈퇴시켰습니다.'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'클럽에서 탈퇴시키는데 실패했습니다: {str(e)}'}), 500

# 클럽 설명 수정
@clubs_bp.route('/<int:club_id>/description', methods=['PUT'])
@jwt_required()
def update_club_description(club_id):
    """
    클럽 설명 수정
    - 운영진(admin/owner): 자신이 속한 클럽만 설명 수정 가능
    - 슈퍼관리자: 모든 클럽의 설명 수정 가능
    """
    try:
        user_id = int(get_jwt_identity())
        current_user = User.query.get(user_id)
        if not current_user:
            return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다.'}), 401

        is_super_admin = current_user.role == 'super_admin'

        # 클럽 존재 확인
        club = Club.query.get_or_404(club_id)

        # 권한 확인: 슈퍼관리자가 아니면 해당 클럽의 admin 이상만 수정 가능
        if not is_super_admin:
            role = get_user_club_role(user_id, club_id)
            if role not in ['admin', 'owner']:
                return jsonify({
                    'success': False,
                    'message': '클럽 설명을 수정할 권한이 없습니다.'
                }), 403

        data = request.get_json() or {}
        description = (data.get('description') or '').strip()

        # 설명 길이 제한 (너무 긴 입력 방지)
        if len(description) > 2000:
            return jsonify({
                'success': False,
                'message': '클럽 설명은 2000자 이내로 입력해주세요.'
            }), 400

        club.description = description or None
        club.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '클럽 설명이 업데이트되었습니다.',
            'club': club.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'클럽 설명 수정 실패: {str(e)}'}), 500

# 클럽 삭제 (슈퍼관리자 전용)
@clubs_bp.route('/<int:club_id>', methods=['DELETE'])
@jwt_required()
def delete_club(club_id):
    """클럽 전체 삭제 (슈퍼관리자만 가능)"""
    try:
        user_id = int(get_jwt_identity())
        current_user = User.query.get(user_id)
        if not current_user or current_user.role != 'super_admin':
            return jsonify({'success': False, 'message': '클럽을 삭제할 권한이 없습니다.'}), 403

        # 기본 클럽(예: Teamcover, id=1)은 보호 (원하지 않으면 이 조건 제거 가능)
        if club_id == 1:
            return jsonify({'success': False, 'message': '기본 클럽은 삭제할 수 없습니다.'}), 400

        club = Club.query.get_or_404(club_id)

        # 연관된 데이터 삭제 (클럽 단위로 정리)
        # 회원, 점수, 포인트, 납입, 게시글, 기금 상태/장부, 클럽 멤버십
        Member.query.filter_by(club_id=club_id).delete(synchronize_session=False)
        Score.query.filter_by(club_id=club_id).delete(synchronize_session=False)
        Point.query.filter_by(club_id=club_id).delete(synchronize_session=False)
        Payment.query.filter_by(club_id=club_id).delete(synchronize_session=False)
        Post.query.filter_by(club_id=club_id).delete(synchronize_session=False)
        FundState.query.filter_by(club_id=club_id).delete(synchronize_session=False)
        FundLedger.query.filter_by(club_id=club_id).delete(synchronize_session=False)
        ClubMember.query.filter_by(club_id=club_id).delete(synchronize_session=False)

        db.session.delete(club)
        db.session.commit()

        return jsonify({'success': True, 'message': '클럽이 삭제되었습니다.'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'클럽 삭제 실패: {str(e)}'}), 500

# 현재 선택된 클럽 설정
@clubs_bp.route('/<int:club_id>/select', methods=['POST'])
@jwt_required()
def select_club(club_id):
    """현재 사용할 클럽 선택 (슈퍼관리자는 가입하지 않은 클럽도 선택 가능)"""
    try:
        user_id = int(get_jwt_identity())
        current_user = User.query.get(user_id)
        is_super_admin = current_user and current_user.role == 'super_admin'
        
        # 클럽 존재 확인
        club = Club.query.get_or_404(club_id)
        
        # 가입 여부 확인 (슈퍼관리자는 가입하지 않아도 선택 가능)
        membership = ClubMember.query.filter_by(user_id=user_id, club_id=club_id).first()
        if not membership and not is_super_admin:
            return jsonify({'success': False, 'message': '가입하지 않은 클럽입니다.'}), 403
        
        # 일반 사용자는 승인된 클럽만 선택 가능
        if membership and not is_super_admin:
            if membership.status != 'approved':
                return jsonify({'success': False, 'message': '승인 대기 중인 클럽입니다. 승인을 기다려주세요.'}), 403
        
        # 클럽 정보 반환 (프론트엔드에서 localStorage에 저장)
        club_data = club.to_dict()
        if membership:
            club_data['role'] = membership.role
            club_data['status'] = membership.status
        else:
            # 슈퍼관리자가 가입하지 않은 클럽을 선택한 경우
            club_data['role'] = None  # 슈퍼관리자 권한으로 표시
            club_data['status'] = None
        
        return jsonify({
            'success': True,
            'message': '클럽이 선택되었습니다.',
            'club': club_data
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'클럽 선택 실패: {str(e)}'}), 500


# 특정 사용자의 클럽 내 역할 변경 (슈퍼관리자 전용)
@clubs_bp.route('/<int:club_id>/users', methods=['GET'])
@jwt_required()
def get_club_users(club_id):
    """클럽에 가입한 모든 사용자(User) 목록 조회"""
    try:
        user_id = int(get_jwt_identity())
        current_user = User.query.get(user_id)
        
        # 클럽 존재 확인
        club = Club.query.get_or_404(club_id)
        
        # 슈퍼관리자이거나 해당 클럽의 승인된 멤버인지 확인
        is_super_admin = current_user and current_user.role == 'super_admin'
        if not is_super_admin:
            membership = ClubMember.query.filter_by(
                user_id=user_id, club_id=club_id, status='approved'
            ).first()
            if not membership:
                return jsonify({'success': False, 'message': '클럽에 가입하지 않았습니다.'}), 403
        
        # 클럽에 가입한 모든 승인된 회원 조회
        memberships = ClubMember.query.filter_by(
            club_id=club_id, status='approved'
        ).all()
        
        users_data = []
        for membership in memberships:
            user = User.query.get(membership.user_id)
            if user:
                # 일반 사용자가 조회할 때는 슈퍼관리자 제외
                if not is_super_admin and user.role == 'super_admin':
                    continue
                users_data.append({
                    'id': user.id,
                    'name': user.name,
                    'email': user.email,
                    'role': membership.role,
                    'user_role': user.role,  # User의 role도 포함
                })
        
        return jsonify({
            'success': True,
            'users': users_data
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'회원 목록 조회 실패: {str(e)}'}), 500

@clubs_bp.route('/<int:club_id>/members/<int:user_id>/role', methods=['PUT'])
@jwt_required()
def update_club_member_role(club_id, user_id):
    """
    클럽 멤버 역할 변경
    - 슈퍼관리자만 가능 (여러 클럽에 속한 사용자의 클럽별 직책을 개별적으로 관리하기 위해)
    """
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)

        if not current_user or current_user.role != 'super_admin':
            return jsonify({'success': False, 'message': '권한이 없습니다.'}), 403

        data = request.get_json() or {}
        new_role = (data.get('role') or '').strip()

        if new_role not in ['member', 'admin', 'owner']:
            return jsonify({'success': False, 'message': '유효하지 않은 역할입니다.'}), 400

        membership = ClubMember.query.filter_by(user_id=user_id, club_id=club_id).first()
        if not membership:
            return jsonify({'success': False, 'message': '해당 클럽에 가입된 사용자가 아닙니다.'}), 404

        # owner를 해제할 때 마지막 owner인지 확인 (선택 사항이지만 안전장치로 유지)
        if membership.role == 'owner' and new_role != 'owner':
            other_owners = ClubMember.query.filter_by(club_id=club_id, role='owner').filter(
                ClubMember.user_id != user_id
            ).count()
            if other_owners == 0:
                return jsonify({
                    'success': False,
                    'message': '마지막 소유자의 역할은 변경할 수 없습니다. 다른 소유자를 먼저 지정해주세요.'
                }), 400

        membership.role = new_role
        membership.joined_at = membership.joined_at or datetime.utcnow()

        db.session.commit()

        return jsonify({
            'success': True,
            'message': '클럽 내 역할이 변경되었습니다.',
            'membership': {
                'user_id': membership.user_id,
                'club_id': membership.club_id,
                'role': membership.role,
            },
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'클럽 역할 변경 실패: {str(e)}'}), 500

# 승인 대기 중인 클럽 가입 요청 목록 조회 (슈퍼관리자 전용)
@clubs_bp.route('/join-requests', methods=['GET'])
@jwt_required()
def get_join_requests():
    """승인 대기 중인 클럽 가입 요청 목록 조회"""
    try:
        user_id = int(get_jwt_identity())
        current_user = User.query.get(user_id)
        
        if not current_user or current_user.role != 'super_admin':
            return jsonify({'success': False, 'message': '권한이 없습니다.'}), 403
        
        # 승인 대기 중인 요청 조회
        pending_requests = ClubMember.query.filter_by(status='pending').order_by(
            ClubMember.requested_at.asc()
        ).all()
        
        # 클럽별로 그룹화
        requests_by_club = {}
        for request in pending_requests:
            club_id = request.club_id
            if club_id not in requests_by_club:
                requests_by_club[club_id] = {
                    'club': request.club.to_dict(),
                    'requests': []
                }
            requests_by_club[club_id]['requests'].append({
                'id': request.id,
                'user_id': request.user_id,
                'user_name': request.user.name if request.user else None,
                'user_email': request.user.email if request.user else None,
                'requested_at': request.requested_at.strftime('%Y-%m-%d %H:%M:%S') if request.requested_at else None,
                'status': request.status
            })
        
        return jsonify({
            'success': True,
            'requests_by_club': requests_by_club,
            'total_count': len(pending_requests)
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'가입 요청 목록 조회 실패: {str(e)}'}), 500

# 승인 대기 중인 클럽 가입 요청 개수 조회 (슈퍼관리자 전용)
@clubs_bp.route('/join-requests/count', methods=['GET'])
@jwt_required()
def get_join_requests_count():
    """승인 대기 중인 클럽 가입 요청 개수 조회"""
    try:
        user_id = int(get_jwt_identity())
        current_user = User.query.get(user_id)
        
        if not current_user or current_user.role != 'super_admin':
            return jsonify({'success': False, 'message': '권한이 없습니다.'}), 403
        
        # 승인 대기 중인 요청 개수 조회
        count = ClubMember.query.filter_by(status='pending').count()
        
        return jsonify({
            'success': True,
            'count': count
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'가입 요청 개수 조회 실패: {str(e)}'}), 500

# 클럽 가입 요청 승인/거부 (슈퍼관리자 전용)
@clubs_bp.route('/join-requests/<int:request_id>/approve', methods=['POST'])
@jwt_required()
def approve_join_request(request_id):
    """클럽 가입 요청 승인"""
    try:
        user_id = int(get_jwt_identity())
        current_user = User.query.get(user_id)
        
        if not current_user or current_user.role != 'super_admin':
            return jsonify({'success': False, 'message': '권한이 없습니다.'}), 403
        
        # 가입 요청 조회
        membership = ClubMember.query.get_or_404(request_id)
        
        if membership.status != 'pending':
            return jsonify({'success': False, 'message': '승인 대기 중인 요청이 아닙니다.'}), 400
        
        # 승인 처리
        membership.status = 'approved'
        membership.approved_at = datetime.utcnow()
        membership.approved_by = user_id
        if not membership.joined_at:
            membership.joined_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '클럽 가입 요청이 승인되었습니다.',
            'membership': membership.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'가입 요청 승인 실패: {str(e)}'}), 500

# 클럽 가입 요청 거부 (슈퍼관리자 전용)
@clubs_bp.route('/join-requests/<int:request_id>/reject', methods=['POST'])
@jwt_required()
def reject_join_request(request_id):
    """클럽 가입 요청 거부 (사용자와 멤버십 모두 삭제)"""
    try:
        user_id = int(get_jwt_identity())
        current_user = User.query.get(user_id)
        
        if not current_user or current_user.role != 'super_admin':
            return jsonify({'success': False, 'message': '권한이 없습니다.'}), 403
        
        # 가입 요청 조회
        membership = ClubMember.query.get_or_404(request_id)
        
        if membership.status != 'pending':
            return jsonify({'success': False, 'message': '승인 대기 중인 요청이 아닙니다.'}), 400
        
        # 승인 요청 상태는 가입한 상태가 아니므로, 거부 시 사용자와 멤버십 모두 삭제
        request_user_id = membership.user_id
        request_user = User.query.get(request_user_id)
        
        # 해당 사용자의 모든 클럽 멤버십 확인 (승인된 것이 있는지)
        all_memberships = ClubMember.query.filter_by(user_id=request_user_id).all()
        approved_memberships = [m for m in all_memberships if m.status == 'approved']
        
        # 승인된 멤버십이 없으면 사용자 삭제 (승인 요청만 있었던 경우)
        if not approved_memberships:
            # 모든 멤버십 삭제
            for m in all_memberships:
                db.session.delete(m)
            # 사용자 삭제
            if request_user:
                db.session.delete(request_user)
        else:
            # 승인된 멤버십이 있으면 해당 멤버십만 삭제
            db.session.delete(membership)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '클럽 가입 요청이 거부되었습니다.'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'가입 요청 거부 실패: {str(e)}'}), 500

# ========== 클럽 홍보 페이지 관련 API ==========

# 모든 클럽 목록 조회 (홍보 페이지용 - 공개)
@clubs_bp.route('/promotion', methods=['GET'])
def get_promotion_clubs():
    """홍보 페이지용 클럽 목록 조회 (공개)"""
    try:
        clubs = Club.query.all()
        clubs_data = []
        
        for club in clubs:
            # 회원 수 계산
            member_count = db.session.query(db.func.count(ClubMember.id)).filter(
                ClubMember.club_id == club.id,
                ClubMember.status == 'approved'
            ).scalar() or 0
            
            # 해시태그에서 지역과 상주볼링장 추출
            hashtags = club.hashtags if club.hashtags else []
            region = None
            bowling_alley = None
            
            for tag in hashtags:
                if isinstance(tag, str):
                    # #제거하고 공백 제거
                    clean_tag = tag.replace('#', '').strip()
                    # 지역 추출 (예: #서울, #부산 등)
                    if not region and any(keyword in clean_tag for keyword in ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']):
                        region = clean_tag
                    # 상주볼링장 추출
                    if not bowling_alley and ('볼링장' in clean_tag or '앵커스' in clean_tag or '볼링' in clean_tag):
                        bowling_alley = clean_tag
            
            clubs_data.append({
                'id': club.id,
                'name': club.name,
                'description': club.description,  # 간단한 설명 (슈퍼관리자 마이페이지에서 관리)
                'image_url': club.image_url,
                'hashtags': hashtags,
                'region': region,
                'bowling_alley': bowling_alley,
                'member_count': member_count
            })
        
        return jsonify({
            'success': True,
            'clubs': clubs_data
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'클럽 목록 조회 실패: {str(e)}'}), 500

# 클럽 상세 정보 조회 (홍보 페이지용 - 공개)
@clubs_bp.route('/promotion/<int:club_id>', methods=['GET'])
@jwt_required(optional=True)
def get_promotion_club_detail(club_id):
    """홍보 페이지용 클럽 상세 정보 조회 (공개)"""
    try:
        club = Club.query.get_or_404(club_id)
        
        # 회원 수 계산
        member_count = db.session.query(db.func.count(ClubMember.id)).filter(
            ClubMember.club_id == club.id,
            ClubMember.status == 'approved'
        ).scalar() or 0
        
        # 현재 사용자의 가입 상태 확인 (로그인한 경우에만)
        user_membership_status = None
        user_membership_role = None
        current_user_id = get_jwt_identity()
        
        if current_user_id:
            user = User.query.get(current_user_id)
            if user:
                membership = ClubMember.query.filter_by(
                    user_id=user.id,
                    club_id=club_id
                ).first()
                if membership:
                    user_membership_status = membership.status
                    user_membership_role = membership.role
        
        return jsonify({
            'success': True,
            'club': {
                'id': club.id,
                'name': club.name,
                'description': club.description,
                'image_url': club.image_url,
                'hashtags': club.hashtags if club.hashtags else [],
                'promotion_description': club.promotion_description,
                'member_count': member_count,
                'user_membership_status': user_membership_status,  # 'pending', 'approved', 'rejected', None
                'user_membership_role': user_membership_role  # 'member', 'admin', 'owner', None
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'클럽 상세 정보 조회 실패: {str(e)}'}), 500

# 클럽 상세 정보 업데이트 (운영진 이상)
@clubs_bp.route('/promotion/<int:club_id>', methods=['PUT'])
@jwt_required()
def update_promotion_club_detail(club_id):
    """클럽 상세 정보 업데이트 (운영진 이상)"""
    try:
        user_id = int(get_jwt_identity())
        current_user = User.query.get(user_id)
        if not current_user:
            return jsonify({'success': False, 'message': '사용자 정보를 찾을 수 없습니다.'}), 401
        
        is_super_admin = current_user.role == 'super_admin'
        
        club = Club.query.get_or_404(club_id)
        
        # 권한 확인: 슈퍼관리자가 아니면 해당 클럽의 admin 이상만 수정 가능
        if not is_super_admin:
            role = get_user_club_role(user_id, club_id)
            if role not in ['admin', 'owner']:
                return jsonify({
                    'success': False,
                    'message': '클럽 정보를 수정할 권한이 없습니다.'
                }), 403
        
        data = request.get_json() or {}
        
        # 이미지 URL 업데이트
        if 'image_url' in data:
            club.image_url = data.get('image_url')
        
        # 상세 설명 업데이트
        if 'promotion_description' in data:
            club.promotion_description = data.get('promotion_description', '').strip()
        
        # 해시태그 업데이트
        if 'hashtags' in data:
            hashtags = data.get('hashtags', [])
            # 해시태그 정규화 (# 제거하고 중복 제거)
            normalized_hashtags = []
            seen = set()
            for tag in hashtags:
                if isinstance(tag, str):
                    clean_tag = tag.replace('#', '').strip()
                    if clean_tag and clean_tag not in seen:
                        normalized_hashtags.append(f"#{clean_tag}")
                        seen.add(clean_tag)
            club.hashtags = normalized_hashtags
        
        club.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '클럽 정보가 업데이트되었습니다.',
            'club': club.to_dict(include_member_count=True)
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'클럽 정보 업데이트 실패: {str(e)}'}), 500

# 클럽 이미지 업로드
@clubs_bp.route('/promotion/<int:club_id>/upload-image', methods=['POST'])
@jwt_required()
def upload_club_image(club_id):
    """클럽 이미지 업로드 (운영진 이상)"""
    try:
        import os
        import uuid
        from werkzeug.utils import secure_filename
        
        user_id = int(get_jwt_identity())
        current_user = User.query.get(user_id)
        if not current_user:
            return jsonify({'success': False, 'message': '사용자 정보를 찾을 수 없습니다.'}), 401
        
        is_super_admin = current_user.role == 'super_admin'
        
        club = Club.query.get_or_404(club_id)
        
        # 권한 확인: 슈퍼관리자가 아니면 해당 클럽의 admin 이상만 수정 가능
        if not is_super_admin:
            role = get_user_club_role(user_id, club_id)
            if role not in ['admin', 'owner']:
                return jsonify({
                    'success': False,
                    'message': '클럽 이미지를 업로드할 권한이 없습니다.'
                }), 403
        
        if 'image' not in request.files:
            return jsonify({'success': False, 'message': '이미지 파일이 없습니다.'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'success': False, 'message': '선택된 파일이 없습니다.'}), 400
        
        # 파일 확장자 확인
        ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
        def allowed_file(filename):
            return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
        
        if not allowed_file(file.filename):
            return jsonify({'success': False, 'message': '허용되지 않은 파일 형식입니다.'}), 400
        
        # 파일 저장
        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4()}_{filename}"
        
        # 업로드 폴더 생성
        UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', 'clubs')
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        
        file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
        file.save(file_path)
        
        # URL 반환
        image_url = f"/uploads/clubs/{unique_filename}"
        
        # 클럽 이미지 URL 업데이트
        club.image_url = image_url
        club.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '이미지가 업로드되었습니다.',
            'url': image_url
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'이미지 업로드 중 오류가 발생했습니다: {str(e)}'}), 500

# 클럽 생성 (슈퍼관리자 전용)
@clubs_bp.route('/promotion', methods=['POST'])
@jwt_required()
def create_promotion_club():
    """클럽 생성 (슈퍼관리자 전용)"""
    try:
        user_id = int(get_jwt_identity())
        current_user = User.query.get(user_id)
        
        if not current_user or current_user.role != 'super_admin':
            return jsonify({'success': False, 'message': '권한이 없습니다.'}), 403
        
        data = request.get_json() or {}
        name = data.get('name', '').strip()
        
        if not name:
            return jsonify({'success': False, 'message': '클럽 이름을 입력해주세요.'}), 400
        
        # 중복 확인
        existing_club = Club.query.filter_by(name=name).first()
        if existing_club:
            return jsonify({'success': False, 'message': '이미 존재하는 클럽 이름입니다.'}), 400
        
        # 새 클럽 생성
        new_club = Club(
            name=name,
            description=data.get('description', '').strip() or None,
            image_url=data.get('image_url'),
            hashtags=data.get('hashtags', []),
            promotion_description=data.get('promotion_description', '').strip() or None,
            created_by=user_id
        )
        
        db.session.add(new_club)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '클럽이 생성되었습니다.',
            'club': new_club.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'클럽 생성 실패: {str(e)}'}), 500