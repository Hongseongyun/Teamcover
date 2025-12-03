from flask import Blueprint, request, jsonify, make_response
from datetime import datetime
from models import db, Member, Point, Club
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.club_helpers import get_current_club_id, require_club_membership

# 포인트 관리 Blueprint
points_bp = Blueprint('points', __name__, url_prefix='/api/points')

@points_bp.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = make_response()
        from flask import current_app
        allowed_origins = current_app.config.get('CORS_ALLOWED_ORIGINS', [])
        request_origin = request.headers.get('Origin')
        if request_origin and request_origin in allowed_origins:
            response.headers.add("Access-Control-Allow-Origin", request_origin)
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization,X-Requested-With,X-Privacy-Token,X-Club-Id")
        response.headers.add('Access-Control-Allow-Methods', "GET,PUT,POST,DELETE,OPTIONS")
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

@points_bp.route('/', methods=['GET'])
@jwt_required(optional=True)
def get_points():
    """포인트 목록 조회 API"""
    try:
        # 클럽 필터링
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
        
        user_id = get_jwt_identity()
        if user_id:
            is_member, result = require_club_membership(int(user_id), club_id)
            if not is_member:
                return jsonify({'success': False, 'message': result}), 403
        
        # 클럽별 회원 조회
        all_members = {member.id: member for member in Member.query.filter_by(club_id=club_id, is_deleted=False).all()}
        
        # 클럽별 포인트 조회 - 시간순으로 정렬하여 잔여 포인트를 정확하게 계산
        points = Point.query.filter_by(club_id=club_id).order_by(Point.point_date.asc(), Point.created_at.asc()).all()
        points_data = []
        
        # 회원별 잔여 포인트 계산 (시간순으로 누적)
        member_balances = {}
        
        for point in points:
            member = all_members.get(point.member_id)
            member_name = member.name if member else 'Unknown'
            
            # 회원별 잔여 포인트 초기화
            if member_name not in member_balances:
                member_balances[member_name] = 0
            
            # 포인트 유형에 따라 잔여 포인트 계산
            if point.point_type in ['적립', '보너스']:
                member_balances[member_name] += point.amount
            else:
                member_balances[member_name] -= point.amount
            
            # 표시용 금액/유형 보정
            display_note = point.note
            is_payment_linked = isinstance(display_note, str) and display_note.startswith('PAYMENT:')
            # PAYMENT 연동 포인트는 유형을 강제로 '사용'으로 표기
            display_point_type = '사용' if is_payment_linked else point.point_type
            # 사용은 음수로 반환하여 UI에 -값이 보이도록 처리
            display_amount = point.amount if display_point_type in ['적립', '보너스'] else -abs(point.amount)
            # PAYMENT 링크 메모는 응답에서 숨김 처리
            if is_payment_linked:
                display_note = ''

            points_data.append({
                'id': point.id,
                'member_name': member_name,
                'member_id': point.member_id,
                'point_type': display_point_type,
                'amount': display_amount,
                'reason': point.reason,
                'note': display_note,
                'point_date': point.point_date.strftime('%Y-%m-%d') if point.point_date else None,
                'created_at': point.created_at.strftime('%Y-%m-%d') if point.created_at else None,
                'balance': member_balances[member_name]  # 잔여 포인트 추가
            })
        
        # 최종 결과를 최신순으로 정렬
        points_data.reverse()
        
        return jsonify({
            'success': True,
            'points': points_data
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'포인트 목록 조회 중 오류가 발생했습니다: {str(e)}'})

@points_bp.route('/', methods=['POST'])
def add_point():
    """포인트 등록 API"""
    try:
        # 클럽 필터링
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
        
        data = request.get_json()
        
        member_name = data.get('member_name', '').strip() if data.get('member_name') else ''
        if not member_name:
            return jsonify({'success': False, 'message': '회원 이름은 필수 입력 항목입니다.'})
        
        # 클럽별 회원 조회
        member = Member.query.filter_by(name=member_name, club_id=club_id, is_deleted=False).first()
        if not member:
            return jsonify({'success': False, 'message': f'등록되지 않은 회원입니다: {member_name}'})
        
        amount = data.get('amount', 0)
        if amount == 0:
            return jsonify({'success': False, 'message': '포인트 금액은 0이 아닌 값이어야 합니다.'})
        
        # 금액 부호 기준으로 유형 강제 설정
        point_type = '적립' if amount > 0 else '사용'
        
        point_date_str = data.get('point_date', '')
        if point_date_str:
            try:
                point_date = datetime.strptime(point_date_str, '%Y-%m-%d').date()
            except ValueError:
                point_date = datetime.now().date()
        else:
            point_date = datetime.now().date()
        
        new_point = Point(
            member_id=member.id,
            club_id=club_id,
            point_date=point_date,
            point_type=point_type,
            amount=amount,
            reason=data.get('reason', '').strip() if data.get('reason') else '',
            note=data.get('note', '').strip() if data.get('note') else ''
        )
        
        db.session.add(new_point)
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': f'{member_name}의 포인트가 등록되었습니다.',
            'point': {
                'id': new_point.id,
                'member_name': member_name,
                'point_type': point_type,
                'amount': amount
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'포인트 등록 중 오류가 발생했습니다: {str(e)}'})

@points_bp.route('/<int:point_id>/', methods=['DELETE'])
@points_bp.route('/<int:point_id>', methods=['DELETE'])
def delete_point(point_id):
    """포인트 삭제 API"""
    try:
        # 클럽 필터링
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
        
        # 클럽별 포인트 조회
        point = Point.query.filter_by(id=point_id, club_id=club_id).first_or_404()
        member = Member.query.get(point.member_id)
        member_name = member.name if member else 'Unknown'
        
        db.session.delete(point)
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': f'{member_name}의 포인트가 삭제되었습니다.'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'포인트 삭제 중 오류가 발생했습니다: {str(e)}'})

@points_bp.route('/batch', methods=['POST'])
def add_points_batch():
    """여러 명의 포인트 일괄 등록 API"""
    try:
        # 클럽 필터링
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
        
        data = request.get_json()
        
        # 필수 필드 검증
        member_names = data.get('member_names', [])
        if not member_names or not isinstance(member_names, list):
            return jsonify({'success': False, 'message': '회원 목록이 필요합니다.'})
        
        amount = data.get('amount', 0)
        if amount == 0:
            return jsonify({'success': False, 'message': '포인트 금액은 0이 아닌 값이어야 합니다.'})
        
        # 금액 부호 기준으로 유형 강제 설정
        point_type = '적립' if amount > 0 else '사용'
        
        # 날짜 처리
        point_date_str = data.get('point_date', '')
        if point_date_str:
            try:
                point_date = datetime.strptime(point_date_str, '%Y-%m-%d').date()
            except ValueError:
                point_date = datetime.now().date()
        else:
            point_date = datetime.now().date()
        
        # 회원 검증 및 포인트 생성
        created_points = []
        failed_members = []
        
        for member_name in member_names:
            member_name = member_name.strip()
            if not member_name:
                continue
                
            # 클럽별 회원 조회
            member = Member.query.filter_by(name=member_name, club_id=club_id, is_deleted=False).first()
            if not member:
                failed_members.append(member_name)
                continue
            
            # 금액 부호 기준으로 유형 강제 설정
            computed_type = '적립' if amount > 0 else '사용'
            new_point = Point(
                member_id=member.id,
                club_id=club_id,
                point_date=point_date,
                point_type=computed_type,
                amount=amount,
                reason=data.get('reason', '').strip() if data.get('reason') else '',
                note=data.get('note', '').strip() if data.get('note') else ''
            )
            
            db.session.add(new_point)
            created_points.append({
                'member_name': member_name,
                'point_id': new_point.id
            })
        
        # 실패한 회원이 있으면 롤백
        if failed_members:
            db.session.rollback()
            return jsonify({
                'success': False, 
                'message': f'등록되지 않은 회원이 있습니다: {", ".join(failed_members)}'
            })
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'{len(created_points)}명의 포인트가 등록되었습니다.',
            'created_points': created_points
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'포인트 일괄 등록 중 오류가 발생했습니다: {str(e)}'})

@points_bp.route('/<int:point_id>/', methods=['PUT'])
@points_bp.route('/<int:point_id>', methods=['PUT'])
def update_point(point_id):
    """포인트 수정 API"""
    try:
        # 클럽 필터링
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
        
        data = request.get_json()
        
        member_name = data.get('member_name', '').strip() if data.get('member_name') else ''
        if not member_name:
            return jsonify({'success': False, 'message': '회원 이름을 입력해주세요.'})
        
        # 클럽별 회원 조회
        member = Member.query.filter_by(name=member_name, club_id=club_id, is_deleted=False).first()
        if not member:
            return jsonify({'success': False, 'message': f'등록되지 않은 회원입니다: {member_name}'})
        
        point_type = data.get('point_type', '').strip() if data.get('point_type') else ''
        if not point_type:
            return jsonify({'success': False, 'message': '포인트 유형은 필수 입력 항목입니다.'})
        
        amount = data.get('amount', 0)
        if amount == 0:
            return jsonify({'success': False, 'message': '포인트 금액은 0이 아닌 값이어야 합니다.'})
        
        point_date_str = data.get('point_date', '')
        if point_date_str:
            try:
                point_date = datetime.strptime(point_date_str, '%Y-%m-%d').date()
            except ValueError:
                point_date = datetime.now().date()
        else:
            point_date = datetime.now().date()
        
        # 클럽별 포인트 조회
        point = Point.query.filter_by(id=point_id, club_id=club_id).first_or_404()
        
        point.member_id = member.id
        point.point_date = point_date
        point.point_type = point_type
        point.amount = amount
        point.reason = data.get('reason', '').strip() if data.get('reason') else ''
        point.note = data.get('note', '').strip() if data.get('note') else ''
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'{member_name}의 포인트가 수정되었습니다.'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'포인트 수정 중 오류가 발생했습니다: {str(e)}'})
