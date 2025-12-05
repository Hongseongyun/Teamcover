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
        .with_entities(Message.id)
        .count()
    )
    return jsonify({'success': True, 'count': count})


@messages_bp.route('/conversations', methods=['GET'])
@jwt_required()
def get_conversations():
    """현재 선택된 클럽에 가입된 회원 기준 대화 목록

    - 같은 클럽(승인된 ClubMember)인 사용자 모두를 후보로 사용
    - 각 사용자별 마지막 메세지 / 안 읽은 개수 요약
    - 슈퍼관리자는 클럽 선택 없이도 모든 사용자와의 대화 조회 가능
    """
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401

    # 슈퍼관리자인지 확인
    is_super_admin = user.role == 'super_admin'

    # 슈퍼관리자가 아닌 경우에만 클럽 선택 필수
    if not is_super_admin:
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400

        # 현재 사용자가 해당 클럽의 승인된 멤버인지 확인
        is_member, result = require_club_membership(user.id, club_id)
        if not is_member:
            return jsonify({'success': False, 'message': result}), 403

        # 같은 클럽에 가입된 모든 사용자 (본인 제외)
        membership_q = ClubMember.query.filter_by(
            club_id=club_id, status='approved'
        )
        member_user_ids = {m.user_id for m in membership_q if m.user_id}
        member_user_ids.discard(user.id)

        if not member_user_ids:
            return jsonify({'success': True, 'conversations': []})

        # 해당 사용자들 정보 미리 조회
        users = User.query.filter(User.id.in_(member_user_ids)).all()
        user_map = {u.id: u for u in users}

        # 내가 보낸/받은 모든 메세지 중, 같은 클럽 회원과의 메세지만 조회
        messages = (
            Message.query.filter(
                ((Message.sender_id == user.id) | (Message.receiver_id == user.id))
                & (
                    (Message.sender_id.in_(member_user_ids))
                    | (Message.receiver_id.in_(member_user_ids))
                )
            )
            .order_by(Message.created_at.desc())
            .all()
        )

        conversations = {}

        for msg in messages:
            other_id = msg.receiver_id if msg.sender_id == user.id else msg.sender_id
            if other_id not in member_user_ids:
                continue

            if other_id not in conversations:
                other_user = user_map.get(other_id)
                conversations[other_id] = {
                    'user_id': other_id,
                    'name': other_user.name if other_user else '알 수 없음',
                    'email': other_user.email if other_user else '',
                    'last_message': msg.content,
                    'last_time': msg.created_at.strftime('%Y-%m-%d %H:%M:%S')
                    if msg.created_at
                    else None,
                    'unread_count': 0,
                }

            # 내가 받은 메세지 중 읽지 않은 것만 카운트
            if msg.receiver_id == user.id and not msg.is_read:
                conversations[other_id]['unread_count'] += 1

        # 아직 대화를 한 번도 하지 않은 같은 클럽 회원들도 목록에 포함
        for other_id in member_user_ids:
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

        # 내가 보낸/받은 모든 메세지 조회
        messages = (
            Message.query.filter(
                ((Message.sender_id == user.id) | (Message.receiver_id == user.id))
                & (
                    (Message.sender_id.in_(member_user_ids))
                    | (Message.receiver_id.in_(member_user_ids))
                )
            )
            .order_by(Message.created_at.desc())
            .all()
        )

        conversations = {}

        for msg in messages:
            other_id = msg.receiver_id if msg.sender_id == user.id else msg.sender_id
            if other_id not in member_user_ids:
                continue

            if other_id not in conversations:
                other_user = user_map.get(other_id)
                conversations[other_id] = {
                    'user_id': other_id,
                    'name': other_user.name if other_user else '알 수 없음',
                    'email': other_user.email if other_user else '',
                    'last_message': msg.content,
                    'last_time': msg.created_at.strftime('%Y-%m-%d %H:%M:%S')
                    if msg.created_at
                    else None,
                    'unread_count': 0,
                }

            # 내가 받은 메세지 중 읽지 않은 것만 카운트
            if msg.receiver_id == user.id and not msg.is_read:
                conversations[other_id]['unread_count'] += 1

        # 아직 대화를 한 번도 하지 않은 모든 활성 사용자도 목록에 포함
        for other_id in member_user_ids:
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

    # 최신 순 정렬
    conv_list = sorted(
        conversations.values(), key=lambda c: c['last_time'] or '', reverse=True
    )

    return jsonify({'success': True, 'conversations': conv_list})


@messages_bp.route('/with/<int:other_user_id>', methods=['GET'])
@jwt_required()
def get_messages_with_user(other_user_id):
    """특정 사용자와의 메세지 목록"""
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
    """특정 사용자에게 메세지 전송"""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401

    other_user = User.query.get(other_user_id)
    if not other_user:
        return jsonify({'success': False, 'message': '상대 사용자를 찾을 수 없습니다.'}), 404

    data = request.get_json() or {}
    content = (data.get('content') or '').strip()
    if not content:
        return jsonify({'success': False, 'message': '메세지 내용을 입력해주세요.'}), 400

    message = Message(
        sender_id=user.id,
        receiver_id=other_user.id,
        content=content,
        created_at=datetime.utcnow(),
        is_read=False,
    )
    db.session.add(message)
    db.session.commit()

    return jsonify({'success': True, 'message': message.to_dict(current_user_id=user.id)})


@messages_bp.route('/with/<int:other_user_id>/read', methods=['POST'])
@jwt_required()
def mark_as_read(other_user_id):
    """상대방이 보낸 메세지를 모두 읽음 처리"""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401

    updated = (
        Message.query.filter_by(sender_id=other_user_id, receiver_id=user.id, is_read=False)
        .update({'is_read': True})
    )
    db.session.commit()

    return jsonify({'success': True, 'updated': updated})


