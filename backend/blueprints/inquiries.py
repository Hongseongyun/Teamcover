from flask import Blueprint, request, jsonify, make_response
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from models import db, User, Inquiry, ClubMember, InquiryReplyComment, InquiryReplyCommentLike
from utils.club_helpers import get_current_club_id, check_club_permission, require_club_membership

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
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization,X-Requested-With,X-Club-Id,X-Privacy-Token")
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
    """문의하기 목록 조회
    - 슈퍼관리자: 모든 문의 조회
    - 클럽 운영진: 자신의 클럽 문의 (비공개 포함) + 자신이 작성한 문의
    - 일반 회원: 자신이 작성한 문의 + 같은 클럽의 전체공개 문의
    """
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        # 슈퍼관리자는 모든 문의 조회
        if user.role == 'super_admin':
            inquiries = Inquiry.query.order_by(Inquiry.created_at.desc()).all()
        else:
            club_id = get_current_club_id()
            if not club_id:
                return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
            
            # 클럽 운영진 권한 확인 (user.role과 무관하게 ClubMember.role 확인)
            has_permission, result = check_club_permission(user.id, club_id, 'admin')
            if has_permission:
                # 클럽 운영진: 자신이 작성한 문의 + 자신의 클럽 문의 (비공개 포함)
                inquiries = Inquiry.query.filter(
                    db.or_(
                        Inquiry.user_id == user.id,
                        Inquiry.club_id == club_id
                    )
                ).order_by(Inquiry.created_at.desc()).all()
            else:
                # 일반 회원: 자신이 작성한 문의 + 같은 클럽의 전체공개 문의
                is_member, _ = require_club_membership(user.id, club_id)
                if is_member:
                    inquiries = Inquiry.query.filter(
                        db.or_(
                            Inquiry.user_id == user.id,
                            db.and_(
                                Inquiry.club_id == club_id,
                                Inquiry.is_private == False
                            )
                        )
                    ).order_by(Inquiry.created_at.desc()).all()
                else:
                    inquiries = Inquiry.query.filter_by(user_id=user.id).order_by(Inquiry.created_at.desc()).all()
        
        return jsonify({
            'success': True,
            'inquiries': [inquiry.to_dict() for inquiry in inquiries]
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'문의 목록 조회 실패: {str(e)}'}), 500

# 답변이 달린 문의 개수 조회 (작성자용)
@inquiries_bp.route('/replied-count', methods=['GET'])
@jwt_required()
def get_replied_inquiry_count():
    """답변이 달린 문의 개수 조회 (작성자용)"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        # 사용자가 작성한 문의 중 답변이 달린 문의 개수 조회
        replied_count = Inquiry.query.filter(
            Inquiry.user_id == user.id,
            Inquiry.reply.isnot(None)
        ).count()
        
        return jsonify({
            'success': True,
            'replied_count': replied_count
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'답변 달린 문의 개수 조회 실패: {str(e)}'}), 500

# 새로운 문의 확인 (답변이 없는 문의 개수)
@inquiries_bp.route('/unread-count', methods=['GET'])
@jwt_required()
def get_unread_inquiry_count():
    """답변이 없는 문의 개수 조회 (운영진 및 슈퍼관리자용)"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        # 슈퍼관리자는 모든 답변 없는 문의 개수 조회
        if user.role == 'super_admin':
            unread_count = Inquiry.query.filter(
                Inquiry.reply.is_(None)
            ).count()
        else:
            club_id = get_current_club_id()
            if not club_id:
                return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
            
            # 클럽 운영진 권한 확인
            has_permission, result = check_club_permission(user.id, club_id, 'admin')
            if not has_permission:
                # 운영진이 아닌 경우 0 반환
                return jsonify({
                    'success': True,
                    'unread_count': 0
                })
            
            # 해당 클럽의 답변 없는 문의 개수 조회
            unread_count = Inquiry.query.filter(
                Inquiry.club_id == club_id,
                Inquiry.reply.is_(None)
            ).count()
        
        return jsonify({
            'success': True,
            'unread_count': unread_count
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'문의 개수 조회 실패: {str(e)}'}), 500

# 문의하기 상세 조회
@inquiries_bp.route('/<int:inquiry_id>', methods=['GET'])
@jwt_required()
def get_inquiry(inquiry_id):
    """문의하기 상세 조회
    - 전체공개 문의: 모두가 볼 수 있음
    - 비공개 문의: 작성자 + 해당 클럽 운영진 + 슈퍼관리자만 볼 수 있음
    """
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry:
            return jsonify({'success': False, 'message': '문의를 찾을 수 없습니다.'}), 404
        
        # 자신이 작성한 문의인 경우 - 항상 볼 수 있음
        if inquiry.user_id == user.id:
            return jsonify({
                'success': True,
                'inquiry': inquiry.to_dict()
            })
        
        # 슈퍼관리자는 모든 문의 열람 가능
        if user.role == 'super_admin':
            return jsonify({
                'success': True,
                'inquiry': inquiry.to_dict()
            })
        
        # 전체공개 문의인 경우 - 모두가 볼 수 있음
        if not inquiry.is_private:
            return jsonify({
                'success': True,
                'inquiry': inquiry.to_dict()
            })
        
        # 비공개 문의인 경우 - 해당 클럽 운영진만 볼 수 있음
        if inquiry.is_private:
            if not inquiry.club_id:
                return jsonify({'success': False, 'message': '접근 권한이 없습니다.'}), 403
            
            club_id = get_current_club_id()
            if not club_id:
                return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
            
            # 해당 클럽 운영진 권한 확인
            has_permission, result = check_club_permission(user.id, club_id, 'admin')
            if has_permission and inquiry.club_id == club_id:
                return jsonify({
                    'success': True,
                    'inquiry': inquiry.to_dict()
                })
            else:
                return jsonify({'success': False, 'message': '접근 권한이 없습니다.'}), 403
        
        return jsonify({'success': False, 'message': '접근 권한이 없습니다.'}), 403
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
        
        # 모든 회원이 작성 가능 (슈퍼관리자 제외)
        if user.role == 'super_admin':
            return jsonify({'success': False, 'message': '슈퍼관리자는 문의를 작성할 수 없습니다.'}), 403
        
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
        
        # 현재 선택된 클럽 ID 가져오기
        club_id = get_current_club_id()
        
        # 문의 생성
        inquiry = Inquiry(
            user_id=user.id,
            club_id=club_id,
            title=title,
            content=content,
            is_private=is_private
        )
        
        db.session.add(inquiry)
        db.session.commit()
        
        # 해당 클럽의 운영진과 슈퍼관리자에게 푸시 알림 전송
        try:
            from fcm_service import send_notification_to_club_admins
            send_notification_to_club_admins(
                club_id=club_id,
                title='새로운 문의가 등록되었습니다',
                body=f'{user.name}님이 "{title}" 문의를 작성했습니다.',
                data={
                    'type': 'inquiry',
                    'inquiry_id': str(inquiry.id),
                    'user_name': user.name,
                    'club_id': str(club_id) if club_id else None
                }
            )
        except Exception as e:
            # 푸시 알림 실패가 문의 등록에 영향을 주지 않도록 함
            pass
        
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
        
        # 모든 회원이 작성 가능 (슈퍼관리자 제외)
        if user.role == 'super_admin':
            return jsonify({'success': False, 'message': '슈퍼관리자는 문의를 작성할 수 없습니다.'}), 403
        
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
    """문의하기 삭제
    - 작성자: 자신이 작성한 문의 삭제 가능
    - 슈퍼관리자: 모든 문의 삭제 가능
    - 클럽 운영진: 해당 클럽의 문의 삭제 가능
    """
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry:
            return jsonify({'success': False, 'message': '문의를 찾을 수 없습니다.'}), 404
        
        # 슈퍼관리자는 모든 문의 삭제 가능
        if user.role == 'super_admin':
            pass  # 권한 확인 통과
        # 작성자는 자신이 작성한 문의만 삭제 가능
        elif inquiry.user_id == user.id:
            pass  # 권한 확인 통과
        # 클럽 운영진은 해당 클럽의 문의만 삭제 가능
        else:
            if not inquiry.club_id:
                return jsonify({'success': False, 'message': '클럽이 지정되지 않은 문의입니다.'}), 400
            
            club_id = get_current_club_id()
            if not club_id:
                return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
            
            # 해당 클럽 운영진 권한 확인
            has_permission, result = check_club_permission(user.id, club_id, 'admin')
            if not has_permission:
                return jsonify({
                    'success': False, 
                    'message': f'접근 권한이 없습니다. 작성자이거나 클럽 운영진 권한이 필요합니다. ({result})'
                }), 403
            
            # 해당 클럽의 문의인지 확인
            if inquiry.club_id != club_id:
                return jsonify({'success': False, 'message': '다른 클럽의 문의는 삭제할 수 없습니다.'}), 403
        
        db.session.delete(inquiry)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '문의가 삭제되었습니다.'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'문의 삭제 실패: {str(e)}'}), 500

# 문의하기 답변
@inquiries_bp.route('/<int:inquiry_id>/reply', methods=['POST'])
@jwt_required()
def reply_inquiry(inquiry_id):
    """문의하기 답변 (슈퍼관리자 또는 클럽 운영진만 가능)"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry:
            return jsonify({'success': False, 'message': '문의를 찾을 수 없습니다.'}), 404
        
        # 슈퍼관리자는 모든 문의에 답변 가능
        if user.role == 'super_admin':
            pass  # 권한 확인 통과
        # 클럽 운영진은 자신의 클럽 문의에만 답변 가능
        else:
            club_id = get_current_club_id()
            if not club_id:
                return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
            
            # 클럽 운영진 권한 확인 (user.role이 'admin'이 아니어도 클럽 운영진일 수 있음)
            has_permission, result = check_club_permission(user.id, club_id, 'admin')
            if not has_permission:
                return jsonify({
                    'success': False, 
                    'message': f'클럽 운영진 권한이 필요합니다. ({result})'
                }), 403
            
            # 자신의 클럽 문의인지 확인
            if inquiry.club_id != club_id:
                return jsonify({'success': False, 'message': '다른 클럽의 문의에는 답변할 수 없습니다.'}), 403
        
        data = request.get_json()
        reply = data.get('reply', '').strip()
        
        if not reply:
            return jsonify({'success': False, 'message': '답변 내용을 입력해주세요.'}), 400
        
        if len(reply) > 500:
            return jsonify({'success': False, 'message': '답변은 500자 이내로 입력해주세요.'}), 400
        
        # 답변 저장
        inquiry.reply = reply
        inquiry.replied_by = user.id
        inquiry.replied_at = datetime.utcnow()
        inquiry.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        # 문의 작성자에게 자동 메시지 전송
        try:
            from models import Message
            inquiry_author = User.query.get(inquiry.user_id)
            if inquiry_author and inquiry_author.id != user.id:  # 자기 자신에게는 메시지 보내지 않음
                # 메시지 내용 생성 (문의 바로가기 링크 포함)
                message_content = f'문의하신 "{inquiry.title}"에 답변이 등록되었습니다.\n\n답변 내용:\n{reply[:200]}{"..." if len(reply) > 200 else ""}\n\n[문의 보기: /inquiry?inquiry_id={inquiry.id}]'
                
                # 자동 메시지 생성
                auto_message = Message(
                    sender_id=user.id,
                    receiver_id=inquiry_author.id,
                    content=message_content,
                    created_at=datetime.utcnow(),
                    is_read=False,
                )
                db.session.add(auto_message)
                db.session.commit()
                
                # 메시지 전송 후 푸시 알림은 messages.py의 send_message 함수에서 처리됨
                # 여기서는 직접 푸시 알림을 보내지 않고, 메시지 전송 로직을 재사용
                try:
                    from fcm_service import send_notification_to_user
                    send_notification_to_user(
                        user_id=inquiry_author.id,
                        title='새로운 메시지',
                        body=f'{user.name}님으로부터 메시지가 도착했습니다: 문의 답변이 완료되었습니다.',
                        data={
                            'type': 'message',
                            'sender_id': str(user.id),
                            'sender_name': user.name,
                            'message_id': str(auto_message.id),
                            'content': message_content[:100]
                        }
                    )
                except Exception as e:
                    pass
        except Exception as e:
            # 메시지 전송 실패가 답변 등록에 영향을 주지 않도록 함
            db.session.rollback()
        
        return jsonify({
            'success': True,
            'message': '답변이 등록되었습니다.',
            'inquiry': inquiry.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'답변 등록 실패: {str(e)}'}), 500

# 문의하기 답변 수정
@inquiries_bp.route('/<int:inquiry_id>/reply', methods=['PUT'])
@jwt_required()
def update_inquiry_reply(inquiry_id):
    """문의하기 답변 수정
    - 슈퍼관리자: 모든 문의 답변 수정 가능
    - 클럽 운영진: 해당 클럽의 문의 답변만 수정 가능
    """
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry:
            return jsonify({'success': False, 'message': '문의를 찾을 수 없습니다.'}), 404
        
        # 답변이 없으면 404
        if not inquiry.reply:
            return jsonify({'success': False, 'message': '답변이 없습니다.'}), 404
        
        # 슈퍼관리자는 모든 답변 수정 가능
        if user.role == 'super_admin':
            pass  # 권한 확인 통과
        # 클럽 운영진은 해당 클럽의 문의 답변만 수정 가능
        else:
            if not inquiry.club_id:
                return jsonify({'success': False, 'message': '클럽이 지정되지 않은 문의입니다.'}), 400
            
            club_id = get_current_club_id()
            if not club_id:
                return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
            
            # 해당 클럽 운영진 권한 확인
            has_permission, result = check_club_permission(user.id, club_id, 'admin')
            if not has_permission:
                return jsonify({
                    'success': False, 
                    'message': f'클럽 운영진 권한이 필요합니다. ({result})'
                }), 403
            
            # 해당 클럽의 문의인지 확인
            if inquiry.club_id != club_id:
                return jsonify({'success': False, 'message': '다른 클럽의 문의 답변은 수정할 수 없습니다.'}), 403
        
        data = request.get_json()
        reply = data.get('reply', '').strip()
        
        if not reply:
            return jsonify({'success': False, 'message': '답변 내용을 입력해주세요.'}), 400
        
        if len(reply) > 500:
            return jsonify({'success': False, 'message': '답변은 500자 이내로 입력해주세요.'}), 400
        
        # 답변 수정
        inquiry.reply = reply
        inquiry.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '답변이 수정되었습니다.',
            'inquiry': inquiry.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'답변 수정 실패: {str(e)}'}), 500

# 문의하기 답변 삭제
@inquiries_bp.route('/<int:inquiry_id>/reply', methods=['DELETE'])
@jwt_required()
def delete_inquiry_reply(inquiry_id):
    """문의하기 답변 삭제
    - 슈퍼관리자: 모든 문의 답변 삭제 가능
    - 클럽 운영진: 해당 클럽의 문의 답변만 삭제 가능
    """
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry:
            return jsonify({'success': False, 'message': '문의를 찾을 수 없습니다.'}), 404
        
        # 답변이 없으면 404
        if not inquiry.reply:
            return jsonify({'success': False, 'message': '답변이 없습니다.'}), 404
        
        # 슈퍼관리자는 모든 답변 삭제 가능
        if user.role == 'super_admin':
            pass  # 권한 확인 통과
        # 클럽 운영진은 해당 클럽의 문의 답변만 삭제 가능
        else:
            if not inquiry.club_id:
                return jsonify({'success': False, 'message': '클럽이 지정되지 않은 문의입니다.'}), 400
            
            club_id = get_current_club_id()
            if not club_id:
                return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
            
            # 해당 클럽 운영진 권한 확인
            has_permission, result = check_club_permission(user.id, club_id, 'admin')
            if not has_permission:
                return jsonify({
                    'success': False, 
                    'message': f'클럽 운영진 권한이 필요합니다. ({result})'
                }), 403
            
            # 해당 클럽의 문의인지 확인
            if inquiry.club_id != club_id:
                return jsonify({'success': False, 'message': '다른 클럽의 문의 답변은 삭제할 수 없습니다.'}), 403
        
        # 답변 삭제
        inquiry.reply = None
        inquiry.replied_by = None
        inquiry.replied_at = None
        inquiry.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '답변이 삭제되었습니다.',
            'inquiry': inquiry.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'답변 삭제 실패: {str(e)}'}), 500

# 답변 댓글 목록 조회
@inquiries_bp.route('/<int:inquiry_id>/reply/comments', methods=['GET'])
@jwt_required()
def get_reply_comments(inquiry_id):
    """답변 댓글 목록 조회 (답글 포함)"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry:
            return jsonify({'success': False, 'message': '문의를 찾을 수 없습니다.'}), 404
        
        # 답변이 없으면 댓글도 없음
        if not inquiry.reply:
            return jsonify({
                'success': True,
                'comments': []
            })
        
        # parent_id가 None인 댓글만 조회 (답글이 아닌 댓글만)
        comments = InquiryReplyComment.query.filter_by(
            inquiry_id=inquiry_id,
            parent_id=None
        ).order_by(InquiryReplyComment.created_at.asc()).all()
        
        return jsonify({
            'success': True,
            'comments': [comment.to_dict(user.id) for comment in comments]
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'댓글 목록 조회 실패: {str(e)}'}), 500

# 답변 댓글 작성
@inquiries_bp.route('/<int:inquiry_id>/reply/comments', methods=['POST'])
@jwt_required()
def create_reply_comment(inquiry_id):
    """답변 댓글 작성 (답글 지원)"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry:
            return jsonify({'success': False, 'message': '문의를 찾을 수 없습니다.'}), 404
        
        # 답변이 없으면 댓글 작성 불가
        if not inquiry.reply:
            return jsonify({'success': False, 'message': '답변이 없는 문의에는 댓글을 작성할 수 없습니다.'}), 400
        
        data = request.get_json()
        content = data.get('content', '').strip()
        parent_id = data.get('parent_id', None)  # 답글인 경우 부모 댓글 ID
        
        if not content:
            return jsonify({'success': False, 'message': '댓글 내용을 입력해주세요.'}), 400
        
        if len(content) > 500:
            return jsonify({'success': False, 'message': '댓글은 500자 이내로 입력해주세요.'}), 400
        
        # parent_id가 있는 경우 (답글), 부모 댓글이 존재하는지 확인
        if parent_id:
            parent_comment = InquiryReplyComment.query.get(parent_id)
            if not parent_comment:
                return jsonify({'success': False, 'message': '부모 댓글을 찾을 수 없습니다.'}), 404
            if parent_comment.inquiry_id != inquiry_id:
                return jsonify({'success': False, 'message': '잘못된 부모 댓글입니다.'}), 400
        
        # 댓글 생성
        comment = InquiryReplyComment(
            inquiry_id=inquiry_id,
            user_id=user.id,
            parent_id=parent_id,
            content=content
        )
        
        db.session.add(comment)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '댓글이 등록되었습니다.',
            'comment': comment.to_dict(user.id)
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'댓글 등록 실패: {str(e)}'}), 500

# 답변 댓글 수정
@inquiries_bp.route('/<int:inquiry_id>/reply/comments/<int:comment_id>', methods=['PUT'])
@jwt_required()
def update_reply_comment(inquiry_id, comment_id):
    """답변 댓글 수정"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        comment = InquiryReplyComment.query.get(comment_id)
        if not comment:
            return jsonify({'success': False, 'message': '댓글을 찾을 수 없습니다.'}), 404
        
        # 자신이 작성한 댓글만 수정 가능
        if comment.user_id != user.id:
            return jsonify({'success': False, 'message': '댓글 수정 권한이 없습니다.'}), 403
        
        data = request.get_json()
        content = data.get('content', '').strip()
        
        if not content:
            return jsonify({'success': False, 'message': '댓글 내용을 입력해주세요.'}), 400
        
        if len(content) > 500:
            return jsonify({'success': False, 'message': '댓글은 500자 이내로 입력해주세요.'}), 400
        
        # 댓글 수정
        comment.content = content
        comment.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '댓글이 수정되었습니다.',
            'comment': comment.to_dict(user.id)
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'댓글 수정 실패: {str(e)}'}), 500

# 답변 댓글 삭제
@inquiries_bp.route('/<int:inquiry_id>/reply/comments/<int:comment_id>', methods=['DELETE'])
@jwt_required()
def delete_reply_comment(inquiry_id, comment_id):
    """답변 댓글 삭제
    - 작성자: 자신이 작성한 댓글 삭제 가능
    - 슈퍼관리자: 모든 댓글 삭제 가능
    - 클럽 운영진: 해당 클럽의 문의 댓글 삭제 가능
    """
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        comment = InquiryReplyComment.query.get(comment_id)
        if not comment:
            return jsonify({'success': False, 'message': '댓글을 찾을 수 없습니다.'}), 404
        
        if comment.inquiry_id != inquiry_id:
            return jsonify({'success': False, 'message': '잘못된 댓글입니다.'}), 400
        
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry:
            return jsonify({'success': False, 'message': '문의를 찾을 수 없습니다.'}), 404
        
        # 슈퍼관리자는 모든 댓글 삭제 가능
        if user.role == 'super_admin':
            pass  # 권한 확인 통과
        # 작성자는 자신이 작성한 댓글만 삭제 가능
        elif comment.user_id == user.id:
            pass  # 권한 확인 통과
        # 클럽 운영진은 해당 클럽의 문의 댓글만 삭제 가능
        else:
            if not inquiry.club_id:
                return jsonify({'success': False, 'message': '클럽이 지정되지 않은 문의입니다.'}), 400
            
            club_id = get_current_club_id()
            if not club_id:
                return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
            
            # 해당 클럽 운영진 권한 확인
            has_permission, result = check_club_permission(user.id, club_id, 'admin')
            if not has_permission:
                return jsonify({
                    'success': False, 
                    'message': '댓글 삭제 권한이 없습니다. 작성자이거나 클럽 운영진 권한이 필요합니다.'
                }), 403
            
            # 해당 클럽의 문의인지 확인
            if inquiry.club_id != club_id:
                return jsonify({'success': False, 'message': '다른 클럽의 문의 댓글은 삭제할 수 없습니다.'}), 403
        
        db.session.delete(comment)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '댓글이 삭제되었습니다.'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'댓글 삭제 실패: {str(e)}'}), 500

# 답변 댓글 좋아요 토글
@inquiries_bp.route('/<int:inquiry_id>/reply/comments/<int:comment_id>/like', methods=['POST'])
@jwt_required()
def toggle_reply_comment_like(inquiry_id, comment_id):
    """답변 댓글 좋아요 토글"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        comment = InquiryReplyComment.query.get(comment_id)
        if not comment:
            return jsonify({'success': False, 'message': '댓글을 찾을 수 없습니다.'}), 404
        
        if comment.inquiry_id != inquiry_id:
            return jsonify({'success': False, 'message': '잘못된 댓글입니다.'}), 400
        
        # 기존 좋아요 확인
        existing_like = InquiryReplyCommentLike.query.filter_by(
            comment_id=comment_id,
            user_id=user.id
        ).first()
        
        if existing_like:
            # 좋아요 취소
            db.session.delete(existing_like)
            action = 'unliked'
        else:
            # 좋아요 추가
            new_like = InquiryReplyCommentLike(
                comment_id=comment_id,
                user_id=user.id
            )
            db.session.add(new_like)
            action = 'liked'
        
        db.session.commit()
        
        # 업데이트된 댓글 정보 반환
        comment = InquiryReplyComment.query.get(comment_id)
        
        return jsonify({
            'success': True,
            'action': action,
            'like_count': len(comment.likes),
            'comment': comment.to_dict(user.id)
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'좋아요 처리 실패: {str(e)}'}), 500

