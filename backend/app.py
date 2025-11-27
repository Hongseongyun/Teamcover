from flask import Flask, request, jsonify, session, redirect, url_for, make_response
from flask_cors import CORS
from flask_login import LoginManager, current_user
from flask_jwt_extended import JWTManager
from datetime import timedelta, datetime
import os
from models import db, User
from config import Config
from email_service import init_mail

# Blueprint import (OCR 제외)
from blueprints.auth import auth_bp
from blueprints.members import members_bp
from blueprints.scores import scores_bp
from blueprints.points import points_bp
from blueprints.teams import teams_bp
from blueprints.ocr import ocr_bp
from blueprints.payments import payments_bp

# Google Sheets 기능을 선택적으로 로드
try:
    from blueprints.sheets import sheets_bp
    SHEETS_AVAILABLE = True
except ImportError as e:
    SHEETS_AVAILABLE = False

app = Flask(__name__)
app.config.from_object(Config)

# Flask 세션 설정 (메모리 기반으로 단순화)
app.config['SECRET_KEY'] = 'your-secret-key-change-this-in-production-12345'
app.config['SESSION_COOKIE_NAME'] = 'teamcover_session'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = False  # HTTP에서도 작동하도록
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)

# JWT 설정
app.config['JWT_SECRET_KEY'] = app.config.get('JWT_SECRET_KEY', 'your-secret-key-change-this-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)  # 토큰 만료 시간 설정

# Flask-Login 설정
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'
login_manager.login_message = '로그인이 필요합니다.'

# JWT 설정
jwt = JWTManager(app)

@jwt.token_in_blocklist_loader
def check_if_token_revoked(jwt_header, jwt_payload):
    """JWT 토큰이 무효화되었는지 확인 (active_token의 jti와 비교)"""
    try:
        user_id = jwt_payload.get('sub')
        if not user_id:
            return True  # 사용자 ID가 없으면 무효화된 것으로 간주
        
        user = User.query.get(int(user_id))
        if not user:
            return True  # 사용자가 없으면 무효화된 것으로 간주
        
        # active_token이 없으면 (첫 로그인 또는 로그아웃) 허용
        if not user.active_token:
            return False  # 블랙리스트에 없음 (유효)
        
        # 현재 토큰의 jti 가져오기
        current_jti = jwt_payload.get('jti')
        
        # active_token이 jti 형식인지 확인 (UUID 형식: 36자, 하이픈 포함)
        # 또는 전체 토큰 문자열인지 확인
        active_token_is_jti = len(user.active_token) == 36 and user.active_token.count('-') == 4
        
        if current_jti:
            # 새 방식: jti 사용
            if active_token_is_jti:
                # active_token도 jti 형식이면 jti로 비교
                if user.active_token != current_jti:
                    return True  # 블랙리스트에 있음 (무효화됨)
            else:
                # active_token이 전체 토큰 문자열이면, jti 토큰은 무효화된 것으로 간주
                # (새 로그인이 발생했으므로)
                return True  # 블랙리스트에 있음 (무효화됨)
        else:
            # 이전 방식: 전체 토큰 문자열 사용
            if active_token_is_jti:
                # active_token이 jti인데 현재 토큰에 jti가 없으면
                # 이전 방식 토큰이므로 무효화된 것으로 간주
                return True  # 블랙리스트에 있음 (무효화됨)
            else:
                # 둘 다 전체 토큰 문자열이면, request에서 토큰을 가져와 비교
                from flask import request
                auth_header = request.headers.get('Authorization', '')
                if auth_header.startswith('Bearer '):
                    current_token = auth_header.replace('Bearer ', '')
                    if user.active_token != current_token:
                        return True  # 블랙리스트에 있음 (무효화됨)
                else:
                    return True  # 토큰이 없으면 무효화된 것으로 간주
        
        return False  # 블랙리스트에 없음 (유효)
    except Exception as e:
        # 에러 발생 시 로그 출력하고 안전하게 처리
        print(f"Error in check_if_token_revoked: {e}")
        import traceback
        traceback.print_exc()
        return False  # 에러 발생 시 일단 허용 (서버가 멈추지 않도록)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# CORS 설정 (환경변수 기반)
allowed_origins = app.config.get('CORS_ALLOWED_ORIGINS', [
    "http://localhost:3000", 
    "http://localhost:8080", 
    "https://hsyun.store",
    "https://www.hsyun.store",
    "https://teamcover-frontend.vercel.app"
])

# CORS 설정 디버깅
print(f"=== CORS 설정 정보 ===")
print(f"Allowed Origins: {allowed_origins}")
print(f"Frontend Base URL: {app.config.get('FRONTEND_BASE_URL')}")
print(f"CORS Origins Config: {app.config.get('CORS_ORIGINS')}")

# CORS 설정

CORS(app,
     origins=allowed_origins,
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization", "X-Requested-With", "X-Privacy-Token"],
     supports_credentials=True,
     expose_headers=["Content-Type", "Authorization"])

# CORS는 flask-cors 라이브러리로만 처리 (중복 방지)

# 데이터베이스 초기화
db.init_app(app)

# 세션은 메모리 기반으로 사용 (단순화)

# 이메일 서비스 초기화
init_mail(app)

# Blueprint 등록 (OCR 제외)
app.register_blueprint(auth_bp)
app.register_blueprint(members_bp)
app.register_blueprint(scores_bp)
app.register_blueprint(points_bp)
app.register_blueprint(teams_bp)
app.register_blueprint(ocr_bp)
app.register_blueprint(payments_bp)

# Google Sheets 기능이 사용 가능한 경우에만 등록
if SHEETS_AVAILABLE:
    app.register_blueprint(sheets_bp)

# 헬스체크 엔드포인트
@app.route('/health')
def health_check():
    """헬스체크 엔드포인트"""
    return jsonify({
        'status': 'healthy',
        'message': '서버가 정상적으로 작동 중입니다.',
        'timestamp': str(datetime.utcnow())
    }), 200

@app.route('/health/db')
def health_check_db():
    """데이터베이스 헬스체크 엔드포인트"""
    try:
        # 데이터베이스 연결 테스트 (SQLAlchemy 2.0 문법)
        from sqlalchemy import text
        db.session.execute(text('SELECT 1'))
        return jsonify({
            'status': 'healthy',
            'message': '데이터베이스가 정상적으로 연결되었습니다.',
            'database': 'connected'
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'message': f'데이터베이스 연결 오류: {str(e)}',
            'database': 'disconnected'
        }), 500

# API 정보 엔드포인트
@app.route('/')
def index():
    """API 서버 정보"""
    return jsonify({
        'service': 'Teamcover API Server',
        'version': '1.0.0',
        'status': 'running',
        'endpoints': {
            'health': '/health',
            'health_db': '/health/db',
            'auth': '/api/auth/*',
            'members': '/api/members/*',
            'scores': '/api/scores/*',
            'points': '/api/points/*',
            'teams': '/api/teams/*',
            'ocr': '/api/ocr/*',
            'sheets': '/api/sheets/*' if SHEETS_AVAILABLE else 'disabled'
        },
        'timestamp': str(datetime.utcnow())
    }), 200

# 데이터베이스 초기화 명령
@app.cli.command('init-db')
def init_db():
    """데이터베이스 초기화"""
    db.create_all()

@app.cli.command('create-super-admin')
def create_super_admin():
    """슈퍼 관리자 계정 생성"""
    with app.app_context():
        email = input("슈퍼 관리자 이메일: ")
        name = input("슈퍼 관리자 이름: ")
        password = input("비밀번호: ")
        
        # 기존 슈퍼 관리자 확인
        existing_admin = User.query.filter_by(email=email).first()
        if existing_admin:
            return
        
        # 슈퍼 관리자 생성
        admin = User(
            email=email,
            name=name,
            role='super_admin'
        )
        admin.set_password(password)
        
        db.session.add(admin)
        db.session.commit()
        
        # 슈퍼 관리자 계정 생성 완료

# 데이터베이스 초기화 (애플리케이션 시작 시)
with app.app_context():
    try:
        # 데이터베이스 연결 테스트
        from sqlalchemy import text
        db.session.execute(text('SELECT 1'))
        print("✅ 데이터베이스 연결 성공")
        # 데이터베이스 테이블 생성
        db.create_all()
        print("✅ 데이터베이스 테이블 생성 완료")
    except Exception as e:
        print(f"❌ 데이터베이스 초기화 실패: {e}")
        # 연결 실패 시 재시도 로직
        import time
        time.sleep(5)  # 5초 대기 후 재시도
        try:
            db.session.execute(text('SELECT 1'))
            db.create_all()
            print("✅ 데이터베이스 재연결 성공")
        except Exception as e2:
            print(f"❌ 데이터베이스 재연결 실패: {e2}")

if __name__ == '__main__':
    # Railway 환경에서는 PORT 환경변수를 사용
    port = int(os.environ.get('PORT', 5000))
    
    # 개발 환경에서만 Flask 개발 서버 실행
    # Railway에서는 gunicorn을 사용하므로 이 부분은 실행되지 않음
    if os.environ.get('FLASK_ENV') != 'production':
        app.run(debug=False, host='0.0.0.0', port=port) 