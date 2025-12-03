from flask import Blueprint, request, jsonify, make_response
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Club, ClubMember, User
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
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization,X-Requested-With,X-Club-Id")
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
            # 슈퍼관리자는 모든 클럽 조회
            all_clubs = Club.query.order_by(Club.name.asc()).all()
            clubs_data = []
            for club in all_clubs:
                club_data = club.to_dict()
                # 가입 여부 확인
                membership = ClubMember.query.filter_by(user_id=user_id, club_id=club.id).first()
                if membership:
                    club_data['role'] = membership.role
                    club_data['joined_at'] = membership.joined_at.strftime('%Y-%m-%d %H:%M:%S') if membership.joined_at else None
                else:
                    club_data['role'] = None  # 가입하지 않은 클럽
                    club_data['joined_at'] = None
                clubs_data.append(club_data)
        else:
            # 일반 사용자는 가입한 클럽만 조회
            memberships = ClubMember.query.filter_by(user_id=user_id).all()
            clubs_data = []
            for membership in memberships:
                club_data = membership.club.to_dict()
                club_data['role'] = membership.role
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
        
        # 클럽 정보 반환 (프론트엔드에서 localStorage에 저장)
        club_data = club.to_dict()
        if membership:
            club_data['role'] = membership.role
        else:
            # 슈퍼관리자가 가입하지 않은 클럽을 선택한 경우
            club_data['role'] = None  # 슈퍼관리자 권한으로 표시
        
        return jsonify({
            'success': True,
            'message': '클럽이 선택되었습니다.',
            'club': club_data
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'클럽 선택 실패: {str(e)}'}), 500

