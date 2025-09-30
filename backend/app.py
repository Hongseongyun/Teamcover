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

# Google Sheets 기능을 선택적으로 로드
try:
    from blueprints.sheets import sheets_bp
    SHEETS_AVAILABLE = True
    print("Google Sheets 기능이 활성화되었습니다.")
except ImportError as e:
    print(f"Google Sheets 기능을 로드할 수 없습니다: {e}")
    SHEETS_AVAILABLE = False

app = Flask(__name__)
app.config.from_object(Config)

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

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# CORS 설정 (환경변수 기반)
allowed_origins = app.config.get('CORS_ALLOWED_ORIGINS', ["http://localhost:3000", "http://localhost:8080", "https://hsyun.store"]) 
CORS(app,
     origins=allowed_origins,
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
     supports_credentials=True)

# CORS preflight 요청을 위한 명시적 핸들러
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = make_response()
        # 요청 Origin을 그대로 반영하되, 허용 목록에 있는 경우에만 설정
        request_origin = request.headers.get('Origin')
        if request_origin and request_origin in allowed_origins:
            response.headers.add("Access-Control-Allow-Origin", request_origin)
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization,X-Requested-With")
        response.headers.add('Access-Control-Allow-Methods', "GET,PUT,POST,DELETE,OPTIONS")
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

# 데이터베이스 초기화
db.init_app(app)

# 이메일 서비스 초기화
init_mail(app)

# Blueprint 등록 (OCR 제외)
app.register_blueprint(auth_bp)
app.register_blueprint(members_bp)
app.register_blueprint(scores_bp)
app.register_blueprint(points_bp)
app.register_blueprint(teams_bp)
app.register_blueprint(ocr_bp)

# Google Sheets 기능이 사용 가능한 경우에만 등록
if SHEETS_AVAILABLE:
    app.register_blueprint(sheets_bp)
    print("Google Sheets Blueprint가 등록되었습니다.")
else:
    print("Google Sheets Blueprint를 건너뛰었습니다.")

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
            print("이미 존재하는 이메일입니다.")
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
        
        print(f"슈퍼 관리자 계정이 생성되었습니다: {email}")

if __name__ == '__main__':
    print("=== Teamcover 애플리케이션 시작 ===")
    
    with app.app_context():
        try:
            # 데이터베이스 테이블 생성
            db.create_all()
            print("✓ 데이터베이스 테이블이 생성되었습니다.")
        except Exception as e:
            print(f"✗ 데이터베이스 연결 오류: {e}")
    
    # Railway 환경에서는 PORT 환경변수를 사용
    port = int(os.environ.get('PORT', 5000))
    print(f"✓ 서버가 포트 {port}에서 시작됩니다.")
    print(f"✓ 헬스체크 URL: http://0.0.0.0:{port}/health")
    print("=== 애플리케이션 시작 완료 ===")
    
    # 개발 환경에서만 Flask 개발 서버 실행
    # Railway에서는 gunicorn을 사용하므로 이 부분은 실행되지 않음
    if __name__ == '__main__' and os.environ.get('FLASK_ENV') != 'production':
        app.run(debug=False, host='0.0.0.0', port=port) 