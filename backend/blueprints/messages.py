from flask import Blueprint, request, jsonify, make_response
from datetime import datetime
from models import db, User, Message, ClubMember
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.club_helpers import get_current_club_id, require_club_membership


messages_bp = Blueprint('messages', __name__, url_prefix='/api/messages')


@messages_bp.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = make_response()
        from flask import current_app

        allowed_origins = current_app.config.get('CORS_ALLOWED_ORIGINS', [])
        request_origin = request.headers.get('Origin')
        if request_origin and request_origin in allowed_origins:
            response.headers.add("Access-Control-Allow-Origin", request_origin)
        response.headers.add(
            'Access-Control-Allow-Headers',
            "Content-Type,Authorization,X-Requested-With,X-Club-Id,X-Privacy-Token",
        )
        response.headers.add(
            'Access-Control-Allow-Methods', "GET,PUT,POST,DELETE,OPTIONS"
        )
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response


def get_current_user():
    user_id = get_jwt_identity()
    if not user_id:
        return None
    return User.query.get(int(user_id))


@messages_bp.route('/unread-count', methods=['GET'])
@jwt_required()
def unread_count():
    """현재 사용자 기준 읽지 않은 메시지 수"""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401

    count = (
        Message.query.filter_by(receiver_id=user.id, is_read=False)
        .filter(Message.is_deleted == False)  # 삭제되지 않은 메시지만 카운트
        .with_entities(Message.id)
        .count()
    )
    return jsonify({'success': True, 'count': count})


@messages_bp.route('/conversations', methods=['GET'])
@jwt_required()
def get_conversations():
    """현재 선택된 클럽에 가입된 회원 기준 대화 목록

    - 같은 클럽(승인된 ClubMember)인 사용자 모두를 후보로 사용
    - 각 사용자별 마지막 메시지 / 안 읽은 개수 요약
    - 슈퍼관리자는 클럽 선택 없이도 모든 사용자와의 대화 조회 가능
    """
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401

    # 슈퍼관리자인지 확인
    is_super_admin = user.role == 'super_admin'

    # 일반 사용자: 가입한 모든 클럽의 회원과의 대화 조회
    if not is_super_admin:
        # 사용자가 가입한 모든 클럽 조회
        user_memberships = ClubMember.query.filter_by(
            user_id=user.id, status='approved'
        ).all()
        
        if not user_memberships:
            return jsonify({'success': True, 'conversations': []})

        # 사용자가 가입한 모든 클럽 ID
        user_club_ids = {m.club_id for m in user_memberships}

        # 모든 클럽에 가입된 모든 사용자 (본인 제외, 슈퍼관리자 제외)
        all_memberships = ClubMember.query.filter(
            ClubMember.club_id.in_(user_club_ids),
            ClubMember.status == 'approved',
            ClubMember.user_id != user.id
        ).all()
        
        member_user_ids = {m.user_id for m in all_memberships}

        # 해당 사용자들 정보 미리 조회 (슈퍼관리자 제외)
        users = User.query.filter(
            User.id.in_(member_user_ids),
            User.role != 'super_admin'  # 슈퍼관리자 제외
        ).all()
        member_user_ids = {u.id for u in users}  # 슈퍼관리자 제외된 ID만 사용
        user_map = {u.id: u for u in users}

        # 슈퍼관리자와의 대화도 별도로 조회
        super_admin_users = User.query.filter(
            User.role == 'super_admin',
            User.id != user.id,
            User.is_active == True
        ).all()
        super_admin_user_ids = {u.id for u in super_admin_users}
        super_admin_user_map = {u.id: u for u in super_admin_users}

        if not member_user_ids and not super_admin_user_ids:
            return jsonify({'success': True, 'conversations': []})

        # 내가 보낸/받은 모든 메시지 중, 같은 클럽 회원과의 메시지만 조회
        messages = (
            Message.query.filter(
                ((Message.sender_id == user.id) | (Message.receiver_id == user.id))
                & (
                    (Message.sender_id.in_(member_user_ids))
                    | (Message.receiver_id.in_(member_user_ids))
                )
            )
            .filter(Message.is_deleted == False)  # 삭제되지 않은 메시지만 조회
            .order_by(Message.created_at.desc())
            .all()
        )

        conversations = {}

        for msg in messages:
            other_id = msg.receiver_id if msg.sender_id == user.id else msg.sender_id
            if other_id not in member_user_ids:
                continue

            # 대화가 없으면 초기화
            if other_id not in conversations:
                other_user = user_map.get(other_id)
                if not other_user:
                    # user_map에 없으면 직접 조회 (메시지가 있는 사용자)
                    other_user = User.query.get(other_id)
                conversations[other_id] = {
                    'user_id': other_id,
                    'name': other_user.name if other_user else '알 수 없음',
                    'email': other_user.email if other_user else '',
                    'last_message': '',
                    'last_time': None,
                    'unread_count': 0,
                    'user_role': other_user.role if other_user else 'user',
                }

            # 마지막 메시지 업데이트 (시간이 더 최신인 경우만)
            msg_time = msg.created_at.strftime('%Y-%m-%d %H:%M:%S') if msg.created_at else None
            current_last_time = conversations[other_id]['last_time']
            
            # 시간 비교: msg_time이 더 최신이거나 현재 last_time이 없으면 업데이트
            if not current_last_time or (msg_time and msg_time > current_last_time):
                conversations[other_id]['last_message'] = msg.content
                conversations[other_id]['last_time'] = msg_time

            # 내가 받은 메시지 중 읽지 않은 것만 카운트
            if msg.receiver_id == user.id and not msg.is_read:
                conversations[other_id]['unread_count'] += 1

        # 슈퍼관리자와의 메시지 조회
        if super_admin_user_ids:
            super_admin_messages = (
                Message.query.filter(
                    ((Message.sender_id == user.id) | (Message.receiver_id == user.id))
                    & (
                        (Message.sender_id.in_(super_admin_user_ids))
                        | (Message.receiver_id.in_(super_admin_user_ids))
                    )
                )
                .filter(Message.is_deleted == False)
                .order_by(Message.created_at.desc())
                .all()
            )

            for msg in super_admin_messages:
                other_id = msg.receiver_id if msg.sender_id == user.id else msg.sender_id
                if other_id not in super_admin_user_ids:
                    continue

                if other_id not in conversations:
                    other_user = super_admin_user_map.get(other_id)
                    conversations[other_id] = {
                        'user_id': other_id,
                        'name': other_user.name if other_user else '알 수 없음',
                        'email': other_user.email if other_user else '',
                        'last_message': '',
                        'last_time': None,
                        'unread_count': 0,
                        'user_role': 'super_admin',  # 슈퍼관리자 표시
                    }

                msg_time = msg.created_at.strftime('%Y-%m-%d %H:%M:%S') if msg.created_at else None
                current_last_time = conversations[other_id]['last_time']
                
                if not current_last_time or (msg_time and msg_time > current_last_time):
                    conversations[other_id]['last_message'] = msg.content
                    conversations[other_id]['last_time'] = msg_time

                if msg.receiver_id == user.id and not msg.is_read:
                    conversations[other_id]['unread_count'] += 1

        # 메시지가 있는 사용자만 대화 목록에 포함 (대화를 한 번도 하지 않은 회원은 제외)
    else:
        # 슈퍼관리자인 경우: 모든 활성 사용자와의 대화 조회
        # 본인을 제외한 모든 활성 사용자
        all_users = User.query.filter(
            User.id != user.id, User.is_active == True
        ).all()
        member_user_ids = {u.id for u in all_users}
        user_map = {u.id: u for u in all_users}

        if not member_user_ids:
            return jsonify({'success': True, 'conversations': []})

        # 내가 보낸/받은 모든 메시지 조회
        messages = (
            Message.query.filter(
                ((Message.sender_id == user.id) | (Message.receiver_id == user.id))
                & (
                    (Message.sender_id.in_(member_user_ids))
                    | (Message.receiver_id.in_(member_user_ids))
                )
            )
            .filter(Message.is_deleted == False)  # 삭제되지 않은 메시지만 조회
            .order_by(Message.created_at.desc())
            .all()
        )

        conversations = {}

        for msg in messages:
            other_id = msg.receiver_id if msg.sender_id == user.id else msg.sender_id
            if other_id not in member_user_ids:
                continue

            # 대화가 없으면 초기화
            if other_id not in conversations:
                other_user = user_map.get(other_id)
                conversations[other_id] = {
                    'user_id': other_id,
                    'name': other_user.name if other_user else '알 수 없음',
                    'email': other_user.email if other_user else '',
                    'last_message': '',
                    'last_time': None,
                    'unread_count': 0,
                }

            # 마지막 메시지 업데이트 (시간이 더 최신인 경우만)
            msg_time = msg.created_at.strftime('%Y-%m-%d %H:%M:%S') if msg.created_at else None
            current_last_time = conversations[other_id]['last_time']
            
            # 시간 비교: msg_time이 더 최신이거나 현재 last_time이 없으면 업데이트
            if not current_last_time or (msg_time and msg_time > current_last_time):
                conversations[other_id]['last_message'] = msg.content
                conversations[other_id]['last_time'] = msg_time

            # 내가 받은 메시지 중 읽지 않은 것만 카운트
            if msg.receiver_id == user.id and not msg.is_read:
                conversations[other_id]['unread_count'] += 1

        # 메시지가 있는 사용자만 대화 목록에 포함 (대화를 한 번도 하지 않은 사용자는 제외)

    # 최신 순 정렬
    conv_list = sorted(
        conversations.values(), key=lambda c: c['last_time'] or '', reverse=True
    )

    return jsonify({'success': True, 'conversations': conv_list})


@messages_bp.route('/with/<int:other_user_id>', methods=['GET'])
@jwt_required()
def get_messages_with_user(other_user_id):
    """특정 사용자와의 메시지 목록"""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401

    # 존재하는 사용자만 허용
    other_user = User.query.get(other_user_id)
    if not other_user:
        return jsonify({'success': False, 'message': '상대 사용자를 찾을 수 없습니다.'}), 404

    messages = (
        Message.query.filter(
            ((Message.sender_id == user.id) & (Message.receiver_id == other_user_id))
            | (
                (Message.sender_id == other_user_id)
                & (Message.receiver_id == user.id)
            )
        )
        .filter(Message.is_deleted == False)  # 삭제되지 않은 메시지만 조회
        .order_by(Message.created_at.asc())
        .all()
    )

    data = [m.to_dict(current_user_id=user.id) for m in messages]

    return jsonify(
        {
            'success': True,
            'messages': data,
            'other_user': {
                'id': other_user.id,
                'name': other_user.name,
                'email': other_user.email,
            },
        }
    )


@messages_bp.route('/with/<int:other_user_id>', methods=['POST'])
@jwt_required()
def send_message(other_user_id):
    """특정 사용자에게 메시지 전송"""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401

    other_user = User.query.get(other_user_id)
    if not other_user:
        return jsonify({'success': False, 'message': '상대 사용자를 찾을 수 없습니다.'}), 404

    data = request.get_json() or {}
    content = (data.get('content') or '').strip()
    if not content:
        return jsonify({'success': False, 'message': '메시지 내용을 입력해주세요.'}), 400

    message = Message(
        sender_id=user.id,
        receiver_id=other_user.id,
        content=content,
        created_at=datetime.utcnow(),
        is_read=False,
    )
    db.session.add(message)
    db.session.commit()

    # 수신자에게 푸시 알림 전송
    try:
        from fcm_service import send_notification_to_user
        send_notification_to_user(
            user_id=other_user.id,
            title='새로운 메시지',
            body=f'{user.name}님으로부터 메시지가 도착했습니다: {content[:50]}',
            data={
                'type': 'message',
                'sender_id': str(user.id),
                'sender_name': user.name,
                'message_id': str(message.id),
                'content': content[:100]  # 긴 메시지는 일부만 전송
            }
        )
    except Exception as e:
        # 푸시 알림 실패가 메시지 전송에 영향을 주지 않도록 함
        pass

    return jsonify({'success': True, 'message': message.to_dict(current_user_id=user.id)})


@messages_bp.route('/with/<int:other_user_id>/read', methods=['POST'])
@jwt_required()
def mark_as_read(other_user_id):
    """상대방이 보낸 메시지를 모두 읽음 처리"""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401

    updated = (
        Message.query.filter_by(sender_id=other_user_id, receiver_id=user.id, is_read=False)
        .filter(Message.is_deleted == False)
        .update({'is_read': True})
    )
    db.session.commit()

    return jsonify({'success': True, 'updated': updated})


@messages_bp.route('/<int:message_id>', methods=['DELETE'])
@jwt_required()
def delete_message(message_id):
    """본인이 보낸 메시지 삭제 (소프트 삭제)
    
    메시지를 보낸 후 10분 이내에만 삭제 가능
    """
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401

    message = Message.query.get(message_id)
    if not message:
        return jsonify({'success': False, 'message': '메시지를 찾을 수 없습니다.'}), 404

    # 본인이 보낸 메시지만 삭제 가능
    if message.sender_id != user.id:
        return jsonify({'success': False, 'message': '본인이 보낸 메시지만 삭제할 수 있습니다.'}), 403

    # 이미 삭제된 메시지인지 확인
    if message.is_deleted:
        return jsonify({'success': False, 'message': '이미 삭제된 메시지입니다.'}), 400

    # 메시지 생성 후 10분 이내인지 확인
    if message.created_at:
        from datetime import timedelta
        time_elapsed = datetime.utcnow() - message.created_at
        if time_elapsed > timedelta(minutes=10):
            return jsonify({
                'success': False,
                'message': '메시지를 보낸 후 10분 이내에만 삭제할 수 있습니다.'
            }), 400

    # 소프트 삭제
    message.is_deleted = True
    db.session.commit()

    return jsonify({'success': True, 'message': '메시지가 삭제되었습니다.'})


