from flask import Blueprint, request, jsonify, make_response, session
from datetime import datetime, timedelta
from models import db, Member, Score, User, AppSetting
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.security import check_password_hash
from sqlalchemy import text
from utils.club_helpers import get_current_club_id, require_club_membership, check_club_permission

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
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization,X-Requested-With,X-Privacy-Token,X-Club-Id")
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
        
        # 관리자(슈퍼관리자, 시스템 관리자, 또는 클럽별 운영진)인 경우 개인정보 보호 비밀번호 검증 확인
        is_system_admin = current_user_obj and current_user_obj.role in ['super_admin', 'admin']
        
        # 클럽별 운영진인지 확인
        is_club_admin = False
        club_id = get_current_club_id()
        if club_id and current_user_obj:
            from models import ClubMember
            membership = ClubMember.query.filter_by(
                user_id=current_user_obj.id,
                club_id=club_id,
                status='approved'
            ).first()
            if membership and membership.role in ['admin', 'owner']:
                is_club_admin = True
        
        if is_system_admin or is_club_admin:
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
                            print(f"[PRIVACY] Token expired: current_time={current_time}, exp_time={exp_time}")
                        elif token_user_id != current_user_id:
                            hide_privacy = True  # 기본적으로 마스킹
                            print(f"[PRIVACY] User ID mismatch: token_user_id={token_user_id}, current_user_id={current_user_id}")
                        elif privacy_access_granted:
                            hide_privacy = False  # 원본 데이터 허용 (운영진도 포함)
                            print(f"[PRIVACY] Access granted: user_role={user_role}, is_system_admin={is_system_admin}, is_club_admin={is_club_admin}")
                        else:
                            hide_privacy = True  # 기본적으로 마스킹
                            print(f"[PRIVACY] Access not granted: privacy_access_granted={privacy_access_granted}")
                    except Exception as e:
                        hide_privacy = True  # 기본적으로 마스킹
                        print(f"[PRIVACY] Token decode error: {str(e)}")
                else:
                    hide_privacy = True  # 기본적으로 마스킹
                    print(f"[PRIVACY] No privacy token in header")
        
        # 클럽 필터링 (슈퍼관리자도 선택한 클럽의 데이터만 조회)
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
        
        # 슈퍼관리자인 경우 가입 여부 확인 생략, 일반 사용자는 가입 확인 필요
        is_super_admin = current_user_obj and current_user_obj.role == 'super_admin'
        
        if not is_super_admin and user_id:
            # 일반 사용자는 클럽 가입 확인
            is_member, result = require_club_membership(int(user_id), club_id)
            if not is_member:
                return jsonify({'success': False, 'message': result}), 403
        
        # 선택한 클럽의 회원만 조회
        members = Member.query.filter_by(
            club_id=club_id,
            is_deleted=False
        ).order_by(Member.name.asc()).all()
        
        members_data = []
        for member in members:
            member_dict = member.to_dict(hide_privacy=hide_privacy)
            # 재가입 여부 계산: rejoined_at이 있고, 재가입일로부터 한 달 이내인 경우에만 재가입 뱃지 표시
            if member.rejoined_at:
                now = datetime.utcnow()
                # rejoined_at이 datetime 객체가 아닌 경우 변환
                rejoined_date = member.rejoined_at
                if isinstance(rejoined_date, str):
                    rejoined_date = datetime.strptime(rejoined_date, '%Y-%m-%d %H:%M:%S')
                elif isinstance(rejoined_date, datetime):
                    pass
                else:
                    rejoined_date = None
                
                if rejoined_date:
                    # 재가입일로부터 한 달(30일) 이내인지 확인
                    days_since_rejoin = (now - rejoined_date).days
                    if days_since_rejoin <= 30:
                        member_dict['is_rejoined'] = True
                    else:
                        member_dict['is_rejoined'] = False
                else:
                    member_dict['is_rejoined'] = False
            else:
                member_dict['is_rejoined'] = False
            members_data.append(member_dict)
        
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
            
            # 저장된 티어 사용 (DB에서 이미 계산되어 있음)
            tier = member.tier or '배치'
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
@jwt_required()
def add_member():
    """회원 등록 API"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': '요청 데이터가 없습니다.'})
        
        name = data.get('name', '').strip()
        if not name:
            return jsonify({'success': False, 'message': '이름은 필수 입력 항목입니다.'})
        
        # 클럽 필터링
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
        
        # 클럽별 중복 확인 (활성 회원)
        existing_member = Member.query.filter_by(name=name, club_id=club_id, is_deleted=False).first()
        if existing_member:
            return jsonify({'success': False, 'message': '이미 등록된 회원입니다.'})
        
        # 운영진 여부 확인 (admin/super_admin만 설정 가능)
        user_id = get_jwt_identity()
        current_user = User.query.get(int(user_id)) if user_id else None
        if not current_user:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'})
        
        # 슈퍼관리자 또는 시스템 관리자인지 확인
        is_system_admin = current_user.role in ['super_admin', 'admin']
        
        # 클럽별 운영진인지 확인
        is_club_admin = False
        if not is_system_admin:
            from utils.club_helpers import check_club_permission
            has_permission, result = check_club_permission(int(user_id), club_id, 'admin')
            if has_permission:
                is_club_admin = True
            else:
                return jsonify({'success': False, 'message': '관리자 권한이 필요합니다.'}), 403
        
        # 슈퍼관리자, 시스템 관리자, 또는 클럽별 운영진만 회원 추가 가능
        is_staff = False
        if (is_system_admin or is_club_admin):
            is_staff = data.get('is_staff', False)
        
        # 동일한 이름 + 전화번호인 삭제된 회원 확인 (재가입 처리)
        phone = data.get('phone', '').strip()
        is_rejoined = False
        deleted_member = None
        
        if phone:  # 전화번호가 있는 경우만 재가입 확인
            deleted_member = Member.query.filter_by(
                name=name,
                phone=phone,
                club_id=club_id,
                is_deleted=True
            ).first()
        
        if deleted_member:
            # 기존 삭제된 회원 복구
            is_rejoined = True
            deleted_member.is_deleted = False
            deleted_member.phone = phone
            deleted_member.gender = data.get('gender', '').strip()
            deleted_member.level = data.get('level', '').strip()  # 레거시 호환성
            deleted_member.tier = data.get('tier', '').strip()
            deleted_member.email = data.get('email', '').strip()
            deleted_member.note = data.get('note', '').strip()
            deleted_member.is_staff = is_staff
            deleted_member.rejoined_at = datetime.utcnow()  # 재가입일 저장
            deleted_member.updated_at = datetime.utcnow()
            
            db.session.commit()
            
            result = {
                'success': True, 
                'message': f'{name} 회원이 재가입되었습니다.',
                'member': deleted_member.to_dict(),
                'is_rejoined': True
            }
            return jsonify(result)
        else:
            # 새 회원 등록
            new_member = Member(
                name=name,
                phone=phone,
                gender=data.get('gender', '').strip(),
                level=data.get('level', '').strip(),  # 레거시 호환성
                tier=data.get('tier', '').strip(),
                email=data.get('email', '').strip(),
                note=data.get('note', '').strip(),
                is_staff=is_staff,
                club_id=club_id
            )
            
            db.session.add(new_member)
            db.session.commit()
            
            result = {
                'success': True, 
                'message': f'{name} 회원이 등록되었습니다.',
                'member': new_member.to_dict(),
                'is_rejoined': False
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
        
        # 클럽 필터링
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
        
        # 슈퍼관리자는 가입 여부 확인 생략, 일반 사용자는 가입 확인 필요
        user_id = get_jwt_identity()
        is_super_admin = False
        if user_id:
            current_user = User.query.get(int(user_id))
            is_super_admin = current_user and current_user.role == 'super_admin'
        
        if not is_super_admin and user_id:
            is_member, result = require_club_membership(int(user_id), club_id)
            if not is_member:
                return jsonify({'success': False, 'message': result}), 403
        
        # 클럽별 중복 확인
        existing_member = Member.query.filter_by(name=name, club_id=club_id, is_deleted=False).filter(Member.id != member_id).first()
        if existing_member:
            return jsonify({'success': False, 'message': '이미 등록된 회원입니다.'})
        
        # 수정하려는 회원이 현재 클럽에 속하는지 확인
        if member.club_id != club_id:
            return jsonify({'success': False, 'message': '다른 클럽의 회원은 수정할 수 없습니다.'}), 403
        
        # 현재 사용자 확인
        current_user = User.query.get(int(user_id))
        
        print(f"[DEBUG] Received data: {data}")
        print(f"[DEBUG] User ID: {user_id}, Current User: {current_user.name if current_user else None}, Role: {current_user.role if current_user else None}")
        print(f"[DEBUG] is_staff from request: {data.get('is_staff')}")
        
        member.name = name
        # 마스킹 값 방어: '*'를 포함한 값 또는 전형적 마스킹 패턴(***-****-****)은 무시하고 기존 값 유지
        # 프론트엔드에서 phone 필드를 보내지 않으면 (None) 기존 값 유지
        if 'phone' in data:
            incoming_phone = (data.get('phone') or '').strip() if data.get('phone') else ''
            if incoming_phone and ('*' in incoming_phone or incoming_phone == '***-****-****'):
                pass  # 기존 member.phone 유지
            else:
                member.phone = incoming_phone
        # phone 필드가 요청에 없으면 기존 값 유지 (아무것도 하지 않음)
        member.gender = data.get('gender', '').strip()
        member.level = data.get('level', '').strip()  # 레거시 호환성
        # 티어는 average_score 기반으로 자동 계산되므로, 프론트엔드에서 보낸 값이 있으면 사용하고 없으면 자동 계산
        incoming_tier = data.get('tier', '').strip() if data.get('tier') else None
        if incoming_tier:
            member.tier = incoming_tier
        # 티어가 없고 average_score가 있으면 자동 계산
        elif member.average_score is not None:
            member.tier = member.calculate_tier_from_score()
        else:
            # average_score도 없으면 티어 유지 (기존 값 그대로)
            pass
        # 이메일도 마스킹 패턴(*** 포함)일 경우 기존 값 유지
        # 프론트엔드에서 email 필드를 보내지 않으면 (None) 기존 값 유지
        if 'email' in data:
            incoming_email = (data.get('email') or '').strip() if data.get('email') else ''
            if incoming_email and ('***' in incoming_email):
                pass
            else:
                member.email = incoming_email
        # email 필드가 요청에 없으면 기존 값 유지 (아무것도 하지 않음)
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
            member.is_staff = is_staff_value
        
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
@jwt_required()
def delete_member(member_id):
    """회원 삭제 API (Soft Delete)"""
    try:
        # 클럽 필터링
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
        
        # 현재 사용자 확인
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        current_user = User.query.get(int(user_id))
        if not current_user:
            return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다.'}), 401
        
        # 권한 확인 (admin/super_admin만 삭제 가능)
        is_system_admin = current_user.role in ['super_admin', 'admin']
        is_club_admin = False
        
        if not is_system_admin:
            has_permission, result = check_club_permission(int(user_id), club_id, 'admin')
            if has_permission:
                is_club_admin = True
            else:
                return jsonify({'success': False, 'message': '관리자 권한이 필요합니다.'}), 403
        
        # 회원 조회
        member = Member.query.get_or_404(member_id)
        
        # 삭제하려는 회원이 현재 클럽에 속하는지 확인
        if member.club_id != club_id:
            return jsonify({'success': False, 'message': '다른 클럽의 회원은 삭제할 수 없습니다.'}), 403
        
        # 이미 삭제된 회원인지 확인
        if member.is_deleted:
            return jsonify({'success': False, 'message': '이미 삭제된 회원입니다.'}), 400
        
        member_name = member.name
        
        # Soft Delete: 실제로 삭제하지 않고 is_deleted 플래그만 설정
        # 관련 데이터(Score, Point, Payment)는 유지
        member.is_deleted = True
        member.updated_at = datetime.utcnow()
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
        
        # 모든 회원 조회 (삭제되지 않은 회원만)
        members = Member.query.filter_by(is_deleted=False).all()
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
    """모든 회원의 에버를 일괄 조회하는 API - 최적화 버전"""
    try:
        members = Member.query.filter_by(is_deleted=False).all()
        members_with_averages = []
        
        # 한 번에 모든 점수를 조회하여 N+1 쿼리 문제 해결
        june_first = datetime(2025, 6, 1).date()
        
        # 모든 점수를 한 번에 조회
        recent_scores_all = Score.query.filter(Score.game_date >= june_first).all()
        all_scores_all = Score.query.all()
        
        # member_id로 그룹화
        recent_scores_by_member = {}
        all_scores_by_member = {}
        
        for score in recent_scores_all:
            if score.member_id not in recent_scores_by_member:
                recent_scores_by_member[score.member_id] = []
            recent_scores_by_member[score.member_id].append(score)
        
        for score in all_scores_all:
            if score.member_id not in all_scores_by_member:
                all_scores_by_member[score.member_id] = []
            all_scores_by_member[score.member_id].append(score)
        
        # 각 회원별 평균 계산
        for member in members:
            member_id = member.id
            average = None
            score_count = 0
            period = '기록 없음'
            
            # 6월 이후 점수가 있는지 확인
            if member_id in recent_scores_by_member:
                recent_scores = recent_scores_by_member[member_id]
                if recent_scores:
                    total_average = sum(score.average_score for score in recent_scores if score.average_score)
                    count = len([s for s in recent_scores if s.average_score])
                    if count > 0:
                        average = round(total_average / count, 1)
                        score_count = count
                        period = '6월 이후'
            else:
                # 6월 이후 점수가 없으면 전체 기간 점수 확인
                if member_id in all_scores_by_member:
                    all_scores = all_scores_by_member[member_id]
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
        
        # 슈퍼관리자 또는 시스템 관리자인지 확인
        is_system_admin = current_user_obj.role in ['super_admin', 'admin']
        
        # 클럽별 운영진인지 확인
        is_club_admin = False
        club_id = get_current_club_id()
        if club_id:
            from models import ClubMember
            membership = ClubMember.query.filter_by(
                user_id=current_user_obj.id,
                club_id=club_id,
                status='approved'
            ).first()
            if membership and membership.role in ['admin', 'owner']:
                is_club_admin = True
        
        # 운영진이 아니면 접근 거부
        if not is_system_admin and not is_club_admin:
            return jsonify({'success': False, 'message': '관리자만 접근 가능합니다.'})
        
        # 운영진도 비밀번호를 입력받아서 검증
        data = request.get_json()
        password = data.get('password', '')
        
        if not password:
            return jsonify({'success': False, 'message': '비밀번호를 입력해주세요.'})
        
        # 전역 개인정보 보호 비밀번호 검증
        privacy_setting = AppSetting.query.filter_by(setting_key='privacy_password').first()
        if not privacy_setting or not privacy_setting.setting_value:
            return jsonify({'success': False, 'message': '개인정보 보호 비밀번호가 설정되지 않았습니다.'})
        
        if check_password_hash(privacy_setting.setting_value, password):
            # 비밀번호가 맞으면 운영진은 자동으로 허용
            from flask_jwt_extended import create_access_token
            from datetime import timedelta
            
            # 30분간 유효한 개인정보 접근 토큰 생성
            privacy_token = create_access_token(
                identity=str(current_user_obj.id),  # 문자열로 변환
                expires_delta=timedelta(minutes=30),
                additional_claims={
                    'privacy_access_granted': True,
                    'user_role': current_user_obj.role
                }
            )
            
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
        
        if current_user_obj:
            # 슈퍼관리자 또는 시스템 관리자인지 확인
            is_system_admin = current_user_obj.role in ['super_admin', 'admin']
            
            # 클럽별 운영진인지 확인
            is_club_admin = False
            club_id = get_current_club_id()
            if club_id:
                from models import ClubMember
                membership = ClubMember.query.filter_by(
                    user_id=current_user_obj.id,
                    club_id=club_id,
                    status='approved'
                ).first()
                if membership and membership.role in ['admin', 'owner']:
                    is_club_admin = True
            
            # 운영진이면 자동으로 잠금 해제
            if is_system_admin or is_club_admin:
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
                            elif privacy_access_granted:
                                privacy_unlocked = True  # 원본 데이터 허용
                            else:
                                privacy_unlocked = False  # 기본적으로 마스킹
                        except Exception as e:
                            privacy_unlocked = False  # 토큰 디코딩 실패
                    else:
                        # 운영진이지만 토큰이 없으면 잠금 상태 유지 (비밀번호 입력 필요)
                        privacy_unlocked = False
        
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

