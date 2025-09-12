from flask import Blueprint, request, jsonify
from datetime import datetime
from models import db, Member, Point

# 포인트 관리 Blueprint
points_bp = Blueprint('points', __name__, url_prefix='/api/points')

@points_bp.route('/', methods=['GET'])
def get_points():
    """포인트 목록 조회 API"""
    try:
        # 시간순으로 정렬하여 잔여 포인트를 정확하게 계산
        points = Point.query.order_by(Point.point_date.asc(), Point.created_at.asc()).all()
        points_data = []
        
        # 회원별 잔여 포인트 계산 (시간순으로 누적)
        member_balances = {}
        
        for point in points:
            member = Member.query.get(point.member_id)
            member_name = member.name if member else 'Unknown'
            
            # 회원별 잔여 포인트 초기화
            if member_name not in member_balances:
                member_balances[member_name] = 0
            
            # 포인트 유형에 따라 잔여 포인트 계산
            if point.point_type in ['적립', '보너스']:
                member_balances[member_name] += point.amount
            else:
                member_balances[member_name] -= point.amount
            
            points_data.append({
                'id': point.id,
                'member_name': member_name,
                'member_id': point.member_id,
                'point_type': point.point_type,
                'amount': point.amount,
                'reason': point.reason,
                'note': point.note,
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
        data = request.get_json()
        
        member_name = data.get('member_name', '').strip() if data.get('member_name') else ''
        if not member_name:
            return jsonify({'success': False, 'message': '회원 이름은 필수 입력 항목입니다.'})
        
        member = Member.query.filter_by(name=member_name).first()
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
        
        new_point = Point(
            member_id=member.id,
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
def delete_point(point_id):
    """포인트 삭제 API"""
    try:
        point = Point.query.get_or_404(point_id)
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

@points_bp.route('/<int:point_id>/', methods=['PUT'])
def update_point(point_id):
    """포인트 수정 API"""
    try:
        data = request.get_json()
        
        member_name = data.get('member_name', '').strip() if data.get('member_name') else ''
        if not member_name:
            return jsonify({'success': False, 'message': '회원 이름을 입력해주세요.'})
        
        member = Member.query.filter_by(name=member_name).first()
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
        
        point = Point.query.get_or_404(point_id)
        
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
