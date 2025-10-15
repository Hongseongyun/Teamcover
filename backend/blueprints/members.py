from flask import Blueprint, request, jsonify, make_response, session
from datetime import datetime, timedelta
from models import db, Member, Score, User, AppSetting
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.security import check_password_hash

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
@jwt_required(optional=True)
def get_members():
    """회원 목록 조회 API"""
    try:
        # 기본적으로 개인정보 마스킹
        hide_privacy = True
        
        # JWT 토큰에서 사용자 정보 가져오기
        current_user_obj = None
        try:
            user_id = get_jwt_identity()
            if user_id:
                current_user_obj = User.query.get(int(user_id))
        except:
            pass
        
        # 슈퍼관리자인 경우 개인정보 보호 비밀번호 검증 확인
        if current_user_obj and current_user_obj.role == 'super_admin':
            print(f"슈퍼관리자 확인: {current_user_obj.email}")
            # 전역 개인정보 보호 비밀번호 설정 확인
            privacy_setting = AppSetting.query.filter_by(setting_key='privacy_password').first()
            if not privacy_setting or not privacy_setting.setting_value:
                # 비밀번호가 설정되지 않은 경우 원본 데이터 허용
                print("개인정보 보호 비밀번호가 설정되지 않음 - 원본 데이터 허용")
                hide_privacy = False
            else:
                print("개인정보 보호 비밀번호가 설정됨 - 세션 확인")
                # 세션에서 개인정보 접근 허용 상태 확인
                privacy_access_granted = session.get('privacy_access_granted', False)
                privacy_access_user_id = session.get('privacy_access_user_id')
                
                print(f"세션 상태 - 접근허용: {privacy_access_granted}, 사용자ID: {privacy_access_user_id}, 현재사용자ID: {current_user_obj.id}")
                
                # 현재 사용자와 세션의 사용자가 일치하는지 확인
                if privacy_access_granted and privacy_access_user_id == current_user_obj.id:
                    # 접근 시간 확인 (30분 유효)
                    access_time_str = session.get('privacy_access_time')
                    if access_time_str:
                        try:
                            access_time = datetime.fromisoformat(access_time_str)
                            if datetime.utcnow() - access_time < timedelta(minutes=30):
                                print("세션 유효 - 원본 데이터 허용")
                                hide_privacy = False  # 원본 데이터 허용
                            else:
                                print("세션 만료 - 세션 정리")
                                # 시간 만료된 경우 세션 정리
                                session.pop('privacy_access_granted', None)
                                session.pop('privacy_access_user_id', None)
                                session.pop('privacy_access_time', None)
                                hide_privacy = True
                        except:
                            print("세션 시간 파싱 오류")
                            hide_privacy = True
                    else:
                        print("세션 시간 정보 없음")
                        hide_privacy = True
                else:
                    print("세션 불일치 또는 접근 허용 안됨")
                    hide_privacy = True  # 기본적으로 마스킹
        
        members = Member.query.order_by(Member.name.asc()).all()
        members_data = [member.to_dict(hide_privacy=hide_privacy) for member in members]
        
        print(f"최종 hide_privacy 상태: {hide_privacy}")
        if members_data and len(members_data) > 0:
            print(f"첫 번째 회원 전화번호 예시: {members_data[0].get('phone', 'None')}")
        
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

@members_bp.route('/privacy-verify/', methods=['POST'])
@jwt_required()
def verify_privacy_access():
    """개인정보 보호 비밀번호 검증 API"""
    try:
        user_id = get_jwt_identity()
        current_user_obj = User.query.get(int(user_id))
        
        if not current_user_obj:
            return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다.'})
        
        if current_user_obj.role != 'super_admin':
            return jsonify({'success': False, 'message': '슈퍼관리자만 접근 가능합니다.'})
        
        data = request.get_json()
        password = data.get('password', '')
        
        if not password:
            return jsonify({'success': False, 'message': '비밀번호를 입력해주세요.'})
        
        # 전역 개인정보 보호 비밀번호 검증
        privacy_setting = AppSetting.query.filter_by(setting_key='privacy_password').first()
        if not privacy_setting or not privacy_setting.setting_value:
            return jsonify({'success': False, 'message': '개인정보 보호 비밀번호가 설정되지 않았습니다.'})
        
        if check_password_hash(privacy_setting.setting_value, password):
            # 세션에 개인정보 접근 허용 상태 저장 (30분간 유효)
            # 사용자 ID도 함께 저장하여 다른 사용자와 구분
            session['privacy_access_granted'] = True
            session['privacy_access_user_id'] = current_user_obj.id
            session['privacy_access_time'] = datetime.utcnow().isoformat()
            session.permanent = True
            
            return jsonify({
                'success': True, 
                'message': '개인정보 접근이 허용되었습니다.',
                'access_granted': True
            })
        else:
            return jsonify({'success': False, 'message': '비밀번호가 올바르지 않습니다.'})
            
    except Exception as e:
        return jsonify({'success': False, 'message': f'비밀번호 검증 중 오류가 발생했습니다: {str(e)}'})

@members_bp.route('/privacy-status/', methods=['GET'])
@jwt_required(optional=True)
def check_privacy_status():
    """개인정보 보호 상태 확인 API"""
    try:
        user_id = get_jwt_identity()
        current_user_obj = None
        if user_id:
            current_user_obj = User.query.get(int(user_id))
        
        # 기본적으로 마스킹된 상태
        privacy_unlocked = False
        
        if current_user_obj and current_user_obj.role == 'super_admin':
            # 전역 개인정보 보호 비밀번호 설정 확인
            privacy_setting = AppSetting.query.filter_by(setting_key='privacy_password').first()
            if not privacy_setting or not privacy_setting.setting_value:
                # 비밀번호가 설정되지 않은 경우 자동으로 해제
                privacy_unlocked = True
            else:
                # 세션에서 개인정보 접근 허용 상태 확인
                privacy_access_granted = session.get('privacy_access_granted', False)
                privacy_access_user_id = session.get('privacy_access_user_id')
                
                # 현재 사용자와 세션의 사용자가 일치하는지 확인
                if privacy_access_granted and privacy_access_user_id == current_user_obj.id:
                    # 접근 시간 확인 (30분 유효)
                    access_time_str = session.get('privacy_access_time')
                    if access_time_str:
                        try:
                            access_time = datetime.fromisoformat(access_time_str)
                            if datetime.utcnow() - access_time < timedelta(minutes=30):
                                privacy_unlocked = True
                            else:
                                # 시간 만료된 경우 세션 정리
                                session.pop('privacy_access_granted', None)
                                session.pop('privacy_access_user_id', None)
                                session.pop('privacy_access_time', None)
                                privacy_unlocked = False
                        except:
                            privacy_unlocked = False
                    else:
                        privacy_unlocked = False
                else:
                    privacy_unlocked = False
        
        return jsonify({
            'success': True,
            'privacy_unlocked': privacy_unlocked
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'개인정보 보호 상태 확인 중 오류가 발생했습니다: {str(e)}'})

