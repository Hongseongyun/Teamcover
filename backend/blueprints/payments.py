from flask import Blueprint, request, jsonify, make_response
from datetime import datetime, timedelta
from models import db, Member, Payment, User, Point, AppSetting, FundLedger, FundState
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.orm import joinedload
from utils.club_helpers import get_current_club_id, require_club_membership, check_club_permission

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

        # 포인트 자동 차감 처리: 정기전(game) + 납입완료 + 포인트로 납부 + 면제 아님
        try:
            should_create_point = (
                new_payment.payment_type == 'game'
                and new_payment.is_paid is True
                and new_payment.is_exempt is False
                and new_payment.paid_with_points is True
            )
            if should_create_point:
                point = Point(
                    member_id=new_payment.member_id,
                    point_type='사용',
                    amount=abs(new_payment.amount),  # 사용은 양수 저장, 계산 시 차감
                    reason='정기전 게임비',
                    point_date=new_payment.payment_date,
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
                payment.payment_type == 'game'
                and payment.is_paid is True
                and payment.is_exempt is False
                and payment.paid_with_points is True
            )

            if should_have_point and linked_point is None:
                # 새로 생성
                new_point = Point(
                    member_id=payment.member_id,
                    point_type='사용',
                    amount=abs(payment.amount),
                    reason='정기전 게임비',
                    point_date=payment.payment_date,
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
                needs_update = (
                    (payment.payment_date != prev_payment_date)
                    or (abs(payment.amount) != linked_point.amount)
                )
                if needs_update:
                    linked_point.point_date = payment.payment_date
                    linked_point.amount = abs(payment.amount)
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


# 내부 유틸: 결제-장부 동기화
def _sync_payment_to_ledger(payment: Payment):
    """결제 레코드를 장부에 반영/삭제한다."""
    # 결제 반영 조건: 납입완료 + 면제 아님
    should_exist = (
        bool(payment.is_paid)
        and not bool(payment.is_exempt)
        and not (
            payment.payment_type == 'game' and bool(payment.paid_with_points)
        )
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

            # 과거 데이터 보정: 포인트 납부 정기전 게임비 제거 & 입금 처리 유지
            game_payment_ids = [
                row.payment_id for row in rows if row.source == 'game' and row.payment_id
            ]
            paid_with_points_ids = set()
            if game_payment_ids:
                paid_with_points_payments = Payment.query.filter(
                    Payment.id.in_(game_payment_ids),
                    Payment.paid_with_points.is_(True),
                ).all()
                paid_with_points_ids = {p.id for p in paid_with_points_payments}

            entries_updated = False
            cleaned_rows = []
            for row in rows:
                if row.source == 'game':
                    if row.payment_id in paid_with_points_ids:
                        db.session.delete(row)
                        entries_updated = True
                        continue
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
        if not current_user or current_user.role not in ['super_admin', 'admin']:
            return jsonify({'success': False, 'message': '관리자 권한이 필요합니다.'}), 403
        
        # 슈퍼관리자는 가입 여부 확인 생략, 일반 사용자는 가입 확인 필요
        is_super_admin = current_user.role == 'super_admin'
        if not is_super_admin:
            has_permission, result = check_club_permission(int(user_id), club_id, 'admin')
            if not has_permission:
                return jsonify({'success': False, 'message': result}), 403

        entry = FundLedger.query.get_or_404(ledger_id)
        
        # 수정/삭제하려는 장부 항목이 현재 클럽에 속하는지 확인
        if entry.club_id != club_id:
            return jsonify({'success': False, 'message': '다른 클럽의 장부 항목은 수정/삭제할 수 없습니다.'}), 403

        if request.method == 'DELETE':
            db.session.delete(entry)
            db.session.commit()
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
            balance_value = None
            try:
                balance_value = int(bal.setting_value) if bal and bal.setting_value is not None else None
            except Exception:
                balance_value = None
            return jsonify({
                'success': True,
                'balance': balance_value,
                'start_month': start.setting_value if start else None,
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

        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'잔액 설정 처리 중 오류: {str(e)}'})

