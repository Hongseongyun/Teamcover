from flask import Blueprint, request, jsonify, make_response, session
from flask_login import login_user, logout_user, login_required, current_user
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, verify_jwt_in_request
from datetime import datetime, timedelta
from models import db, User
import google.auth.transport.requests
from google.oauth2 import id_token
import os
import requests

# 인증 관리 Blueprint
auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

# 구글 OAuth 설정 (app.config에서 가져오기)
from flask import current_app

def get_google_credentials():
    """Google OAuth 설정 가져오기"""
    return {
        'client_id': current_app.config.get('GOOGLE_CLIENT_ID', 'your-google-client-id'),
        'client_secret': current_app.config.get('GOOGLE_CLIENT_SECRET', 'your-google-client-secret')
    }

@auth_bp.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "http://localhost:3000")
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
        print(f"JWT 검증 오류: {e}")
        return None

@auth_bp.route('/register', methods=['POST'])
def register():
    """일반 회원가입"""
    try:
        data = request.get_json()
        
        email = data.get('email', '').strip().lower()
        name = data.get('name', '').strip()
        password = data.get('password', '')
        role = data.get('role', 'user')  # 기본값은 'user'
        
        if not email or not name or not password:
            return jsonify({'success': False, 'message': '이메일, 이름, 비밀번호는 필수 입력 항목입니다.'})
        
        # 이메일 중복 확인
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({'success': False, 'message': '이미 등록된 이메일입니다.'})
        
        # 새 사용자 생성
        new_user = User(
            email=email,
            name=name,
            role=role
        )
        new_user.set_password(password)
        
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '회원가입이 완료되었습니다.',
            'user': new_user.to_dict()
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
        
        if not code:
            return jsonify({'success': False, 'message': 'Authorization code가 필요합니다.'})
        
        # 이미 사용된 code인지 확인
        if code in used_codes:
            return jsonify({'success': False, 'message': '이미 사용된 authorization code입니다.'})
        
        # code를 사용된 것으로 표시
        used_codes.add(code)
        
        # Google OAuth 설정 가져오기
        google_creds = get_google_credentials()
        print(f"Google OAuth credentials: {google_creds}")
        
        # Google OAuth2 토큰 교환
        token_url = 'https://oauth2.googleapis.com/token'
        token_data = {
            'client_id': google_creds['client_id'],
            'client_secret': google_creds['client_secret'],
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': 'http://localhost:3000/google-callback'  # 프론트엔드 리디렉션 URI 사용
        }
        
        token_response = requests.post(token_url, data=token_data)
        token_json = token_response.json()
        
        print(f"Google token response status: {token_response.status_code}")
        print(f"Google token response: {token_json}")
        
        if 'access_token' not in token_json:
            error_message = token_json.get('error_description', token_json.get('error', 'Unknown error'))
            return jsonify({'success': False, 'message': f'구글 토큰 교환에 실패했습니다: {error_message}'})
        
        # 사용자 정보 가져오기
        user_info_url = 'https://www.googleapis.com/oauth2/v2/userinfo'
        headers = {'Authorization': f'Bearer {token_json["access_token"]}'}
        user_response = requests.get(user_info_url, headers=headers)
        user_info = user_response.json()
        
        print(f"Google user info response status: {user_response.status_code}")
        print(f"Google user info: {user_info}")
        
        google_id = user_info.get('id')
        email = user_info.get('email')
        name = user_info.get('name')
        
        if not google_id or not email or not name:
            return jsonify({'success': False, 'message': '구글 계정 정보를 가져올 수 없습니다.'})
        
        print(f"=== Google User Processing ===")
        print(f"Google ID: {google_id}")
        print(f"Email: {email}")
        print(f"Name: {name}")
        
        # 기존 사용자 확인 또는 새 사용자 생성
        user = User.query.filter_by(google_id=google_id).first()
        print(f"Existing user by google_id: {user}")
        
        if not user:
            # 이메일로 기존 사용자 확인
            existing_user = User.query.filter_by(email=email).first()
            print(f"Existing user by email: {existing_user}")
            if existing_user:
                # 기존 사용자에 구글 ID 연결
                existing_user.google_id = google_id
                user = existing_user
                print(f"Linked existing user with Google ID: {user}")
            else:
                # 새 사용자 생성 (기본 역할: user)
                user = User(
                    google_id=google_id,
                    email=email,
                    name=name,
                    role='user',
                    is_active=True
                )
                db.session.add(user)
                print(f"Created new user: {user}")
                try:
                    db.session.commit()
                    print(f"New user saved to database: {user.id}")
                except Exception as e:
                    print(f"Error saving new user: {e}")
                    db.session.rollback()
                    return jsonify({'success': False, 'message': f'사용자 생성 중 오류가 발생했습니다: {str(e)}'})
        
        print(f"User before login: {user}")
        print(f"User is_active: {user.is_active}")
        
        if not user.is_active:
            print(f"User is inactive, returning error")
            return jsonify({'success': False, 'message': '비활성화된 계정입니다.'})
        
        # 로그인 처리
        login_user(user, remember=True)
        user.last_login = datetime.utcnow()
        db.session.commit()
        print(f"User logged in successfully: {user.email}")
        
        # JWT 토큰 생성
        access_token = create_access_token(
            identity=str(user.id),
            expires_delta=timedelta(days=7)
        )
        print(f"JWT token created for user: {user.id}")
        print(f"=== Google Login Success ===")
        
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
@login_required
def logout():
    """로그아웃"""
    try:
        logout_user()
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

@auth_bp.route('/google/config', methods=['GET'])
def get_google_config():
    """Google OAuth 설정 확인 (디버깅용)"""
    try:
        google_creds = get_google_credentials()
        return jsonify({
            'success': True,
            'client_id': google_creds['client_id'],
            'client_secret_set': bool(google_creds['client_secret'] and google_creds['client_secret'] != 'your-google-client-secret-here'),
            'redirect_uri': 'http://localhost:3000/google-callback'
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'설정 확인 중 오류: {str(e)}'})
