"""
클럽 관련 헬퍼 함수들
기존 API에서 클럽 필터링 및 권한 체크에 사용
"""
from flask import request
from flask_jwt_extended import get_jwt_identity
from models import ClubMember, Club

def get_current_club_id():
    """현재 선택된 클럽 ID 가져오기 (요청 헤더에서)"""
    club_id = request.headers.get('X-Club-Id')
    if club_id:
        try:
            return int(club_id)
        except (ValueError, TypeError):
            return None
    return None

def require_club_membership(user_id, club_id):
    """클럽 가입 여부 확인
    
    Returns:
        tuple: (is_member: bool, membership_or_error_message)
    """
    if not club_id:
        return False, '클럽이 선택되지 않았습니다.'
    
    membership = ClubMember.query.filter_by(
        user_id=user_id, 
        club_id=club_id,
        status='approved'
    ).first()
    if not membership:
        return False, '가입하지 않은 클럽입니다.'
    
    return True, membership

def check_club_permission(user_id, club_id, required_role='member'):
    """클럽 권한 확인
    
    Args:
        user_id: 사용자 ID
        club_id: 클럽 ID
        required_role: 필요한 최소 역할 ('member', 'admin', 'owner')
    
    Returns:
        tuple: (has_permission: bool, membership_or_error_message)
    """
    if not club_id:
        return False, '클럽이 선택되지 않았습니다.'
    
    # status='approved'인 멤버십만 확인
    membership = ClubMember.query.filter_by(
        user_id=user_id, 
        club_id=club_id,
        status='approved'
    ).first()
    
    if not membership:
        return False, '가입하지 않은 클럽이거나 승인되지 않은 클럽입니다.'
    
    role_hierarchy = {'member': 1, 'admin': 2, 'owner': 3}
    user_role_level = role_hierarchy.get(membership.role, 0)
    required_role_level = role_hierarchy.get(required_role, 0)
    
    if user_role_level < required_role_level:
        return False, f'{required_role} 권한이 필요합니다.'
    
    return True, membership

def get_club_or_404(club_id):
    """클럽 조회 (없으면 404)"""
    club = Club.query.get(club_id)
    if not club:
        from flask import abort
        abort(404, description='클럽을 찾을 수 없습니다.')
    return club

