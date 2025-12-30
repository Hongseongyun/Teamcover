"""회비 및 포인트 스냅샷 관련 유틸리티 함수"""
from datetime import datetime, date
from models import db, Member, Point, FundLedger, FundBalanceSnapshot


def update_current_month_snapshot(club_id):
    """현재 진행 중인 월의 스냅샷만 업데이트 (장부나 포인트 변경 시 호출)"""
    try:
        # Teamcover가 아닌 클럽은 계산하지 않음
        from models import Club
        club = Club.query.get(club_id)
        if not club or club.name != 'Teamcover':
            return

        # 현재 월 계산
        current_date = datetime.utcnow()
        current_month = current_date.strftime('%Y-%m')

        # 장부 항목 조회 (현재 월 포함 이전 모든 데이터)
        ledger_items = FundLedger.query.filter_by(club_id=club_id).order_by(FundLedger.event_date.asc()).all()
        
        if not ledger_items:
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
            # 프론트엔드와 동일하게 계산: API의 display_amount 로직 적용
            # PAYMENT 링크 확인 (프론트엔드와 동일)
            is_payment_linked = point.note and isinstance(point.note, str) and point.note.startswith('PAYMENT:')
            display_point_type = '사용' if is_payment_linked else point.point_type
            # display_amount 계산 (프론트엔드 API와 동일)
            amount_value = int(point.amount) if point.amount is not None else 0
            if display_point_type in ['적립', '보너스']:
                display_amount = amount_value
            else:
                display_amount = -abs(amount_value)
            monthly_point_data[month_key] += display_amount

        # 모든 월 목록
        all_data_months = sorted(set(list(monthly_data.keys()) + list(monthly_point_data.keys())))
        if not all_data_months:
            return

        # 초기 잔액 계산
        first_month = all_data_months[0]
        first_month_items = [item for item in ledger_items if item.month == first_month]
        initial_balance = 0
        if first_month_items:
            first_item = first_month_items[0]
            if first_item.source == 'manual' and first_item.note and ('잔여 회비' in first_item.note or '잔여' in first_item.note):
                initial_balance = int(first_item.amount) or 0
                if first_item.entry_type == 'credit':
                    monthly_data[first_month]['credit'] -= initial_balance
                elif first_item.entry_type == 'debit':
                    monthly_data[first_month]['debit'] -= initial_balance

        # 11월부터 시작 (10월 제외)
        start_month = '2025-11'
        months_to_display = [m for m in all_data_months if m >= start_month]

        # 10월의 잔액을 계산하여 초기 잔액에 포함
        october_month = '2025-10'
        if october_month in all_data_months:
            october_data = monthly_data.get(october_month, {'credit': 0, 'debit': 0})
            october_net_change = october_data['credit'] - october_data['debit']
            initial_balance += october_net_change

        # 현재 월까지의 잔액 계산
        running_balance = initial_balance
        for month_key in months_to_display:
            if month_key > current_month:
                break
            month_data = monthly_data.get(month_key, {'credit': 0, 'debit': 0})
            net_change = month_data['credit'] - month_data['debit']
            running_balance += net_change

        # 현재 월의 데이터
        month_data = monthly_data.get(current_month, {'credit': 0, 'debit': 0})

        # 현재 월 말일까지의 포인트 누적 잔액 계산
        year, month = map(int, current_month.split('-'))
        from calendar import monthrange
        last_day = monthrange(year, month)[1]
        month_end_date = datetime(year, month, last_day, 23, 59, 59)

        point_balance_for_month = 0
        points_counted = 0
        for point in points:
            member = Member.query.get(point.member_id) if point.member_id else None
            if not member or member.name not in active_member_names:
                continue
            
            # 포인트 날짜 처리: point_date 우선, 없으면 created_at 사용
            point_date = point.point_date or point.created_at
            if point_date is None:
                continue
            
            # 날짜를 datetime 객체로 통일
            if isinstance(point_date, str):
                point_date = datetime.strptime(point_date, '%Y-%m-%d')
            elif isinstance(point_date, date) and not isinstance(point_date, datetime):
                # date 객체를 datetime으로 변환
                point_date = datetime.combine(point_date, datetime.min.time())
            elif isinstance(point_date, datetime):
                # datetime 객체는 그대로 사용
                pass
            else:
                continue
            
            if point_date <= month_end_date:
                # 프론트엔드와 동일하게 계산: API의 display_amount 로직 적용
                # PAYMENT 링크 확인 (프론트엔드와 동일)
                is_payment_linked = point.note and isinstance(point.note, str) and point.note.startswith('PAYMENT:')
                display_point_type = '사용' if is_payment_linked else point.point_type
                # display_amount 계산 (프론트엔드 API와 동일)
                amount_value = int(point.amount) if point.amount is not None else 0
                if display_point_type in ['적립', '보너스']:
                    display_amount = amount_value
                else:
                    display_amount = -abs(amount_value)
                point_balance_for_month += display_amount
                points_counted += 1
        
        # 디버깅 로그 (필요시 주석 해제)
        # print(f'[스냅샷] 클럽 {club_id}, 월 {current_month}: 포인트 잔액={point_balance_for_month}, 계산된 포인트 수={points_counted}, 전체 포인트 수={len(points)}')

        # 현재 월 스냅샷 저장 또는 업데이트
        snapshot = FundBalanceSnapshot.query.filter_by(
            club_id=club_id,
            month=current_month
        ).first()
        
        if snapshot:
            snapshot.fund_balance = running_balance
            snapshot.point_balance = point_balance_for_month
            snapshot.credit = month_data['credit']
            snapshot.debit = month_data['debit']
            snapshot.updated_at = datetime.utcnow()
        else:
            snapshot = FundBalanceSnapshot(
                club_id=club_id,
                month=current_month,
                fund_balance=running_balance,
                point_balance=point_balance_for_month,
                credit=month_data['credit'],
                debit=month_data['debit']
            )
            db.session.add(snapshot)
        
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f'현재 월 스냅샷 업데이트 오류: {str(e)}')
        # 오류가 발생해도 기존 동작에 영향을 주지 않도록 함

