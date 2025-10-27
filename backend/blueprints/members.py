from flask import Blueprint, request, jsonify, make_response, session
from datetime import datetime, timedelta
from models import db, Member, Score, User, AppSetting
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.security import check_password_hash
from sqlalchemy import text

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
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization,X-Requested-With,X-Privacy-Token")
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
        except Exception as e:
            pass
        
        # 관리자(슈퍼관리자 또는 운영진)인 경우 개인정보 보호 비밀번호 검증 확인
        if current_user_obj and current_user_obj.role in ['super_admin', 'admin']:
            # 전역 개인정보 보호 비밀번호 설정 확인
            privacy_setting = AppSetting.query.filter_by(setting_key='privacy_password').first()
            if not privacy_setting or not privacy_setting.setting_value:
                # 비밀번호가 설정되지 않은 경우 원본 데이터 허용
                hide_privacy = False
            else:
                # 헤더에서 개인정보 접근 토큰 확인
                privacy_token = request.headers.get('X-Privacy-Token')
                if privacy_token:
                    try:
                        from flask_jwt_extended import decode_token
                        import time
                        # 개인정보 접근 토큰 디코딩
                        decoded_token = decode_token(privacy_token)
                        jwt_claims = decoded_token
                        privacy_access_granted = jwt_claims.get('privacy_access_granted', False)
                        user_role = jwt_claims.get('user_role')
                        exp_time = jwt_claims.get('exp', 0)
                        current_time = int(time.time())
                        
                        # 토큰 사용자 ID와 현재 사용자 ID 비교
                        token_user_id = jwt_claims.get('sub', '')
                        current_user_id = str(current_user_obj.id)
                        
                        # 토큰 만료 시간 체크 및 사용자 ID 체크
                        if current_time >= exp_time:
                            hide_privacy = True  # 기본적으로 마스킹
                        elif token_user_id != current_user_id:
                            hide_privacy = True  # 기본적으로 마스킹
                        elif privacy_access_granted and user_role in ['super_admin', 'admin']:
                            hide_privacy = False  # 원본 데이터 허용
                        else:
                            hide_privacy = True  # 기본적으로 마스킹
                    except Exception as e:
                        hide_privacy = True  # 기본적으로 마스킹
                else:
                    hide_privacy = True  # 기본적으로 마스킹
        
        members = Member.query.order_by(Member.name.asc()).all()
        members_data = [member.to_dict(hide_privacy=hide_privacy) for member in members]
        
        # 안전망: hide_privacy=True일 때 강제 마스킹 적용
        if hide_privacy:
            for member_data in members_data:
                # 전화번호 강제 마스킹
                if member_data.get('phone'):
                    member_data['phone'] = '***-****-****'
                # 이메일 강제 마스킹
                if member_data.get('email'):
                    email = member_data['email']
                    if '@' in email:
                        local, domain = email.split('@', 1)
                        if local and domain:
                            member_data['email'] = f'{local[0]}***@{domain}'
                        else:
                            member_data['email'] = '***@***'
                    else:
                        member_data['email'] = '***@***'
        else:
            pass
        
        total_members = len(members)
        # 신규 회원: 가입 후 30일 이내 (join_date 우선, 없으면 created_at)
        now = datetime.utcnow().date()
        def is_new_member(member):
            if member.join_date:
                days_since_join = (now - member.join_date).days
                return days_since_join <= 30
            else:
                days_since_created = (datetime.utcnow() - member.created_at).days
                return days_since_created <= 30
        
        new_members = len([m for m in members if is_new_member(m)])
        male_count = len([m for m in members if m.gender == '남'])
        female_count = len([m for m in members if m.gender == '여'])
        
        level_counts = {}
        tier_counts = {}
        for member in members:
            level = member.level or '미정'
            level_counts[level] = level_counts.get(level, 0) + 1
            
            # 티어가 없으면 점수 기반으로 계산
            if not member.tier:
                member.tier = member.calculate_tier_from_score()
            tier = member.tier or '미정'
            tier_counts[tier] = tier_counts.get(tier, 0) + 1
        
        return jsonify({
            'success': True,
            'members': members_data,
            'stats': {
                'total_members': total_members,
                'new_members': new_members,
                'male_count': male_count,
                'female_count': female_count,
                'level_counts': level_counts,  # 레거시 호환성
                'tier_counts': tier_counts
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'회원 목록 조회 중 오류가 발생했습니다: {str(e)}'})

@members_bp.route('/', methods=['POST'])
def add_member():
    """회원 등록 API"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': '요청 데이터가 없습니다.'})
        
        name = data.get('name', '').strip()
        if not name:
            return jsonify({'success': False, 'message': '이름은 필수 입력 항목입니다.'})
        
        existing_member = Member.query.filter_by(name=name).first()
        if existing_member:
            return jsonify({'success': False, 'message': '이미 등록된 회원입니다.'})
        
        # 운영진 여부 확인 (admin/super_admin만 설정 가능)
        user_id = get_jwt_identity()
        is_staff = False
        if user_id:
            current_user = User.query.get(int(user_id))
            if current_user and current_user.role in ['admin', 'super_admin']:
                is_staff = data.get('is_staff', False)
        
        new_member = Member(
            name=name,
            phone=data.get('phone', '').strip(),
            gender=data.get('gender', '').strip(),
            level=data.get('level', '').strip(),  # 레거시 호환성
            tier=data.get('tier', '').strip(),
            email=data.get('email', '').strip(),
            note=data.get('note', '').strip(),
            is_staff=is_staff
        )
        
        db.session.add(new_member)
        db.session.commit()
        
        result = {
            'success': True, 
            'message': f'{name} 회원이 등록되었습니다.',
            'member': new_member.to_dict()
        }
        return jsonify(result)
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'회원 등록 중 오류가 발생했습니다: {str(e)}'})

@members_bp.route('/<int:member_id>/', methods=['PUT'])
@members_bp.route('/<int:member_id>', methods=['PUT'])
@jwt_required()
def update_member(member_id):
    """회원 정보 수정 API"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': '요청 데이터가 없습니다.'})
        
        member = Member.query.get_or_404(member_id)
        
        name = data.get('name', '').strip()
        if not name:
            return jsonify({'success': False, 'message': '이름은 필수 입력 항목입니다.'})
        
        existing_member = Member.query.filter_by(name=name).filter(Member.id != member_id).first()
        if existing_member:
            return jsonify({'success': False, 'message': '이미 등록된 회원입니다.'})
        
        # 현재 사용자 확인
        user_id = get_jwt_identity()
        current_user = User.query.get(int(user_id))
        
        print(f"[DEBUG] Received data: {data}")
        print(f"[DEBUG] User ID: {user_id}, Current User: {current_user.name if current_user else None}, Role: {current_user.role if current_user else None}")
        print(f"[DEBUG] is_staff from request: {data.get('is_staff')}")
        
        member.name = name
        member.phone = data.get('phone', '').strip()
        member.gender = data.get('gender', '').strip()
        member.level = data.get('level', '').strip()  # 레거시 호환성
        member.tier = data.get('tier', '').strip()
        member.email = data.get('email', '').strip()
        member.note = data.get('note', '').strip()
        
        # 가입일 업데이트
        if 'join_date' in data and data['join_date']:
            try:
                member.join_date = datetime.strptime(data['join_date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'success': False, 'message': '올바른 날짜 형식이 아닙니다. (YYYY-MM-DD)'})
        
        # 운영진 여부 업데이트 (admin/super_admin만 수정 가능)
        if current_user and current_user.role in ['admin', 'super_admin']:
            is_staff_value = data.get('is_staff', False)
            print(f"[DEBUG] Setting is_staff to: {is_staff_value}")
            member.is_staff = is_staff_value
        else:
            print(f"[DEBUG] User doesn't have permission to update is_staff")
        
        member.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        result = {
            'success': True, 
            'message': f'{name} 회원 정보가 수정되었습니다.',
            'member': member.to_dict()
        }
        return jsonify(result)
        
    except Exception as e:
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
    """회원별 에버 조회 API - 저장된 평균 점수 반환"""
    try:
        member = Member.query.get(member_id)
        if not member:
            return jsonify({
                'success': False,
                'message': f'회원 ID {member_id}를 찾을 수 없습니다.'
            })
        
        # 저장된 평균 점수 사용 (없으면 계산하여 업데이트)
        if member.average_score is None:
            calculated_avg = member.calculate_regular_season_average()
            if calculated_avg is not None:
                member.average_score = calculated_avg  # 이미 자연수로 반올림됨
                member.tier = member.calculate_tier_from_score()
                db.session.commit()
        
        if member.average_score is not None:
            return jsonify({
                'success': True,
                'average': member.average_score,
                'tier': member.tier or '배치',
                'message': f'{member.name}의 평균 점수: {member.average_score}'
            })
        
        return jsonify({
            'success': False,
            'message': f'{member.name}의 정기전 기록이 없습니다.'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'평균 점수 조회 중 오류가 발생했습니다: {str(e)}'})

@members_bp.route('/update-averages/', methods=['POST'])
@jwt_required()
def update_all_member_averages():
    """모든 회원의 평균 점수를 일괄 업데이트하는 API (관리자 전용)"""
    try:
        # 현재 사용자 확인
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if not current_user or current_user.role not in ['admin', 'super_admin']:
            return jsonify({'success': False, 'message': '관리자 권한이 필요합니다.'})
        
        # 모든 회원 조회
        members = Member.query.all()
        updated_count = 0
        
        for member in members:
            # 평균 점수 계산
            average_score = member.calculate_regular_season_average()
            
            if average_score is not None:
                # 평균 점수 저장 (이미 자연수로 반올림됨)
                member.average_score = average_score
                
                # 티어 업데이트 (average_score 기반)
                member.tier = member.calculate_tier_from_score()
                
                updated_count += 1
            else:
                # 평균 점수가 없으면 티어를 배치로 설정
                member.tier = '배치'
        
        # 데이터베이스에 저장
        db.session.commit()
        
        # 디버깅을 위한 상세 정보
        debug_info = []
        for member in members[:5]:  # 처음 5명만 디버깅 정보에 포함
            debug_info.append({
                'name': member.name,
                'average_score': member.average_score,
                'tier': member.tier
            })
        
        return jsonify({
            'success': True,
            'message': f'평균 점수 업데이트 완료! {updated_count}명의 회원이 업데이트되었습니다.',
            'updated_count': updated_count,
            'total_members': len(members),
            'debug_info': debug_info
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'평균 점수 업데이트 중 오류가 발생했습니다: {str(e)}'})

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
@jwt_required(optional=True)
def verify_privacy_access():
    """개인정보 보호 비밀번호 검증 API"""
    try:
        user_id = get_jwt_identity()
        current_user_obj = User.query.get(int(user_id))
        
        if not current_user_obj:
            return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다.'})
        
        if current_user_obj.role not in ['super_admin', 'admin']:
            return jsonify({'success': False, 'message': '관리자만 접근 가능합니다.'})
        
        data = request.get_json()
        password = data.get('password', '')
        
        if not password:
            return jsonify({'success': False, 'message': '비밀번호를 입력해주세요.'})
        
        # 전역 개인정보 보호 비밀번호 검증
        privacy_setting = AppSetting.query.filter_by(setting_key='privacy_password').first()
        if not privacy_setting or not privacy_setting.setting_value:
            return jsonify({'success': False, 'message': '개인정보 보호 비밀번호가 설정되지 않았습니다.'})
        
        if check_password_hash(privacy_setting.setting_value, password):
            # JWT 토큰에 개인정보 접근 권한 추가
            from flask_jwt_extended import create_access_token
            from datetime import timedelta
            
            # 1분간 유효한 개인정보 접근 토큰 생성 (테스트용)
            privacy_token = create_access_token(
                identity=str(current_user_obj.id),  # 문자열로 변환
                expires_delta=timedelta(minutes=1),
                additional_claims={
                    'privacy_access_granted': True,
                    'user_role': current_user_obj.role
                }
            )
            
            # 토큰 생성 완료
            
            return jsonify({
                'success': True, 
                'message': '개인정보 접근이 허용되었습니다.',
                'access_granted': True,
                'privacy_token': privacy_token
            })
        else:
            return jsonify({'success': False, 'message': '비밀번호가 올바르지 않습니다.'})
            
    except Exception as e:
        return jsonify({'success': False, 'message': f'비밀번호 검증 중 오류가 발생했습니다: {str(e)}'})

@members_bp.route('/test/', methods=['GET'])
def test_api():
    """테스트 API"""
    return jsonify({'success': True, 'message': '테스트 API 작동 중'})

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
        
        if current_user_obj and current_user_obj.role in ['super_admin', 'admin']:
            # 전역 개인정보 보호 비밀번호 설정 확인
            privacy_setting = AppSetting.query.filter_by(setting_key='privacy_password').first()
            if not privacy_setting or not privacy_setting.setting_value:
                # 비밀번호가 설정되지 않은 경우 자동으로 해제
                privacy_unlocked = True
            else:
                # 헤더에서 개인정보 접근 토큰 확인
                privacy_token = request.headers.get('X-Privacy-Token')
                if privacy_token:
                    try:
                        from flask_jwt_extended import decode_token
                        import time
                        # 개인정보 접근 토큰 디코딩
                        decoded_token = decode_token(privacy_token)
                        jwt_claims = decoded_token
                        privacy_access_granted = jwt_claims.get('privacy_access_granted', False)
                        user_role = jwt_claims.get('user_role')
                        exp_time = jwt_claims.get('exp', 0)
                        current_time = int(time.time())
                        
                        # 토큰 사용자 ID와 현재 사용자 ID 비교
                        token_user_id = jwt_claims.get('sub', '')
                        current_user_id = str(current_user_obj.id)
                        
                        # 토큰 만료 시간 체크 및 사용자 ID 체크
                        if current_time >= exp_time:
                            privacy_unlocked = False  # 토큰 만료
                        elif token_user_id != current_user_id:
                            privacy_unlocked = False  # 사용자 ID 불일치
                        elif privacy_access_granted and user_role in ['super_admin', 'admin']:
                            privacy_unlocked = True  # 원본 데이터 허용
                        else:
                            privacy_unlocked = False  # 기본적으로 마스킹
                    except Exception as e:
                        privacy_unlocked = False  # 토큰 디코딩 실패
                else:
                    privacy_unlocked = False  # 토큰 없음
        
        return jsonify({
            'success': True,
            'privacy_unlocked': privacy_unlocked
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'개인정보 보호 상태 확인 중 오류가 발생했습니다: {str(e)}'})

# 임시: is_staff 컬럼 확인용 엔드포인트
@members_bp.route('/check-staff-column', methods=['GET'])
def check_staff_column():
    """is_staff 컬럼 확인용 임시 엔드포인트"""
    try:
        # is_staff 컬럼 존재 여부 확인
        result = db.session.execute(text("""
            SELECT column_name, data_type, column_default
            FROM information_schema.columns 
            WHERE table_name = 'members' AND column_name = 'is_staff'
        """))
        
        column_info = None
        for row in result:
            column_info = {
                'name': row[0],
                'type': row[1],
                'default': row[2]
            }
            break
        
        # 회원 정보 확인
        member = Member.query.first()
        
        if column_info:
            return jsonify({
                'success': True,
                'column_exists': True,
                'column_name': column_info['name'],
                'column_type': column_info['type'],
                'column_default': column_info['default'],
                'member_exists': member is not None,
                'member_id': member.id if member else None,
                'member_name': member.name if member else None,
                'member_is_staff': member.is_staff if member else None,
                'member_is_staff_type': str(type(member.is_staff)) if member else None
            })
        else:
            return jsonify({
                'success': True,
                'column_exists': False,
                'message': 'is_staff 컬럼이 존재하지 않습니다',
                'member_exists': member is not None,
                'member_id': member.id if member else None,
                'member_name': member.name if member else None
            })
    except Exception as e:
        return jsonify({
            'success': False, 
            'error': str(e),
            'message': f'DB 확인 중 오류: {str(e)}'
        })

