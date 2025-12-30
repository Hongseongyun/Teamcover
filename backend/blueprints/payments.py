from flask import Blueprint, request, jsonify, make_response
from datetime import datetime, timedelta
from models import db, Member, Payment, User, Point, AppSetting, FundLedger, FundState, FundBalanceCache
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.orm import joinedload
from sqlalchemy import func
from utils.club_helpers import get_current_club_id, require_club_membership, check_club_permission
import json

# 납입 관리 Blueprint
payments_bp = Blueprint('payments', __name__, url_prefix='/api/payments')

# 포인트 날짜 계산 헬퍼 함수
def get_point_date_for_payment(payment):
    """납입 내역에 대한 포인트 차감 날짜를 계산합니다.
    월회비는 month 필드를 기반으로, 정기전은 payment_date를 사용합니다.
    """
    if payment.payment_type == 'monthly' and payment.month:
        # month가 'YYYY-MM' 형식이므로 해당 월의 첫째 날로 설정
        try:
            return datetime.strptime(payment.month + '-01', '%Y-%m-%d').date()
        except:
            return payment.payment_date
    else:
        return payment.payment_date

# 월회비 금액 가져오기 헬퍼 함수
def get_monthly_fee_amount():
    """설정된 월회비 금액을 가져옵니다. 기본값은 5000원입니다."""
    try:
        monthly_fee = AppSetting.query.filter_by(setting_key='monthly_fee_amount').first()
        if monthly_fee and monthly_fee.setting_value:
            return int(monthly_fee.setting_value)
    except Exception:
        pass
    return 5000  # 기본값

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
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization,X-Requested-With,X-Privacy-Token,X-Club-Id")
        response.headers.add('Access-Control-Allow-Methods', "GET,PUT,POST,DELETE,OPTIONS")
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

@payments_bp.route('/', methods=['GET'])
@jwt_required(optional=True)
def get_payments():
    """납입 내역 조회 API"""
    try:
        # 클럽 필터링
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
        
        # 현재 사용자 확인
        user_id = get_jwt_identity()
        current_user = User.query.get(int(user_id)) if user_id else None
        
        # 슈퍼관리자는 가입 여부 확인 생략, 일반 사용자는 가입 확인 필요
        is_super_admin = current_user and current_user.role == 'super_admin'
        
        if not is_super_admin and user_id:
            # 클럽 내 권한 확인 (admin 이상)
            has_permission, result = check_club_permission(int(user_id), club_id, 'admin')
            if not has_permission:
                return jsonify({'success': False, 'message': result}), 403
        
        # 쿼리 파라미터 가져오기
        member_id = request.args.get('member_id', type=int)
        payment_type = request.args.get('payment_type')  # 'monthly' 또는 'game'
        month = request.args.get('month')  # 'YYYY-MM'
        
        # 기본 쿼리 (클럽별)
        query = Payment.query.filter_by(club_id=club_id)
        
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
        # 클럽 필터링
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
        
        # 현재 사용자 확인
        user_id = get_jwt_identity()
        current_user = User.query.get(int(user_id))
        
        # 슈퍼관리자는 가입 여부 확인 생략, 일반 사용자는 가입 확인 필요
        is_super_admin = current_user and current_user.role == 'super_admin'
        
        if not is_super_admin:
            # 클럽 내 권한 확인 (admin 이상)
            has_permission, result = check_club_permission(int(user_id), club_id, 'admin')
            if not has_permission:
                return jsonify({'success': False, 'message': result}), 403
        
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
        
        # 클럽별 회원 확인 (삭제되지 않은 회원만)
        member = Member.query.filter_by(id=member_id, club_id=club_id, is_deleted=False).first()
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
            club_id=club_id,
            payment_type=payment_type,
            amount=amount,
            payment_date=payment_date,
            month=month,
            is_paid=data.get('is_paid', True),
            is_exempt=data.get('is_exempt', False),
            paid_with_points=data.get('paid_with_points', False),
            note=data.get('note', '').strip()
        )
        
        db.session.add(new_payment)
        db.session.commit()

        # 장부 동기화
        try:
            _sync_payment_to_ledger(new_payment)
        except Exception:
            db.session.rollback()

        # 포인트 자동 차감 처리: 정기전(game) 또는 월회비(monthly) + 납입완료 + 포인트로 납부 + 면제 아님
        try:
            should_create_point = (
                new_payment.is_paid is True
                and new_payment.is_exempt is False
                and new_payment.paid_with_points is True
            )
            if should_create_point:
                # 월회비는 설정된 금액, 정기전은 실제 금액
                point_amount = get_monthly_fee_amount() if new_payment.payment_type == 'monthly' else abs(new_payment.amount)
                point_reason = '월회비' if new_payment.payment_type == 'monthly' else '정기전 게임비'
                
                # 포인트 차감 날짜 계산
                point_date = get_point_date_for_payment(new_payment)
                
                point = Point(
                    member_id=new_payment.member_id,
                    club_id=club_id,  # 클럽 ID 추가
                    point_type='사용',
                    amount=point_amount,  # 사용은 양수 저장, 계산 시 차감
                    reason=point_reason,
                    point_date=point_date,
                    note=f'PAYMENT:{new_payment.id}'
                )
                db.session.add(point)
                db.session.commit()
        except Exception:
            db.session.rollback()
            # 포인트 생성 실패가 전체 결제 생성에 영향을 주지 않도록 함
        
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
        # 클럽 필터링
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
        
        # 현재 사용자 확인
        user_id = get_jwt_identity()
        current_user = User.query.get(int(user_id))
        
        if not current_user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'})
        
        # 슈퍼관리자 또는 시스템 관리자인지 확인
        is_system_admin = current_user.role in ['super_admin', 'admin']
        
        # 클럽별 운영진인지 확인
        is_club_admin = False
        if not is_system_admin:
            has_permission, result = check_club_permission(int(user_id), club_id, 'admin')
            if has_permission:
                is_club_admin = True
            else:
                return jsonify({'success': False, 'message': '관리자 권한이 필요합니다.'}), 403
        
        # 슈퍼관리자, 시스템 관리자, 또는 클럽별 운영진만 접근 가능
        
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': '요청 데이터가 없습니다.'})
        
        payment = Payment.query.options(joinedload(Payment.member)).get_or_404(payment_id)
        
        # 수정하려는 납입 내역이 현재 클럽에 속하는지 확인
        if payment.club_id != club_id:
            return jsonify({'success': False, 'message': '다른 클럽의 납입 내역은 수정할 수 없습니다.'}), 403

        # 기존 상태 보존 (포인트 동기화 비교용)
        prev_paid_with_points = payment.paid_with_points
        prev_is_paid = payment.is_paid
        prev_is_exempt = payment.is_exempt
        prev_payment_date = payment.payment_date
        prev_amount = payment.amount
        
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

        # 포인트 납부 여부 수정
        if 'paid_with_points' in data:
            payment.paid_with_points = bool(data['paid_with_points'])
        
        # 비고 수정
        if 'note' in data:
            payment.note = data['note'].strip()
        
        payment.updated_at = datetime.utcnow()
        db.session.commit()

        # 장부 동기화
        try:
            _sync_payment_to_ledger(payment)
        except Exception:
            db.session.rollback()

        # 포인트 동기화
        try:
            # 연결된 포인트 내역 찾기
            linked_point = Point.query.filter_by(note=f'PAYMENT:{payment.id}').first()

            should_have_point = (
                payment.is_paid is True
                and payment.is_exempt is False
                and payment.paid_with_points is True
            )

            if should_have_point and linked_point is None:
                # 새로 생성
                # 월회비는 설정된 금액, 정기전은 실제 금액
                point_amount = get_monthly_fee_amount() if payment.payment_type == 'monthly' else abs(payment.amount)
                point_reason = '월회비' if payment.payment_type == 'monthly' else '정기전 게임비'
                
                # 포인트 차감 날짜 계산
                point_date = get_point_date_for_payment(payment)
                
                new_point = Point(
                    member_id=payment.member_id,
                    club_id=club_id,  # 클럽 ID 추가
                    point_type='사용',
                    amount=point_amount,
                    reason=point_reason,
                    point_date=point_date,
                    note=f'PAYMENT:{payment.id}'
                )
                db.session.add(new_point)
                db.session.commit()
            elif not should_have_point and linked_point is not None:
                # 기존 것 삭제
                db.session.delete(linked_point)
                db.session.commit()
            elif linked_point is not None:
                # 포인트는 유지되지만 금액/날짜가 바뀐 경우 동기화
                # 월회비는 설정된 금액, 정기전은 실제 금액
                expected_amount = get_monthly_fee_amount() if payment.payment_type == 'monthly' else abs(payment.amount)
                
                # 포인트 차감 날짜 계산
                expected_point_date = get_point_date_for_payment(payment)
                
                needs_update = (
                    (expected_point_date != linked_point.point_date)
                    or (expected_amount != linked_point.amount)
                )
                if needs_update:
                    linked_point.point_date = expected_point_date
                    linked_point.amount = expected_amount
                    # 월회비인 경우 reason도 업데이트
                    if payment.payment_type == 'monthly':
                        linked_point.reason = '월회비'
                    db.session.commit()
        except Exception:
            db.session.rollback()
        
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
        # 클럽 필터링
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
        
        # 현재 사용자 확인
        user_id = get_jwt_identity()
        current_user = User.query.get(int(user_id))
        
        if not current_user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'})
        
        # 슈퍼관리자 또는 시스템 관리자인지 확인
        is_system_admin = current_user.role in ['super_admin', 'admin']
        
        # 클럽별 운영진인지 확인
        is_club_admin = False
        if not is_system_admin:
            has_permission, result = check_club_permission(int(user_id), club_id, 'admin')
            if has_permission:
                is_club_admin = True
            else:
                return jsonify({'success': False, 'message': '관리자 권한이 필요합니다.'}), 403
        
        # 슈퍼관리자, 시스템 관리자, 또는 클럽별 운영진만 접근 가능
        
        payment = Payment.query.options(joinedload(Payment.member)).get_or_404(payment_id)
        
        # 삭제하려는 납입 내역이 현재 클럽에 속하는지 확인
        if payment.club_id != club_id:
            return jsonify({'success': False, 'message': '다른 클럽의 납입 내역은 삭제할 수 없습니다.'}), 403
        payment_info = f'{payment.member.name if payment.member else ""} ({payment.amount}원)'
        
        # 연결된 포인트 있으면 먼저 삭제
        try:
            linked_point = Point.query.filter_by(note=f'PAYMENT:{payment.id}').first()
            if linked_point:
                db.session.delete(linked_point)
        except Exception:
            db.session.rollback()
            # 계속 진행

        # 연결된 장부 항목 삭제
        try:
            FundLedger.query.filter_by(payment_id=payment.id).delete()
        except Exception:
            db.session.rollback()
        
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
        # 클럽 필터링
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
        
        # 현재 사용자 확인
        user_id = get_jwt_identity()
        current_user = User.query.get(int(user_id)) if user_id else None
        if not current_user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'})
        
        # 슈퍼관리자 또는 시스템 관리자인지 확인
        is_system_admin = current_user.role in ['super_admin', 'admin']
        
        # 클럽별 운영진인지 확인
        is_club_admin = False
        if not is_system_admin:
            has_permission, result = check_club_permission(int(user_id), club_id, 'admin')
            if has_permission:
                is_club_admin = True
            else:
                return jsonify({'success': False, 'message': '관리자 권한이 필요합니다.'}), 403
        
        # 슈퍼관리자, 시스템 관리자, 또는 클럽별 운영진만 접근 가능
        
        # 월별 통계
        monthly_stats = {}
        game_stats = {}
        
        # 이번 달 기준
        current_date = datetime.now().date()
        current_month = current_date.strftime('%Y-%m')
        
        # 시작월(from_month) 설정값/파라미터 처리
        setting_start = AppSetting.query.filter_by(setting_key='fund_start_month').first()
        default_from_month = setting_start.setting_value if setting_start and setting_start.setting_value else None
        from_month = request.args.get('from_month') or default_from_month

        # member 관계를 eager load하고 월별 통계를 DB 레벨에서 계산 (클럽별)
        monthly_payments = db.session.query(
            Payment.month,
            db.func.sum(Payment.amount).label('total')
        ).filter(
            Payment.payment_type == 'monthly',
            Payment.club_id == club_id
        )
        if from_month:
            monthly_payments = monthly_payments.filter(Payment.month >= from_month)
        monthly_payments = monthly_payments.group_by(Payment.month).all()
        
        game_payments = db.session.query(
            Payment.month,
            db.func.sum(Payment.amount).label('total')
        ).filter(
            Payment.payment_type == 'game',
            Payment.club_id == club_id
        )
        if from_month:
            game_payments = game_payments.filter(Payment.month >= from_month)
        game_payments = game_payments.group_by(Payment.month).all()
        
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
            },
            'from_month': from_month
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'납입 통계 조회 중 오류가 발생했습니다: {str(e)}'})


# 내부 유틸: 회비 잔액 및 그래프 계산
def _calculate_fund_balance_and_chart(club_id):
    """회비 잔액 및 그래프 데이터를 계산하여 캐시에 저장"""
    try:
        # Teamcover가 아닌 클럽은 계산하지 않음
        from models import Club
        club = Club.query.get(club_id)
        if not club or club.name != 'Teamcover':
            return

        # 장부 항목 조회
        ledger_items = FundLedger.query.filter_by(club_id=club_id).order_by(FundLedger.event_date.asc()).all()
        
        if not ledger_items:
            # 빈 데이터로 캐시 저장
            cache = FundBalanceCache.query.filter_by(club_id=club_id).first()
            if cache:
                cache.current_balance = 0
                cache.balance_series = {}
                cache.last_calculated_at = datetime.utcnow()
            else:
                cache = FundBalanceCache(
                    club_id=club_id,
                    current_balance=0,
                    balance_series={},
                    last_calculated_at=datetime.utcnow()
                )
                db.session.add(cache)
            db.session.commit()
            return

        # 포인트 데이터 조회
        points = Point.query.filter_by(club_id=club_id).order_by(Point.point_date.asc(), Point.created_at.asc()).all()
        
        # 탈퇴되지 않은 회원 목록
        active_members = Member.query.filter_by(club_id=club_id, is_deleted=False).all()
        active_member_names = {member.name for member in active_members}

        # 장부 항목 월별 그룹화
        monthly_data = {}
        for item in ledger_items:
            month_key = item.month
            if month_key not in monthly_data:
                monthly_data[month_key] = {'credit': 0, 'debit': 0}
            
            if item.entry_type == 'credit':
                monthly_data[month_key]['credit'] += int(item.amount) or 0
            elif item.entry_type == 'debit':
                monthly_data[month_key]['debit'] += int(item.amount) or 0

        # 포인트 데이터 월별 그룹화
        monthly_point_data = {}
        for point in points:
            # member_id로 회원 이름 확인
            member = Member.query.get(point.member_id) if point.member_id else None
            if not member or member.name not in active_member_names:
                continue
            
            point_date = point.point_date or point.created_at
            if isinstance(point_date, str):
                point_date = datetime.strptime(point_date, '%Y-%m-%d').date()
            elif isinstance(point_date, datetime):
                point_date = point_date.date()
            
            month_key = point_date.strftime('%Y-%m')
            if month_key not in monthly_point_data:
                monthly_point_data[month_key] = 0
            # 포인트 유형에 따라 잔액 계산: 적립/보너스는 더하고, 사용은 뺌
            if point.point_type in ['적립', '보너스']:
                monthly_point_data[month_key] += int(point.amount) or 0
            else:
                monthly_point_data[month_key] -= int(point.amount) or 0

        # 그래프 시작 월 계산
        all_data_months = sorted(set(list(monthly_data.keys()) + list(monthly_point_data.keys())))
        if not all_data_months:
            cache = FundBalanceCache.query.filter_by(club_id=club_id).first()
            if cache:
                cache.current_balance = 0
                cache.balance_series = {}
                cache.last_calculated_at = datetime.utcnow()
            else:
                cache = FundBalanceCache(
                    club_id=club_id,
                    current_balance=0,
                    balance_series={},
                    last_calculated_at=datetime.utcnow()
                )
                db.session.add(cache)
            db.session.commit()
            return

        first_month = all_data_months[0]
        first_month_items = [item for item in ledger_items if item.month == first_month]

        # 초기 잔액 계산
        initial_balance = 0
        if first_month_items:
            first_item = first_month_items[0]
            if first_item.source == 'manual' and first_item.note and ('잔여 회비' in first_item.note or '잔여' in first_item.note):
                initial_balance = int(first_item.amount) or 0
                if first_item.entry_type == 'credit':
                    monthly_data[first_month]['credit'] -= initial_balance
                elif first_item.entry_type == 'debit':
                    monthly_data[first_month]['debit'] -= initial_balance

        # 그래프 데이터 생성
        labels = []
        payment_balances = []
        credits = []
        debits = []
        point_balances = []
        running_balance = initial_balance

        # 11월부터 시작 (10월 제외)
        start_month = '2025-11'
        months_to_display = [m for m in all_data_months if m >= start_month]

        # 10월의 잔액을 계산하여 초기 잔액에 포함
        october_month = '2025-10'
        if october_month in all_data_months:
            october_data = monthly_data.get(october_month, {'credit': 0, 'debit': 0})
            october_net_change = october_data['credit'] - october_data['debit']
            running_balance += october_net_change

        # 각 월별 데이터 계산
        for month_key in months_to_display:
            month_data = monthly_data.get(month_key, {'credit': 0, 'debit': 0})
            net_change = month_data['credit'] - month_data['debit']
            running_balance += net_change

            # 해당 달의 마지막 날짜까지의 포인트 누적 잔액 계산
            year, month = map(int, month_key.split('-'))
            from calendar import monthrange
            last_day = monthrange(year, month)[1]
            month_end_date = datetime(year, month, last_day, 23, 59, 59)

            # 포인트 누적 계산
            point_balance_for_month = 0
            for point in points:
                # member_id로 회원 이름 확인
                member = Member.query.get(point.member_id) if point.member_id else None
                if not member or member.name not in active_member_names:
                    continue
                
                point_date = point.point_date or point.created_at
                if isinstance(point_date, str):
                    point_date = datetime.strptime(point_date, '%Y-%m-%d')
                elif isinstance(point_date, datetime):
                    pass
                else:
                    continue
                
                if point_date <= month_end_date:
                    # 포인트 유형에 따라 잔액 계산: 적립/보너스는 더하고, 사용은 뺌
                    if point.point_type in ['적립', '보너스']:
                        point_balance_for_month += int(point.amount) or 0
                    else:
                        point_balance_for_month -= int(point.amount) or 0

            labels.append(month_key)
            payment_balances.append(running_balance)
            credits.append(month_data['credit'])
            debits.append(month_data['debit'])
            point_balances.append(point_balance_for_month)

        # 캐시 저장 또는 업데이트
        balance_series = {
            'labels': labels,
            'data': payment_balances,
            'paymentBalances': payment_balances,
            'credits': credits,
            'debits': debits,
            'pointBalances': point_balances
        }

        cache = FundBalanceCache.query.filter_by(club_id=club_id).first()
        if cache:
            cache.current_balance = running_balance
            cache.balance_series = balance_series
            cache.last_calculated_at = datetime.utcnow()
        else:
            cache = FundBalanceCache(
                club_id=club_id,
                current_balance=running_balance,
                balance_series=balance_series,
                last_calculated_at=datetime.utcnow()
            )
            db.session.add(cache)
        
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f'잔액 계산 오류: {str(e)}')
        # 오류가 발생해도 기존 동작에 영향을 주지 않도록 함


# 내부 유틸: 결제-장부 동기화
def _sync_payment_to_ledger(payment: Payment):
    """결제 레코드를 장부에 반영/삭제한다."""
    # 결제 반영 조건: 납입완료 + 면제 아님 + 포인트 납부 아님
    should_exist = (
        bool(payment.is_paid)
        and not bool(payment.is_exempt)
        and not bool(payment.paid_with_points)  # 포인트 납부는 장부에 기록하지 않음
    )
    # 기존 장부
    existing = FundLedger.query.filter_by(payment_id=payment.id).all()

    if not should_exist:
        # 존재하면 삭제
        if existing:
            for row in existing:
                db.session.delete(row)
            db.session.commit()
        return

    # 있어야 하는 경우 → 1개 기준으로 정규화
    if existing:
        entry = existing[0]
        # 중복 항목이 있으면 첫 번째만 남기고 나머지는 삭제
        if len(existing) > 1:
            for row in existing[1:]:
                db.session.delete(row)
    else:
        entry = FundLedger(payment_id=payment.id, club_id=payment.club_id)
        db.session.add(entry)

    entry.club_id = payment.club_id
    entry.event_date = payment.payment_date
    entry.month = payment.month or payment.payment_date.strftime('%Y-%m')
    entry.amount = abs(int(payment.amount))
    entry.source = payment.payment_type  # 'monthly' or 'game'
    entry.entry_type = 'credit' if payment.payment_type in ('monthly', 'game') else 'debit'
    entry.note = payment.note
    db.session.commit()
    
    # 잔액 캐시 재계산
    try:
        _calculate_fund_balance_and_chart(payment.club_id)
    except Exception:
        pass  # 캐시 계산 실패가 전체 동작에 영향을 주지 않도록


# 장부 API: 조회/수기 추가(관리자)
@payments_bp.route('/fund/ledger', methods=['GET', 'POST'])
@jwt_required(optional=True)
def fund_ledger_endpoint():
    try:
        if request.method == 'GET':
            # 클럽 필터링
            club_id = get_current_club_id()
            if not club_id:
                return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
            
            user_id = get_jwt_identity()
            current_user = User.query.get(int(user_id)) if user_id else None
            if not current_user:
                return jsonify({'success': False, 'message': '로그인이 필요합니다.'})
            
            # 슈퍼관리자 또는 시스템 관리자인지 확인
            is_system_admin = current_user.role in ['super_admin', 'admin']
            
            # 클럽별 운영진인지 확인
            is_club_admin = False
            if not is_system_admin:
                has_permission, result = check_club_permission(int(user_id), club_id, 'admin')
                if has_permission:
                    is_club_admin = True
                else:
                    return jsonify({'success': False, 'message': '관리자 권한이 필요합니다.'}), 403
            
            # 슈퍼관리자, 시스템 관리자, 또는 클럽별 운영진만 접근 가능

            from_month = request.args.get('from_month')
            q = FundLedger.query.filter_by(club_id=club_id)
            if from_month:
                q = q.filter(FundLedger.month >= from_month)
            q = q.order_by(FundLedger.event_date.desc())
            rows = q.all()

            # 과거 데이터 보정: 포인트 납부 납입 내역 제거 & 입금 처리 유지
            payment_ids = [
                row.payment_id for row in rows if row.payment_id
            ]
            paid_with_points_ids = set()
            if payment_ids:
                paid_with_points_payments = Payment.query.filter(
                    Payment.id.in_(payment_ids),
                    Payment.paid_with_points.is_(True),
                ).all()
                paid_with_points_ids = {p.id for p in paid_with_points_payments}

            entries_updated = False
            cleaned_rows = []
            for row in rows:
                # 포인트 납부인 경우 장부에서 제거
                if row.payment_id in paid_with_points_ids:
                    db.session.delete(row)
                    entries_updated = True
                    continue
                if row.source == 'game':
                    if row.entry_type != 'credit':
                        row.entry_type = 'credit'
                        entries_updated = True
                cleaned_rows.append(row)

            if entries_updated:
                db.session.commit()

            return jsonify({'success': True, 'items': [
                {
                    'id': r.id,
                    'event_date': r.event_date.strftime('%Y-%m-%d') if r.event_date else None,
                    'month': r.month,
                    'entry_type': r.entry_type,
                    'amount': r.amount,
                    'source': r.source,
                    'payment_id': r.payment_id,
                    'note': r.note,
                } for r in cleaned_rows
            ]})

        # POST (수기 추가)
        # 클럽 필터링
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
        
        user_id = get_jwt_identity()
        current_user = User.query.get(int(user_id)) if user_id else None
        if not current_user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'})
        
        # 슈퍼관리자 또는 시스템 관리자인지 확인
        is_system_admin = current_user.role in ['super_admin', 'admin']
        
        # 클럽별 운영진인지 확인
        is_club_admin = False
        if not is_system_admin:
            has_permission, result = check_club_permission(int(user_id), club_id, 'admin')
            if has_permission:
                is_club_admin = True
            else:
                return jsonify({'success': False, 'message': '관리자 권한이 필요합니다.'}), 403
        
        # 슈퍼관리자, 시스템 관리자, 또는 클럽별 운영진만 접근 가능

        data = request.get_json() or {}
        entry_type = data.get('entry_type')  # 'credit' or 'debit'
        amount = int(data.get('amount', 0))
        event_date_str = data.get('event_date')  # YYYY-MM-DD
        source = data.get('source', 'manual')
        note = data.get('note', '')
        if entry_type not in ('credit', 'debit'):
            return jsonify({'success': False, 'message': 'entry_type은 credit/debit 여야 합니다.'})
        if amount <= 0:
            return jsonify({'success': False, 'message': 'amount는 양수여야 합니다.'})
        try:
            event_date = datetime.strptime(event_date_str, '%Y-%m-%d').date()
        except Exception:
            return jsonify({'success': False, 'message': 'event_date는 YYYY-MM-DD 형식이어야 합니다.'})
        month = event_date.strftime('%Y-%m')
        entry = FundLedger(
            club_id=club_id,
            event_date=event_date,
            month=month,
            entry_type=entry_type,
            amount=amount,
            source=source,
            note=note,
        )
        db.session.add(entry)
        db.session.commit()
        
        # 잔액 캐시 재계산
        try:
            _calculate_fund_balance_and_chart(club_id)
        except Exception:
            pass  # 캐시 계산 실패가 전체 동작에 영향을 주지 않도록
        
        return jsonify({'success': True, 'item': {
            'id': entry.id,
            'event_date': entry.event_date.strftime('%Y-%m-%d'),
            'month': entry.month,
            'entry_type': entry.entry_type,
            'amount': entry.amount,
            'source': entry.source,
            'payment_id': entry.payment_id,
            'note': entry.note,
        }})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'장부 처리 중 오류: {str(e)}'})


@payments_bp.route('/fund/ledger/<int:ledger_id>', methods=['PUT', 'DELETE'])
@jwt_required()
def manage_fund_ledger_item(ledger_id):
    try:
        # 클럽 필터링
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
        
        user_id = get_jwt_identity()
        current_user = User.query.get(int(user_id)) if user_id else None
        if not current_user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        # 슈퍼관리자 또는 시스템 관리자인지 확인
        is_system_admin = current_user.role in ['super_admin', 'admin']
        
        # 클럽별 운영진인지 확인
        is_club_admin = False
        if not is_system_admin:
            has_permission, result = check_club_permission(int(user_id), club_id, 'admin')
            if has_permission:
                is_club_admin = True
            else:
                return jsonify({'success': False, 'message': '관리자 권한이 필요합니다.'}), 403
        
        # 슈퍼관리자, 시스템 관리자, 또는 클럽별 운영진만 접근 가능

        entry = FundLedger.query.get_or_404(ledger_id)
        
        # 수정/삭제하려는 장부 항목이 현재 클럽에 속하는지 확인
        if entry.club_id != club_id:
            return jsonify({'success': False, 'message': '다른 클럽의 장부 항목은 수정/삭제할 수 없습니다.'}), 403

        if request.method == 'DELETE':
            club_id_for_cache = entry.club_id
            db.session.delete(entry)
            db.session.commit()
            
            # 잔액 캐시 재계산
            try:
                _calculate_fund_balance_and_chart(club_id_for_cache)
            except Exception:
                pass  # 캐시 계산 실패가 전체 동작에 영향을 주지 않도록
            
            return jsonify({'success': True, 'message': '장부 항목이 삭제되었습니다.'})

        data = request.get_json() or {}

        if 'event_date' in data:
            try:
                event_date = datetime.strptime(data['event_date'], '%Y-%m-%d').date()
            except Exception:
                return jsonify({'success': False, 'message': 'event_date는 YYYY-MM-DD 형식이어야 합니다.'}), 400
            entry.event_date = event_date
            entry.month = event_date.strftime('%Y-%m')

        if 'entry_type' in data:
            entry_type = data['entry_type']
            if entry_type not in ('credit', 'debit'):
                return jsonify({'success': False, 'message': 'entry_type은 credit/debit 여야 합니다.'}), 400
            entry.entry_type = entry_type

        if 'amount' in data:
            try:
                amount = int(data['amount'])
            except Exception:
                return jsonify({'success': False, 'message': 'amount는 숫자여야 합니다.'}), 400
            if amount <= 0:
                return jsonify({'success': False, 'message': 'amount는 양수여야 합니다.'}), 400
            entry.amount = amount

        if 'note' in data:
            entry.note = (data.get('note') or '').strip()

        if 'source' in data and data['source']:
            entry.source = data['source']

        db.session.commit()
        
        # 잔액 캐시 재계산
        try:
            _calculate_fund_balance_and_chart(entry.club_id)
        except Exception:
            pass  # 캐시 계산 실패가 전체 동작에 영향을 주지 않도록
        
        return jsonify({
            'success': True,
            'item': {
                'id': entry.id,
                'event_date': entry.event_date.strftime('%Y-%m-%d') if entry.event_date else None,
                'month': entry.month,
                'entry_type': entry.entry_type,
                'amount': entry.amount,
                'source': entry.source,
                'payment_id': entry.payment_id,
                'note': entry.note,
            },
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'장부 항목 처리 중 오류: {str(e)}'}), 500


@payments_bp.route('/balance', methods=['GET', 'PUT'])
@jwt_required(optional=True)
def payment_balance():
    """회비 잔액 및 시작월 설정 조회/수정 API"""
    try:
        if request.method == 'GET':
            bal = AppSetting.query.filter_by(setting_key='fund_balance').first()
            start = AppSetting.query.filter_by(setting_key='fund_start_month').first()
            monthly_fee = AppSetting.query.filter_by(setting_key='monthly_fee_amount').first()
            balance_value = None
            try:
                balance_value = int(bal.setting_value) if bal and bal.setting_value is not None else None
            except Exception:
                balance_value = None
            monthly_fee_value = None
            try:
                monthly_fee_value = int(monthly_fee.setting_value) if monthly_fee and monthly_fee.setting_value is not None else 5000
            except Exception:
                monthly_fee_value = 5000
            return jsonify({
                'success': True,
                'balance': balance_value,
                'start_month': start.setting_value if start else None,
                'monthly_fee_amount': monthly_fee_value,
            })

        # PUT - 관리자만
        user_id = get_jwt_identity()
        current_user = User.query.get(int(user_id)) if user_id else None
        if not current_user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'})
        
        # 클럽 필터링
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
        
        # 슈퍼관리자 또는 시스템 관리자인지 확인
        is_system_admin = current_user.role in ['super_admin', 'admin']
        
        # 클럽별 운영진인지 확인
        is_club_admin = False
        if not is_system_admin:
            has_permission, result = check_club_permission(int(user_id), club_id, 'admin')
            if has_permission:
                is_club_admin = True
            else:
                return jsonify({'success': False, 'message': '관리자 권한이 필요합니다.'}), 403
        
        # 슈퍼관리자, 시스템 관리자, 또는 클럽별 운영진만 접근 가능

        data = request.get_json() or {}
        balance = data.get('balance')
        start_month = data.get('start_month')
        monthly_fee_amount = data.get('monthly_fee_amount')

        if balance is not None:
            try:
                balance = int(balance)
            except Exception:
                return jsonify({'success': False, 'message': 'balance는 숫자여야 합니다.'})
            bal = AppSetting.query.filter_by(setting_key='fund_balance').first()
            if not bal:
                bal = AppSetting(setting_key='fund_balance', setting_value=str(balance), updated_by=current_user.id)
                db.session.add(bal)
            else:
                bal.setting_value = str(balance)
                bal.updated_by = current_user.id

        if start_month is not None:
            # YYYY-MM 형식 검증 (간단)
            try:
                datetime.strptime(start_month + '-01', '%Y-%m-%d')
            except Exception:
                return jsonify({'success': False, 'message': 'start_month는 YYYY-MM 형식이어야 합니다.'})
            st = AppSetting.query.filter_by(setting_key='fund_start_month').first()
            if not st:
                st = AppSetting(setting_key='fund_start_month', setting_value=start_month, updated_by=current_user.id)
                db.session.add(st)
            else:
                st.setting_value = start_month
                st.updated_by = current_user.id

        if monthly_fee_amount is not None:
            try:
                monthly_fee_amount = int(monthly_fee_amount)
                if monthly_fee_amount <= 0:
                    return jsonify({'success': False, 'message': '월회비 금액은 0보다 커야 합니다.'})
            except Exception:
                return jsonify({'success': False, 'message': 'monthly_fee_amount는 숫자여야 합니다.'})
            mf = AppSetting.query.filter_by(setting_key='monthly_fee_amount').first()
            if not mf:
                mf = AppSetting(setting_key='monthly_fee_amount', setting_value=str(monthly_fee_amount), updated_by=current_user.id)
                db.session.add(mf)
            else:
                mf.setting_value = str(monthly_fee_amount)
                mf.updated_by = current_user.id

        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'잔액 설정 처리 중 오류: {str(e)}'})


@payments_bp.route('/fund/balance-cache', methods=['GET'])
@jwt_required(optional=True)
def get_fund_balance_cache():
    """회비 잔액 및 그래프 데이터 캐시 조회 API"""
    try:
        # 클럽 필터링
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
        
        user_id = get_jwt_identity()
        current_user = User.query.get(int(user_id)) if user_id else None
        if not current_user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'})
        
        # 슈퍼관리자 또는 시스템 관리자인지 확인
        is_system_admin = current_user.role in ['super_admin', 'admin']
        
        # 클럽별 운영진인지 확인
        is_club_admin = False
        if not is_system_admin:
            has_permission, result = check_club_permission(int(user_id), club_id, 'admin')
            if has_permission:
                is_club_admin = True
            else:
                return jsonify({'success': False, 'message': '관리자 권한이 필요합니다.'}), 403
        
        # 캐시 조회
        cache = FundBalanceCache.query.filter_by(club_id=club_id).first()
        
        if cache:
            return jsonify({
                'success': True,
                'current_balance': cache.current_balance,
                'balance_series': cache.balance_series or {},
                'last_calculated_at': cache.last_calculated_at.isoformat() if cache.last_calculated_at else None
            })
        else:
            # 캐시가 없으면 계산하여 생성
            try:
                _calculate_fund_balance_and_chart(club_id)
                cache = FundBalanceCache.query.filter_by(club_id=club_id).first()
                if cache:
                    return jsonify({
                        'success': True,
                        'current_balance': cache.current_balance,
                        'balance_series': cache.balance_series or {},
                        'last_calculated_at': cache.last_calculated_at.isoformat() if cache.last_calculated_at else None
                    })
            except Exception as calc_error:
                print(f'캐시 계산 오류: {str(calc_error)}')
            
            # 계산 실패 시 빈 데이터 반환
            return jsonify({
                'success': True,
                'current_balance': 0,
                'balance_series': {
                    'labels': [],
                    'data': [],
                    'paymentBalances': [],
                    'credits': [],
                    'debits': [],
                    'pointBalances': []
                },
                'last_calculated_at': None
            })
    except Exception as e:
        return jsonify({'success': False, 'message': f'잔액 캐시 조회 중 오류가 발생했습니다: {str(e)}'})

