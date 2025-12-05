from flask import Blueprint, request, jsonify, make_response
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from models import db, User, Inquiry

# 문의하기 Blueprint
inquiries_bp = Blueprint('inquiries', __name__, url_prefix='/api/inquiries')

@inquiries_bp.before_request
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

def get_current_user():
    """현재 로그인한 사용자 가져오기"""
    user_id = get_jwt_identity()
    if not user_id:
        return None
    return User.query.get(int(user_id))

# 문의하기 목록 조회
@inquiries_bp.route('', methods=['GET'])
@jwt_required()
def get_inquiries():
    """문의하기 목록 조회 (자신이 작성한 문의만)"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        # 일반 사용자 및 운영진만 접근 가능
        if user.role not in ['user', 'admin']:
            return jsonify({'success': False, 'message': '접근 권한이 없습니다.'}), 403
        
        # 자신이 작성한 문의만 조회 (비공개이므로)
        inquiries = Inquiry.query.filter_by(user_id=user.id).order_by(Inquiry.created_at.desc()).all()
        
        return jsonify({
            'success': True,
            'inquiries': [inquiry.to_dict() for inquiry in inquiries]
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'문의 목록 조회 실패: {str(e)}'}), 500

# 문의하기 상세 조회
@inquiries_bp.route('/<int:inquiry_id>', methods=['GET'])
@jwt_required()
def get_inquiry(inquiry_id):
    """문의하기 상세 조회 (자신이 작성한 문의만)"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        # 일반 사용자 및 운영진만 접근 가능
        if user.role not in ['user', 'admin']:
            return jsonify({'success': False, 'message': '접근 권한이 없습니다.'}), 403
        
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry:
            return jsonify({'success': False, 'message': '문의를 찾을 수 없습니다.'}), 404
        
        # 자신이 작성한 문의만 조회 가능
        if inquiry.user_id != user.id:
            return jsonify({'success': False, 'message': '접근 권한이 없습니다.'}), 403
        
        return jsonify({
            'success': True,
            'inquiry': inquiry.to_dict()
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'문의 조회 실패: {str(e)}'}), 500

# 문의하기 작성
@inquiries_bp.route('', methods=['POST'])
@jwt_required()
def create_inquiry():
    """문의하기 작성"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        # 일반 사용자 및 운영진만 접근 가능
        if user.role not in ['user', 'admin']:
            return jsonify({'success': False, 'message': '접근 권한이 없습니다.'}), 403
        
        data = request.get_json()
        title = data.get('title', '').strip()
        content = data.get('content', '').strip()
        is_private = data.get('is_private', True)  # 기본값: 비공개
        
        # 유효성 검사
        if not title:
            return jsonify({'success': False, 'message': '제목을 입력해주세요.'}), 400
        
        if len(title) > 30:
            return jsonify({'success': False, 'message': '제목은 30자 이내로 입력해주세요.'}), 400
        
        if not content:
            return jsonify({'success': False, 'message': '내용을 입력해주세요.'}), 400
        
        if len(content) > 200:
            return jsonify({'success': False, 'message': '내용은 200자 이내로 입력해주세요.'}), 400
        
        # 문의 생성
        inquiry = Inquiry(
            user_id=user.id,
            title=title,
            content=content,
            is_private=is_private
        )
        
        db.session.add(inquiry)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '문의가 등록되었습니다.',
            'inquiry': inquiry.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'문의 등록 실패: {str(e)}'}), 500

# 문의하기 수정
@inquiries_bp.route('/<int:inquiry_id>', methods=['PUT'])
@jwt_required()
def update_inquiry(inquiry_id):
    """문의하기 수정"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        # 일반 사용자 및 운영진만 접근 가능
        if user.role not in ['user', 'admin']:
            return jsonify({'success': False, 'message': '접근 권한이 없습니다.'}), 403
        
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry:
            return jsonify({'success': False, 'message': '문의를 찾을 수 없습니다.'}), 404
        
        # 자신이 작성한 문의만 수정 가능
        if inquiry.user_id != user.id:
            return jsonify({'success': False, 'message': '접근 권한이 없습니다.'}), 403
        
        data = request.get_json()
        title = data.get('title', '').strip()
        content = data.get('content', '').strip()
        is_private = data.get('is_private', True)
        
        # 유효성 검사
        if not title:
            return jsonify({'success': False, 'message': '제목을 입력해주세요.'}), 400
        
        if len(title) > 30:
            return jsonify({'success': False, 'message': '제목은 30자 이내로 입력해주세요.'}), 400
        
        if not content:
            return jsonify({'success': False, 'message': '내용을 입력해주세요.'}), 400
        
        if len(content) > 200:
            return jsonify({'success': False, 'message': '내용은 200자 이내로 입력해주세요.'}), 400
        
        # 문의 수정
        inquiry.title = title
        inquiry.content = content
        inquiry.is_private = is_private
        inquiry.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '문의가 수정되었습니다.',
            'inquiry': inquiry.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'문의 수정 실패: {str(e)}'}), 500

# 문의하기 삭제
@inquiries_bp.route('/<int:inquiry_id>', methods=['DELETE'])
@jwt_required()
def delete_inquiry(inquiry_id):
    """문의하기 삭제"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        # 일반 사용자 및 운영진만 접근 가능
        if user.role not in ['user', 'admin']:
            return jsonify({'success': False, 'message': '접근 권한이 없습니다.'}), 403
        
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry:
            return jsonify({'success': False, 'message': '문의를 찾을 수 없습니다.'}), 404
        
        # 자신이 작성한 문의만 삭제 가능
        if inquiry.user_id != user.id:
            return jsonify({'success': False, 'message': '접근 권한이 없습니다.'}), 403
        
        db.session.delete(inquiry)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '문의가 삭제되었습니다.'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'문의 삭제 실패: {str(e)}'}), 500

