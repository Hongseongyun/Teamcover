from flask import Blueprint, request, jsonify, make_response, session
from flask_login import login_user, logout_user, login_required, current_user
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, verify_jwt_in_request
from datetime import datetime, timedelta
from models import db, User, AppSetting
from werkzeug.security import generate_password_hash, check_password_hash
import google.auth.transport.requests
from google.oauth2 import id_token
import os
import requests
from email_service import send_verification_email, send_verification_email_with_debug, verify_email_token, resend_verification_email, send_verification_code_email
import re
import random
import string

# 인증 관리 Blueprint
auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

def validate_password(password):
    """비밀번호 조건 검증"""
    if len(password) < 6:
        return {'valid': False, 'message': '비밀번호는 6글자 이상이어야 합니다.'}
    
    if not re.search(r'[a-z]', password):
        return {'valid': False, 'message': '비밀번호는 소문자를 포함해야 합니다.'}
    
    if not re.search(r'[A-Z]', password):
        return {'valid': False, 'message': '비밀번호는 대문자를 포함해야 합니다.'}
    
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return {'valid': False, 'message': '비밀번호는 특수문자를 포함해야 합니다.'}
    
    return {'valid': True, 'message': '비밀번호가 유효합니다.'}

# 구글 OAuth 설정 (app.config에서 가져오기)
from flask import current_app

def get_google_credentials():
    """Google OAuth 설정 가져오기"""
    return {
        'client_id': current_app.config.get('GOOGLE_CLIENT_ID', 'your-google-client-id'),
        'client_secret': current_app.config.get('GOOGLE_CLIENT_SECRET', 'your-google-client-secret')
    }

def generate_verification_code():
    """6자리 인증 코드 생성"""
    return ''.join(random.choices(string.digits, k=6))

@auth_bp.before_request
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

def get_current_user_from_jwt():
    """JWT 토큰에서 현재 사용자 정보 가져오기"""
    try:
        verify_jwt_in_request()
        user_id = get_jwt_identity()
        return User.query.get(int(user_id))
    except Exception as e:
        return None

@auth_bp.route('/register', methods=['POST'])
def register():
    """일반 회원가입"""
    try:
        data = request.get_json()
        
        email = data.get('email', '').strip().lower()
        name = data.get('name', '').strip()
        password = data.get('password', '')
        password_confirm = data.get('password_confirm', '')
        role = 'user'  # 회원가입 시 항상 일반 회원으로만 가입 가능
        
        if not email or not name or not password or not password_confirm:
            return jsonify({'success': False, 'message': '이메일, 이름, 비밀번호, 비밀번호 확인은 필수 입력 항목입니다.'})
        
        # 비밀번호 확인 검증
        if password != password_confirm:
            return jsonify({'success': False, 'message': '비밀번호와 비밀번호 확인이 일치하지 않습니다.'})
        
        # 비밀번호 조건 검증
        password_validation = validate_password(password)
        if not password_validation['valid']:
            return jsonify({'success': False, 'message': password_validation['message']})
        
        # 이메일 중복 확인
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({'success': False, 'message': '이미 등록된 이메일입니다.'})
        
        # 먼저 이메일 발송 시도 (사용자 정보 포함)
        try:
            
            # 이메일 발송 결과와 상세 정보를 받아옴
            email_result = send_verification_email_with_debug(email, name, password, role)
            email_sent = email_result['success']
            debug_info = email_result['debug_info']
            
            # 이메일 발송 결과 확인
            
            if not email_sent:
                return jsonify({
                    'success': False,
                    'message': '이메일 발송에 실패했습니다. Gmail SMTP 설정을 확인해주세요.',
                    'data': {
                        'email_sent': False,
                        'debug_info': debug_info
                    }
                })
            
            # 이메일 발송 성공 - DB에는 저장하지 않음 (인증 완료 후 저장)
            return jsonify({
                'success': True,
                'message': f'{email}로 인증 이메일을 발송했습니다. 이메일을 확인하여 인증을 완료해주세요.',
                'data': {
                    'email_sent': True,
                    'debug_info': debug_info
                }
            })
            
        except Exception as email_error:
            return jsonify({
                'success': False,
                'message': f'이메일 발송 중 오류가 발생했습니다: {str(email_error)}',
                'data': {
                    'email_sent': False,
                    'debug_info': {
                        'error': str(email_error),
                        'error_type': str(type(email_error)),
                        'traceback': traceback.format_exc()
                    }
                }
            })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'회원가입 중 오류가 발생했습니다: {str(e)}'})

@auth_bp.route('/login', methods=['POST'])
def login():
    """일반 로그인"""
    try:
        data = request.get_json()
        
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        if not email or not password:
            return jsonify({'success': False, 'message': '이메일과 비밀번호를 입력해주세요.'})
        
        # 사용자 찾기
        user = User.query.filter_by(email=email).first()
        
        if not user or not user.check_password(password):
            return jsonify({'success': False, 'message': '이메일 또는 비밀번호가 올바르지 않습니다.'})
        
        if not user.is_active:
            return jsonify({'success': False, 'message': '비활성화된 계정입니다.'})
        
        # 로그인 처리
        login_user(user, remember=True)
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # JWT 토큰 생성
        access_token = create_access_token(
            identity=str(user.id),
            expires_delta=timedelta(days=7)
        )
        
        return jsonify({
            'success': True,
            'message': '로그인되었습니다.',
            'user': user.to_dict(),
            'access_token': access_token
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'로그인 중 오류가 발생했습니다: {str(e)}'})

@auth_bp.route('/google', methods=['POST'])
def google_login():
    """구글 소셜 로그인 (ID 토큰 방식)"""
    try:
        data = request.get_json()
        token = data.get('token')
        
        if not token:
            return jsonify({'success': False, 'message': '구글 토큰이 필요합니다.'})
        
        # Google OAuth 설정 가져오기
        google_creds = get_google_credentials()
        
        # 구글 토큰 검증
        try:
            idinfo = id_token.verify_oauth2_token(
                token, 
                google.auth.transport.requests.Request(), 
                google_creds['client_id']
            )
        except ValueError:
            return jsonify({'success': False, 'message': '유효하지 않은 구글 토큰입니다.'})
        
        google_id = idinfo.get('sub')
        email = idinfo.get('email')
        name = idinfo.get('name')
        
        if not google_id or not email or not name:
            return jsonify({'success': False, 'message': '구글 계정 정보를 가져올 수 없습니다.'})
        
        # 기존 사용자 확인 또는 새 사용자 생성
        user = User.query.filter_by(google_id=google_id).first()
        
        if not user:
            # 이메일로 기존 사용자 확인
            existing_user = User.query.filter_by(email=email).first()
            if existing_user:
                # 기존 사용자에 구글 ID 연결
                existing_user.google_id = google_id
                user = existing_user
            else:
                # 새 사용자 생성 (기본 역할: user)
                user = User(
                    google_id=google_id,
                    email=email,
                    name=name,
                    role='user'
                )
                db.session.add(user)
        
        if not user.is_active:
            return jsonify({'success': False, 'message': '비활성화된 계정입니다.'})
        
        # 로그인 처리
        login_user(user, remember=True)
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # JWT 토큰 생성
        access_token = create_access_token(
            identity=str(user.id),
            expires_delta=timedelta(days=7)
        )
        
        return jsonify({
            'success': True,
            'message': '구글 로그인이 완료되었습니다.',
            'user': user.to_dict(),
            'access_token': access_token
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'구글 로그인 중 오류가 발생했습니다: {str(e)}'})

# 사용된 authorization code를 저장하는 임시 저장소 (실제 운영에서는 Redis 등 사용)
# 메모리에서만 관리하므로 서버 재시작 시 초기화됨
used_codes = set()

@auth_bp.route('/google/callback', methods=['POST'])
def google_callback():
    """구글 OAuth 콜백 (Authorization Code 방식)"""
    try:
        data = request.get_json()
        code = data.get('code')
        origin = data.get('origin')  # 프론트엔드에서 전송한 origin
        
        if not code:
            return jsonify({'success': False, 'message': 'Authorization code가 필요합니다.'})
        
        # 이미 사용된 code인지 확인
        if code in used_codes:
            return jsonify({'success': False, 'message': '이미 사용된 authorization code입니다.'})
        
        # code를 사용된 것으로 표시
        used_codes.add(code)
        
        # Google OAuth 설정 가져오기
        google_creds = get_google_credentials()
        
        # Origin에 따라 redirect_uri를 동적으로 설정
        allowed_origins = {
            'http://localhost:3000': 'http://localhost:3000/google-callback',
            'https://hsyun.store': 'https://hsyun.store/google-callback',
            'https://teamcover-frontend.vercel.app': 'https://teamcover-frontend.vercel.app/google-callback'
        }
        
        # origin이 제공되지 않았거나 허용되지 않은 origin인 경우 기본값 사용
        redirect_uri = allowed_origins.get(origin, current_app.config.get('GOOGLE_REDIRECT_URI', 'http://localhost:3000/google-callback'))
        
        # Google OAuth 설정 확인
        
        # Google OAuth2 토큰 교환
        token_url = 'https://oauth2.googleapis.com/token'
        token_data = {
            'client_id': google_creds['client_id'],
            'client_secret': google_creds['client_secret'],
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': redirect_uri
        }
        
        token_response = requests.post(token_url, data=token_data)
        token_json = token_response.json()
        
        # Google 토큰 응답 확인
        
        if 'access_token' not in token_json:
            error_message = token_json.get('error_description', token_json.get('error', 'Unknown error'))
            return jsonify({'success': False, 'message': f'구글 토큰 교환에 실패했습니다: {error_message}'})
        
        # 사용자 정보 가져오기
        user_info_url = 'https://www.googleapis.com/oauth2/v2/userinfo'
        headers = {'Authorization': f'Bearer {token_json["access_token"]}'}
        user_response = requests.get(user_info_url, headers=headers)
        user_info = user_response.json()
        
        # Google 사용자 정보 응답 확인
        
        google_id = user_info.get('id')
        email = user_info.get('email')
        name = user_info.get('name')
        
        if not google_id or not email or not name:
            return jsonify({'success': False, 'message': '구글 계정 정보를 가져올 수 없습니다.'})
        
        # Google 사용자 처리
        
        # 기존 사용자 확인 또는 새 사용자 생성
        user = User.query.filter_by(google_id=google_id).first()
        
        if not user:
            # 이메일로 기존 사용자 확인
            existing_user = User.query.filter_by(email=email).first()
            if existing_user:
                # 기존 사용자에 구글 ID 연결
                existing_user.google_id = google_id
                user = existing_user
            else:
                # 새 사용자 생성 - 구글 로그인은 바로 활성화
                user = User(
                    google_id=google_id,
                    email=email,
                    name=name,
                    role='user',
                    is_active=True,  # 구글 로그인은 바로 활성화
                    is_verified=True,  # 구글 인증으로 간주
                    verification_method='google',  # 구글 로그인
                    verified_at=datetime.utcnow()  # 인증 완료 시간
                )
                db.session.add(user)
                try:
                    db.session.commit()
                except Exception as e:
                    db.session.rollback()
                    return jsonify({'success': False, 'message': f'사용자 생성 중 오류가 발생했습니다: {str(e)}'})
        
        # 사용자 로그인 상태 확인
        
        if not user.is_active:
            return jsonify({'success': False, 'message': '비활성화된 계정입니다.'})
        
        # 로그인 처리
        login_user(user, remember=True)
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # JWT 토큰 생성
        access_token = create_access_token(
            identity=str(user.id),
            expires_delta=timedelta(days=7)
        )
        
        return jsonify({
            'success': True,
            'message': '구글 로그인이 완료되었습니다.',
            'user': user.to_dict(),
            'access_token': access_token
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'구글 로그인 중 오류가 발생했습니다: {str(e)}'})

@auth_bp.route('/logout', methods=['POST'])
@jwt_required(optional=True)
def logout():
    """로그아웃"""
    try:
        # JWT 방식에서는 클라이언트에서 토큰을 삭제하면 되므로 서버에서 특별한 처리 불필요
        # Flask-Login 세션도 정리
        try:
            if current_user and current_user.is_authenticated:
                logout_user()
        except:
            pass
        
        return jsonify({
            'success': True,
            'message': '로그아웃되었습니다.'
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'로그아웃 중 오류가 발생했습니다: {str(e)}'})

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """현재 로그인한 사용자 정보 조회"""
    try:
        user_id = get_jwt_identity()
        # JWT identity는 문자열로 저장되므로 정수로 변환
        user = User.query.get(int(user_id))
        
        if not user:
            return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다.'})
        
        return jsonify({
            'success': True,
            'user': user.to_dict()
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'사용자 정보 조회 중 오류가 발생했습니다: {str(e)}'})

@auth_bp.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    """사용자 목록 조회 (관리자만)"""
    try:
        user_id = get_jwt_identity()
        current_user_obj = User.query.get(int(user_id))
        
        if not current_user_obj or current_user_obj.role not in ['admin', 'super_admin']:
            return jsonify({'success': False, 'message': '권한이 없습니다.'})
        
        users = User.query.all()
        users_data = [user.to_dict() for user in users]
        
        return jsonify({
            'success': True,
            'users': users_data
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'사용자 목록 조회 중 오류가 발생했습니다: {str(e)}'})

@auth_bp.route('/users/<int:user_id>/role', methods=['PUT'])
@jwt_required()
def update_user_role(user_id):
    """사용자 역할 변경 (슈퍼 관리자만)"""
    try:
        current_user_id = get_jwt_identity()
        current_user_obj = User.query.get(int(current_user_id))
        
        if not current_user_obj or current_user_obj.role != 'super_admin':
            return jsonify({'success': False, 'message': '권한이 없습니다.'})
        
        data = request.get_json()
        new_role = data.get('role')
        
        if new_role not in ['user', 'admin', 'super_admin']:
            return jsonify({'success': False, 'message': '유효하지 않은 역할입니다.'})
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다.'})
        
        # 고정 슈퍼계정은 역할 변경 불가
        if user.email == 'syun4224@naver.com':
            return jsonify({'success': False, 'message': '고정 슈퍼계정의 역할은 변경할 수 없습니다.'})
        
        user.role = new_role
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'{user.name}의 역할이 {new_role}로 변경되었습니다.',
            'user': user.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'역할 변경 중 오류가 발생했습니다: {str(e)}'})

@auth_bp.route('/users/<int:user_id>/status', methods=['PUT'])
@jwt_required()
def update_user_status(user_id):
    """사용자 활성화 상태 변경 (슈퍼 관리자만)"""
    try:
        current_user_id = get_jwt_identity()
        current_user_obj = User.query.get(int(current_user_id))
        
        if not current_user_obj or current_user_obj.role != 'super_admin':
            return jsonify({'success': False, 'message': '권한이 없습니다.'})
        
        data = request.get_json()
        is_active = data.get('is_active')
        
        if is_active is None:
            return jsonify({'success': False, 'message': '활성화 상태를 입력해주세요.'})
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다.'})
        
        user.is_active = is_active
        db.session.commit()
        
        status_text = '활성화' if is_active else '비활성화'
        return jsonify({
            'success': True,
            'message': f'{user.name}이 {status_text}되었습니다.',
            'user': user.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'상태 변경 중 오류가 발생했습니다: {str(e)}'})

@auth_bp.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    """사용자 삭제 (슈퍼 관리자만)"""
    try:
        current_user_id = get_jwt_identity()
        current_user_obj = User.query.get(int(current_user_id))
        
        if not current_user_obj or current_user_obj.role != 'super_admin':
            return jsonify({'success': False, 'message': '권한이 없습니다.'})
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다.'})
        
        # 자신을 삭제하는 것 방지
        if user.id == current_user_obj.id:
            return jsonify({'success': False, 'message': '자신의 계정은 삭제할 수 없습니다.'})
        
        # 고정 슈퍼계정 삭제 방지
        if user.email == 'syun4224@naver.com':
            return jsonify({'success': False, 'message': '고정 슈퍼계정은 삭제할 수 없습니다.'})
        
        user_name = user.name
        user_email = user.email
        
        # 사용자 삭제
        db.session.delete(user)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'{user_name}({user_email}) 사용자가 삭제되었습니다.'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'사용자 삭제 중 오류가 발생했습니다: {str(e)}'})

@auth_bp.route('/verify-email', methods=['POST'])
def verify_email():
    """이메일 인증 처리"""
    try:
        data = request.get_json()
        token = data.get('token')
        
        if not token:
            return jsonify({'success': False, 'message': '인증 토큰이 필요합니다.'})
        
        result = verify_email_token(token)
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'이메일 인증 중 오류가 발생했습니다: {str(e)}'})

@auth_bp.route('/resend-verification', methods=['POST'])
def resend_verification():
    """인증 이메일 재발송"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        
        if not email:
            return jsonify({'success': False, 'message': '이메일을 입력해주세요.'})
        
        result = resend_verification_email(email)
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'이메일 재발송 중 오류가 발생했습니다: {str(e)}'})

@auth_bp.route('/test-email', methods=['POST'])
def test_email():
    """이메일 발송 테스트"""
    try:
        
        # JSON 데이터 파싱
        if request.is_json:
            data = request.get_json()
        else:
            data = request.form.to_dict()
        
        test_email = data.get('email', 'test@example.com')
        
        # 이메일 테스트 시작
        
        # 이메일 발송 테스트
        success = send_verification_email(test_email, '테스트 사용자')
        
        print(f"이메일 테스트 결과: {success}")
        
        if success:
            return jsonify({
                'success': True,
                'message': '테스트 이메일이 발송되었습니다.',
                'email': test_email
            })
        else:
            return jsonify({
                'success': False,
                'message': '이메일 발송에 실패했습니다.'
            })
            
    except Exception as e:
        print(f"이메일 테스트 오류: {e}")
        import traceback
        print(f"상세 오류: {traceback.format_exc()}")
        return jsonify({
            'success': False,
            'message': f'이메일 테스트 중 오류: {str(e)}'
        })

@auth_bp.route('/test-email-simple', methods=['GET'])
def test_email_simple():
    """간단한 이메일 발송 테스트 (GET 방식)"""
    try:
        print(f"=== 간단한 이메일 테스트 시작 ===")
        
        # 기본 테스트 이메일로 발송
        test_email = "seongyun23@nate.com"
        email_result = send_verification_email_with_debug(test_email, '테스트 사용자', 'testpassword123', 'user')
        success = email_result['success']
        debug_info = email_result['debug_info']
        
        print(f"이메일 테스트 결과: {success}")
        print(f"디버그 정보: {debug_info}")
        
        if success:
            return jsonify({
                'success': True,
                'message': '테스트 이메일이 발송되었습니다.',
                'email': test_email,
                'debug_info': debug_info
            })
        else:
            return jsonify({
                'success': False,
                'message': '이메일 발송에 실패했습니다.',
                'debug_info': debug_info
            })
            
    except Exception as e:
        print(f"이메일 테스트 오류: {e}")
        import traceback
        print(f"상세 오류: {traceback.format_exc()}")
        return jsonify({
            'success': False,
            'message': f'이메일 테스트 중 오류: {str(e)}'
        })

@auth_bp.route('/test-email-debug', methods=['GET'])
def test_email_debug():
    """이메일 설정 디버깅"""
    try:
        from flask import current_app
        
        print(f"=== 이메일 설정 디버깅 ===")
        
        # 이메일 설정 확인
        mail_username = current_app.config.get('MAIL_USERNAME')
        mail_password = current_app.config.get('MAIL_PASSWORD')
        mail_server = current_app.config.get('MAIL_SERVER')
        mail_port = current_app.config.get('MAIL_PORT')
        
        print(f"MAIL_USERNAME: {mail_username}")
        print(f"MAIL_PASSWORD: {'SET' if mail_password else 'NOT_SET'}")
        print(f"MAIL_SERVER: {mail_server}")
        print(f"MAIL_PORT: {mail_port}")
        
        # 실제 이메일 발송 테스트
        test_email = "test@example.com"
        print(f"이메일 발송 테스트 시작: {test_email}")
        
        success = send_verification_email(test_email, '테스트 사용자')
        
        print(f"이메일 발송 결과: {success}")
        
        return jsonify({
            'success': True,
            'message': '디버깅 완료',
            'mail_username': mail_username,
            'mail_password_set': bool(mail_password),
            'mail_server': mail_server,
            'mail_port': mail_port,
            'email_sent': success
        })
        
    except Exception as e:
        print(f"디버깅 오류: {e}")
        import traceback
        print(f"상세 오류: {traceback.format_exc()}")
        return jsonify({
            'success': False,
            'message': f'디버깅 중 오류: {str(e)}'
        })

@auth_bp.route('/email-config', methods=['GET'])
def get_email_config():
    """이메일 설정 상태 확인"""
    try:
        from flask import current_app
        
        mail_username = current_app.config.get('MAIL_USERNAME')
        mail_password = current_app.config.get('MAIL_PASSWORD')
        
        return jsonify({
            'success': True,
            'mail_username': mail_username,
            'mail_password_set': bool(mail_password),
            'mail_server': current_app.config.get('MAIL_SERVER'),
            'mail_port': current_app.config.get('MAIL_PORT'),
            'mail_use_tls': current_app.config.get('MAIL_USE_TLS'),
            'frontend_base_url': current_app.config.get('FRONTEND_BASE_URL'),
            'environment': os.environ.get('FLASK_ENV', 'unknown')
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'이메일 설정 확인 중 오류: {str(e)}'
        })

@auth_bp.route('/google/config', methods=['GET'])
def get_google_config():
    """Google OAuth 설정 확인 (디버깅용)"""
    try:
        google_creds = get_google_credentials()
        return jsonify({
            'success': True,
            'client_id': google_creds['client_id'],
            'client_secret_set': bool(google_creds['client_secret'] and google_creds['client_secret'] != 'your-google-client-secret-here'),
            'redirect_uri': current_app.config.get('GOOGLE_REDIRECT_URI', 'http://localhost:3000/google-callback')
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'설정 확인 중 오류: {str(e)}'})

@auth_bp.route('/verify-code', methods=['POST'])
def verify_code():
    """인증 코드 검증 (구글 로그인용)"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        code = data.get('code', '').strip()
        
        if not email or not code:
            return jsonify({'success': False, 'message': '이메일과 인증 코드를 입력해주세요.'})
        
        # 사용자 찾기
        user = User.query.filter_by(email=email).first()
        
        if not user:
            return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다.'})
        
        # 이미 인증된 사용자
        if user.is_verified:
            return jsonify({'success': False, 'message': '이미 인증된 계정입니다.'})
        
        # 인증 코드 검증
        if user.verification_code != code:
            return jsonify({'success': False, 'message': '인증 코드가 올바르지 않습니다.'})
        
        # 인증 코드 만료 확인
        if user.verification_code_expires and user.verification_code_expires < datetime.utcnow():
            return jsonify({'success': False, 'message': '인증 코드가 만료되었습니다. 다시 로그인해주세요.'})
        
        # 인증 완료 처리
        user.is_verified = True
        user.is_active = True
        user.verified_at = datetime.utcnow()
        user.verification_code = None  # 보안을 위해 코드 삭제
        user.verification_code_expires = None
        
        db.session.commit()
        
        # 로그인 처리
        login_user(user, remember=True)
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # JWT 토큰 생성
        access_token = create_access_token(
            identity=str(user.id),
            expires_delta=timedelta(days=7)
        )
        
        print(f"User verified and logged in: {user.email}")
        
        return jsonify({
            'success': True,
            'message': '인증이 완료되었습니다. 로그인되었습니다.',
            'user': user.to_dict(),
            'access_token': access_token
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error verifying code: {e}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({'success': False, 'message': f'인증 코드 검증 중 오류가 발생했습니다: {str(e)}'})

@auth_bp.route('/get-verification-code/<string:email>', methods=['GET'])
@jwt_required()
def get_verification_code(email):
    """인증 코드 조회 (관리자 전용)"""
    try:
        # 현재 사용자 확인
        current_user_id = get_jwt_identity()
        current_user_obj = User.query.get(int(current_user_id))
        
        if not current_user_obj or current_user_obj.role not in ['admin', 'super_admin']:
            return jsonify({'success': False, 'message': '권한이 없습니다.'})
        
        # 이메일로 사용자 찾기
        user = User.query.filter_by(email=email.lower()).first()
        
        if not user:
            return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다.'})
        
        if user.is_verified:
            return jsonify({'success': False, 'message': '이미 인증된 계정입니다.'})
        
        if not user.verification_code:
            return jsonify({'success': False, 'message': '인증 코드가 생성되지 않았습니다.'})
        
        # 만료 여부 확인
        is_expired = user.verification_code_expires and user.verification_code_expires < datetime.utcnow()
        
        return jsonify({
            'success': True,
            'verification_code': user.verification_code,
            'expires_at': user.verification_code_expires.strftime('%Y-%m-%d %H:%M:%S') if user.verification_code_expires else None,
            'is_expired': is_expired,
            'user': {
                'email': user.email,
                'name': user.name,
                'created_at': user.created_at.strftime('%Y-%m-%d %H:%M:%S') if user.created_at else None
            }
        })
        
    except Exception as e:
        print(f"Error getting verification code: {e}")
        return jsonify({'success': False, 'message': f'인증 코드 조회 중 오류가 발생했습니다: {str(e)}'})

@auth_bp.route('/regenerate-verification-code', methods=['POST'])
@jwt_required()
def regenerate_verification_code():
    """인증 코드 재생성 (관리자 전용)"""
    try:
        # 현재 사용자 확인
        current_user_id = get_jwt_identity()
        current_user_obj = User.query.get(int(current_user_id))
        
        if not current_user_obj or current_user_obj.role not in ['admin', 'super_admin']:
            return jsonify({'success': False, 'message': '권한이 없습니다.'})
        
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        
        if not email:
            return jsonify({'success': False, 'message': '이메일을 입력해주세요.'})
        
        # 사용자 찾기
        user = User.query.filter_by(email=email).first()
        
        if not user:
            return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다.'})
        
        if user.is_verified:
            return jsonify({'success': False, 'message': '이미 인증된 계정입니다.'})
        
        # 새 인증 코드 생성
        new_code = generate_verification_code()
        new_expires = datetime.utcnow() + timedelta(hours=24)
        
        user.verification_code = new_code
        user.verification_code_expires = new_expires
        
        db.session.commit()
        
        print(f"Regenerated verification code for {user.email}: {new_code}")
        
        return jsonify({
            'success': True,
            'message': '새로운 인증 코드가 생성되었습니다.',
            'verification_code': new_code,
            'expires_at': new_expires.strftime('%Y-%m-%d %H:%M:%S')
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error regenerating verification code: {e}")
        return jsonify({'success': False, 'message': f'인증 코드 재생성 중 오류가 발생했습니다: {str(e)}'})

@auth_bp.route('/set-privacy-password', methods=['POST'])
@jwt_required()
def set_privacy_password():
    """개인정보 보호 비밀번호 설정 (슈퍼관리자 전용) - 전역 설정"""
    try:
        current_user_id = get_jwt_identity()
        current_user_obj = User.query.get(int(current_user_id))
        
        if not current_user_obj or current_user_obj.role != 'super_admin':
            return jsonify({'success': False, 'message': '슈퍼관리자만 설정할 수 있습니다.'})
        
        data = request.get_json()
        password = data.get('password', '').strip()
        
        if not password:
            return jsonify({'success': False, 'message': '비밀번호를 입력해주세요.'})
        
        if len(password) < 4:
            return jsonify({'success': False, 'message': '비밀번호는 4자리 이상이어야 합니다.'})
        
        # 전역 개인정보 보호 비밀번호 설정
        password_hash = generate_password_hash(password)
        
        setting = AppSetting.query.filter_by(setting_key='privacy_password').first()
        if setting:
            setting.setting_value = password_hash
            setting.updated_by = current_user_obj.id
        else:
            setting = AppSetting(
                setting_key='privacy_password',
                setting_value=password_hash,
                updated_by=current_user_obj.id
            )
            db.session.add(setting)
        
        db.session.commit()
        
        print(f"Privacy password set by {current_user_obj.email}")
        
        return jsonify({
            'success': True,
            'message': '개인정보 보호 비밀번호가 설정되었습니다. (전체 관리자에게 적용)'
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error setting privacy password: {e}")
        return jsonify({'success': False, 'message': f'비밀번호 설정 중 오류가 발생했습니다: {str(e)}'})

@auth_bp.route('/verify-privacy-password', methods=['POST'])
@jwt_required()
def verify_privacy_password():
    """개인정보 보호 비밀번호 검증 - 전역 비밀번호 사용"""
    try:
        current_user_id = get_jwt_identity()
        current_user_obj = User.query.get(int(current_user_id))
        
        if not current_user_obj:
            return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다.'})
        
        data = request.get_json()
        password = data.get('password', '').strip()
        
        if not password:
            return jsonify({'success': False, 'message': '비밀번호를 입력해주세요.'})
        
        # 전역 개인정보 보호 비밀번호 조회
        setting = AppSetting.query.filter_by(setting_key='privacy_password').first()
        
        # 비밀번호가 설정되지 않았으면 자동 승인
        if not setting or not setting.setting_value:
            return jsonify({
                'success': True,
                'message': '개인정보 보호 비밀번호가 설정되지 않았습니다.',
                'password_not_set': True
            })
        
        # 비밀번호 검증
        if check_password_hash(setting.setting_value, password):
            return jsonify({
                'success': True,
                'message': '비밀번호가 확인되었습니다.'
            })
        else:
            return jsonify({
                'success': False,
                'message': '비밀번호가 올바르지 않습니다.'
            })
        
    except Exception as e:
        print(f"Error verifying privacy password: {e}")
        return jsonify({'success': False, 'message': f'비밀번호 검증 중 오류가 발생했습니다: {str(e)}'})

@auth_bp.route('/check-privacy-password-status', methods=['GET'])
@jwt_required()
def check_privacy_password_status():
    """개인정보 보호 비밀번호 설정 여부 확인 - 전역 설정"""
    try:
        current_user_id = get_jwt_identity()
        current_user_obj = User.query.get(int(current_user_id))
        
        if not current_user_obj:
            return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다.'})
        
        # 전역 비밀번호 설정 확인
        setting = AppSetting.query.filter_by(setting_key='privacy_password').first()
        
        return jsonify({
            'success': True,
            'password_set': bool(setting and setting.setting_value)
        })
        
    except Exception as e:
        print(f"Error checking privacy password status: {e}")
        return jsonify({'success': False, 'message': f'상태 확인 중 오류가 발생했습니다: {str(e)}'})

@auth_bp.route('/resend-verification-code', methods=['POST'])
def resend_verification_code():
    """인증 코드 재발송 (사용자용 - 인증 불필요)"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        
        if not email:
            return jsonify({'success': False, 'message': '이메일을 입력해주세요.'})
        
        # 사용자 찾기
        user = User.query.filter_by(email=email).first()
        
        if not user:
            return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다.'})
        
        if user.is_verified:
            return jsonify({'success': False, 'message': '이미 인증된 계정입니다.'})
        
        # 새 인증 코드 생성
        new_code = generate_verification_code()
        new_expires = datetime.utcnow() + timedelta(hours=24)
        
        user.verification_code = new_code
        user.verification_code_expires = new_expires
        
        db.session.commit()
        
        print(f"Resending verification code for {user.email}: {new_code}")
        
        # 이메일 재발송
        email_sent = send_verification_code_email(user.email, user.name, new_code)
        
        if email_sent:
            print(f"✅ 인증 코드 재발송 성공: {user.email}")
            return jsonify({
                'success': True,
                'message': f'{user.email}로 새로운 인증 코드를 발송했습니다. 이메일을 확인해주세요.',
                'email_sent': True
            })
        else:
            print(f"⚠️ 인증 코드 재발송 실패: {user.email}")
            return jsonify({
                'success': False,
                'message': '이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.',
                'email_sent': False
            })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error resending verification code: {e}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({'success': False, 'message': f'인증 코드 재발송 중 오류가 발생했습니다: {str(e)}'})
