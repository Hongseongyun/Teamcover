from flask import Blueprint, request, jsonify, make_response
from datetime import datetime, timedelta
from models import db, Member, Payment, User
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.orm import joinedload

# 납입 관리 Blueprint
payments_bp = Blueprint('payments', __name__, url_prefix='/api/payments')

@payments_bp.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = make_response()
        response.status_code = 200
        from flask import current_app
        allowed_origins = current_app.config.get('CORS_ALLOWED_ORIGINS', [])
        request_origin = request.headers.get('Origin')
        if request_origin and request_origin in allowed_origins:
            response.headers.add("Access-Control-Allow-Origin", request_origin)
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization,X-Requested-With,X-Privacy-Token")
        response.headers.add('Access-Control-Allow-Methods', "GET,PUT,POST,DELETE,OPTIONS")
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

@payments_bp.route('/', methods=['GET'])
@jwt_required(optional=True)
def get_payments():
    """납입 내역 조회 API"""
    try:
        # 현재 사용자 확인
        user_id = get_jwt_identity()
        current_user = User.query.get(int(user_id)) if user_id else None
        
        # 관리자만 접근 가능
        if not current_user or current_user.role not in ['super_admin', 'admin']:
            return jsonify({'success': False, 'message': '관리자 권한이 필요합니다.'})
        
        # 쿼리 파라미터 가져오기
        member_id = request.args.get('member_id', type=int)
        payment_type = request.args.get('payment_type')  # 'monthly' 또는 'game'
        month = request.args.get('month')  # 'YYYY-MM'
        
        # 기본 쿼리
        query = Payment.query
        
        # 필터 적용
        if member_id:
            query = query.filter_by(member_id=member_id)
        if payment_type:
            query = query.filter_by(payment_type=payment_type)
        if month:
            query = query.filter_by(month=month)
        
        # member 관계를 eager load하여 N+1 쿼리 문제 해결
        # 최신순 정렬
        payments = query.options(joinedload(Payment.member)).order_by(Payment.payment_date.desc()).all()
        
        payments_data = [payment.to_dict() for payment in payments]
        
        # 통계 계산
        total_amount = sum(p.amount for p in payments)
        monthly_payments = [p for p in payments if p.payment_type == 'monthly']
        game_payments = [p for p in payments if p.payment_type == 'game']
        
        monthly_total = sum(p.amount for p in monthly_payments)
        game_total = sum(p.amount for p in game_payments)
        
        return jsonify({
            'success': True,
            'payments': payments_data,
            'stats': {
                'total_amount': total_amount,
                'monthly_total': monthly_total,
                'game_total': game_total,
                'count': len(payments)
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'납입 내역 조회 중 오류가 발생했습니다: {str(e)}'})

@payments_bp.route('/', methods=['POST'])
@jwt_required()
def add_payment():
    """납입 내역 추가 API"""
    try:
        # 현재 사용자 확인
        user_id = get_jwt_identity()
        current_user = User.query.get(int(user_id))
        
        # 관리자만 접근 가능
        if not current_user or current_user.role not in ['super_admin', 'admin']:
            return jsonify({'success': False, 'message': '관리자 권한이 필요합니다.'})
        
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': '요청 데이터가 없습니다.'})
        
        # 필수 필드 확인
        member_id = data.get('member_id')
        payment_type = data.get('payment_type')
        amount = data.get('amount')
        payment_date = data.get('payment_date')
        
        if not member_id or not payment_type or not amount or not payment_date:
            return jsonify({'success': False, 'message': '필수 입력 항목을 모두 입력해주세요.'})
        
        # 회원 확인
        member = Member.query.get(member_id)
        if not member:
            return jsonify({'success': False, 'message': '회원을 찾을 수 없습니다.'})
        
        # 금액 타입 확인
        try:
            amount = int(amount)
        except (ValueError, TypeError):
            return jsonify({'success': False, 'message': '금액은 숫자여야 합니다.'})
        
        # 날짜 확인
        try:
            payment_date = datetime.strptime(payment_date, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'success': False, 'message': '올바른 날짜 형식이 아닙니다. (YYYY-MM-DD)'})
        
        # month 필드 자동 설정 (YYYY-MM 형식)
        month = payment_date.strftime('%Y-%m')
        
        # 납입 내역 생성
        new_payment = Payment(
            member_id=member_id,
            payment_type=payment_type,
            amount=amount,
            payment_date=payment_date,
            month=month,
            is_paid=data.get('is_paid', True),
            is_exempt=data.get('is_exempt', False),
            note=data.get('note', '').strip()
        )
        
        db.session.add(new_payment)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'{member.name}님의 납입 내역이 추가되었습니다.',
            'payment': new_payment.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'납입 내역 추가 중 오류가 발생했습니다: {str(e)}'})

@payments_bp.route('/<int:payment_id>', methods=['PUT'])
@jwt_required()
def update_payment(payment_id):
    """납입 내역 수정 API"""
    try:
        # 현재 사용자 확인
        user_id = get_jwt_identity()
        current_user = User.query.get(int(user_id))
        
        # 관리자만 접근 가능
        if not current_user or current_user.role not in ['super_admin', 'admin']:
            return jsonify({'success': False, 'message': '관리자 권한이 필요합니다.'})
        
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': '요청 데이터가 없습니다.'})
        
        payment = Payment.query.options(joinedload(Payment.member)).get_or_404(payment_id)
        
        # 금액 수정
        if 'amount' in data:
            try:
                payment.amount = int(data['amount'])
            except (ValueError, TypeError):
                return jsonify({'success': False, 'message': '금액은 숫자여야 합니다.'})
        
        # 날짜 수정
        if 'payment_date' in data:
            try:
                payment.payment_date = datetime.strptime(data['payment_date'], '%Y-%m-%d').date()
                payment.month = payment.payment_date.strftime('%Y-%m')
            except ValueError:
                return jsonify({'success': False, 'message': '올바른 날짜 형식이 아닙니다. (YYYY-MM-DD)'})
        
        # 납입 여부 수정
        if 'is_paid' in data:
            payment.is_paid = bool(data['is_paid'])
        
        # 면제 여부 수정
        if 'is_exempt' in data:
            payment.is_exempt = bool(data['is_exempt'])
        
        # 비고 수정
        if 'note' in data:
            payment.note = data['note'].strip()
        
        payment.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '납입 내역이 수정되었습니다.',
            'payment': payment.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'납입 내역 수정 중 오류가 발생했습니다: {str(e)}'})

@payments_bp.route('/<int:payment_id>', methods=['DELETE'])
@jwt_required()
def delete_payment(payment_id):
    """납입 내역 삭제 API"""
    try:
        # 현재 사용자 확인
        user_id = get_jwt_identity()
        current_user = User.query.get(int(user_id))
        
        # 관리자만 접근 가능
        if not current_user or current_user.role not in ['super_admin', 'admin']:
            return jsonify({'success': False, 'message': '관리자 권한이 필요합니다.'})
        
        payment = Payment.query.options(joinedload(Payment.member)).get_or_404(payment_id)
        payment_info = f'{payment.member.name if payment.member else ""} ({payment.amount}원)'
        
        db.session.delete(payment)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'{payment_info} 납입 내역이 삭제되었습니다.'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'납입 내역 삭제 중 오류가 발생했습니다: {str(e)}'})

@payments_bp.route('/stats', methods=['GET'])
@jwt_required(optional=True)
def get_payment_stats():
    """납입 통계 조회 API"""
    try:
        # 현재 사용자 확인
        user_id = get_jwt_identity()
        current_user = User.query.get(int(user_id)) if user_id else None
        
        # 관리자만 접근 가능
        if not current_user or current_user.role not in ['super_admin', 'admin']:
            return jsonify({'success': False, 'message': '관리자 권한이 필요합니다.'})
        
        # 월별 통계
        monthly_stats = {}
        game_stats = {}
        
        # 이번 달 기준
        current_date = datetime.now().date()
        current_month = current_date.strftime('%Y-%m')
        
        # member 관계를 eager load하고 월별 통계를 DB 레벨에서 계산
        monthly_payments = db.session.query(
            Payment.month,
            db.func.sum(Payment.amount).label('total')
        ).filter(
            Payment.payment_type == 'monthly'
        ).group_by(Payment.month).all()
        
        game_payments = db.session.query(
            Payment.month,
            db.func.sum(Payment.amount).label('total')
        ).filter(
            Payment.payment_type == 'game'
        ).group_by(Payment.month).all()
        
        for payment in monthly_payments:
            if payment.month:
                monthly_stats[payment.month] = payment.total
        
        for payment in game_payments:
            if payment.month:
                game_stats[payment.month] = payment.total
        
        return jsonify({
            'success': True,
            'stats': {
                'monthly': monthly_stats,
                'game': game_stats
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'납입 통계 조회 중 오류가 발생했습니다: {str(e)}'})

