from flask import Blueprint, request, jsonify, make_response
from datetime import datetime
from models import db, Member, Score

# 회원 관리 Blueprint
members_bp = Blueprint('members', __name__, url_prefix='/api/members')

@members_bp.before_request
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

@members_bp.route('/', methods=['GET'])
def get_members():
    """회원 목록 조회 API"""
    try:
        # 기본적으로 개인정보 마스킹 (프론트엔드에서 개인정보 보호 비밀번호 검증 후 처리)
        hide_privacy = True
        
        members = Member.query.order_by(Member.name.asc()).all()
        members_data = [member.to_dict(hide_privacy=hide_privacy) for member in members]
        
        total_members = len(members)
        new_members = len([m for m in members if (datetime.utcnow() - m.created_at).days <= 30])
        male_count = len([m for m in members if m.gender == '남'])
        female_count = len([m for m in members if m.gender == '여'])
        
        level_counts = {}
        for member in members:
            level = member.level or '미정'
            level_counts[level] = level_counts.get(level, 0) + 1
        
        return jsonify({
            'success': True,
            'members': members_data,
            'stats': {
                'total_members': total_members,
                'new_members': new_members,
                'male_count': male_count,
                'female_count': female_count,
                'level_counts': level_counts
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'회원 목록 조회 중 오류가 발생했습니다: {str(e)}'})

@members_bp.route('/', methods=['POST'])
def add_member():
    """회원 등록 API"""
    try:
        print("회원 등록 API 호출됨")
        data = request.get_json()
        print(f"받은 데이터: {data}")
        
        if not data:
            return jsonify({'success': False, 'message': '요청 데이터가 없습니다.'})
        
        name = data.get('name', '').strip()
        print(f"이름: '{name}'")
        if not name:
            return jsonify({'success': False, 'message': '이름은 필수 입력 항목입니다.'})
        
        print("중복 검사 시작")
        existing_member = Member.query.filter_by(name=name).first()
        if existing_member:
            print(f"중복 회원 발견: {existing_member}")
            return jsonify({'success': False, 'message': '이미 등록된 회원입니다.'})
        
        print("새 회원 객체 생성")
        new_member = Member(
            name=name,
            phone=data.get('phone', '').strip(),
            gender=data.get('gender', '').strip(),
            level=data.get('level', '').strip(),
            email=data.get('email', '').strip(),
            note=data.get('note', '').strip()
        )
        print(f"생성된 회원 객체: {new_member}")
        
        print("데이터베이스에 추가 시작")
        db.session.add(new_member)
        print("커밋 시작")
        db.session.commit()
        print("커밋 완료")
        
        result = {
            'success': True, 
            'message': f'{name} 회원이 등록되었습니다.',
            'member': new_member.to_dict()
        }
        print(f"응답 데이터: {result}")
        return jsonify(result)
        
    except Exception as e:
        print(f"에러 발생: {str(e)}")
        print(f"에러 타입: {type(e)}")
        import traceback
        print(f"스택 트레이스: {traceback.format_exc()}")
        db.session.rollback()
        return jsonify({'success': False, 'message': f'회원 등록 중 오류가 발생했습니다: {str(e)}'})

@members_bp.route('/<int:member_id>/', methods=['PUT'])
@members_bp.route('/<int:member_id>', methods=['PUT'])
def update_member(member_id):
    """회원 정보 수정 API"""
    try:
        print(f"회원 수정 API 호출됨 - ID: {member_id}")
        data = request.get_json()
        print(f"받은 데이터: {data}")
        
        if not data:
            return jsonify({'success': False, 'message': '요청 데이터가 없습니다.'})
        
        member = Member.query.get_or_404(member_id)
        print(f"찾은 회원: {member}")
        
        name = data.get('name', '').strip()
        print(f"수정할 이름: '{name}'")
        if not name:
            return jsonify({'success': False, 'message': '이름은 필수 입력 항목입니다.'})
        
        existing_member = Member.query.filter_by(name=name).filter(Member.id != member_id).first()
        if existing_member:
            print(f"중복 회원 발견: {existing_member}")
            return jsonify({'success': False, 'message': '이미 등록된 회원입니다.'})
        
        print("회원 정보 업데이트 시작")
        member.name = name
        member.phone = data.get('phone', '').strip()
        member.gender = data.get('gender', '').strip()
        member.level = data.get('level', '').strip()
        member.email = data.get('email', '').strip()
        member.note = data.get('note', '').strip()
        member.updated_at = datetime.utcnow()
        
        print("데이터베이스 커밋 시작")
        db.session.commit()
        print("커밋 완료")
        
        result = {
            'success': True, 
            'message': f'{name} 회원 정보가 수정되었습니다.',
            'member': member.to_dict()
        }
        print(f"응답 데이터: {result}")
        return jsonify(result)
        
    except Exception as e:
        print(f"에러 발생: {str(e)}")
        print(f"에러 타입: {type(e)}")
        import traceback
        print(f"스택 트레이스: {traceback.format_exc()}")
        db.session.rollback()
        return jsonify({'success': False, 'message': f'회원 정보 수정 중 오류가 발생했습니다: {str(e)}'})

@members_bp.route('/<int:member_id>/', methods=['DELETE'])
@members_bp.route('/<int:member_id>', methods=['DELETE'])
def delete_member(member_id):
    """회원 삭제 API"""
    try:
        member = Member.query.get_or_404(member_id)
        member_name = member.name
        
        db.session.delete(member)
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': f'{member_name} 회원이 삭제되었습니다.'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'회원 삭제 중 오류가 발생했습니다: {str(e)}'})

@members_bp.route('/<int:member_id>/average/', methods=['GET'])
def get_member_average(member_id):
    """회원별 에버 계산 API - 6월 이후 기록 우선, 없으면 6월 이전 기록"""
    try:
        member = Member.query.get_or_404(member_id)
        
        june_first = datetime(2025, 6, 1).date()
        
        recent_scores = Score.query.filter(
            Score.member_id == member_id,
            Score.game_date >= june_first
        ).all()
        
        if recent_scores:
            total_average = sum(score.average_score for score in recent_scores if score.average_score)
            count = len([s for s in recent_scores if s.average_score])
            if count > 0:
                average = round(total_average / count, 1)
                return jsonify({
                    'success': True,
                    'average': average,
                    'score_count': count,
                    'period': '6월 이후',
                    'message': f'{member.name}의 6월 이후 에버: {average} (총 {count}회)'
                })
        
        all_scores = Score.query.filter_by(member_id=member_id).all()
        if all_scores:
            total_average = sum(score.average_score for score in all_scores if score.average_score)
            count = len([s for s in all_scores if s.average_score])
            if count > 0:
                average = round(total_average / count, 1)
                return jsonify({
                    'success': True,
                    'average': average,
                    'score_count': count,
                    'period': '전체 기간',
                    'message': f'{member.name}의 전체 기간 에버: {average} (총 {count}회)'
                })
        
        return jsonify({
            'success': False,
            'message': f'{member.name}의 스코어 기록이 없습니다.',
            'average': None
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'에버 계산 중 오류가 발생했습니다: {str(e)}'})

@members_bp.route('/averages/', methods=['GET'])
def get_all_members_averages():
    """모든 회원의 에버를 일괄 조회하는 API"""
    try:
        members = Member.query.all()
        members_with_averages = []
        
        for member in members:
            june_first = datetime(2025, 6, 1).date()
            
            recent_scores = Score.query.filter(
                Score.member_id == member.id,
                Score.game_date >= june_first
            ).all()
            
            average = None
            score_count = 0
            period = '기록 없음'
            
            if recent_scores:
                total_average = sum(score.average_score for score in recent_scores if score.average_score)
                count = len([s for s in recent_scores if s.average_score])
                if count > 0:
                    average = round(total_average / count, 1)
                    score_count = count
                    period = '6월 이후'
            else:
                all_scores = Score.query.filter_by(member_id=member.id).all()
                if all_scores:
                    total_average = sum(score.average_score for score in all_scores if score.average_score)
                    count = len([s for s in all_scores if s.average_score])
                    if count > 0:
                        average = round(total_average / count, 1)
                        score_count = count
                        period = '전체 기간'
            
            members_with_averages.append({
                'id': member.id,
                'name': member.name,
                'gender': member.gender,
                'level': member.level,
                'average': average,
                'score_count': score_count,
                'period': period
            })
        
        return jsonify({
            'success': True,
            'members': members_with_averages
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'회원별 에버 조회 중 오류가 발생했습니다: {str(e)}'})

