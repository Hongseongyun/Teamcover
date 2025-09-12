from flask import Flask, render_template, request, jsonify, session, redirect, url_for, make_response
from flask_cors import CORS
from flask_login import LoginManager, current_user
from flask_jwt_extended import JWTManager
from datetime import timedelta
from models import db, User
from config import Config

# Blueprint import (OCR 제외)
from blueprints.auth import auth_bp
from blueprints.members import members_bp
from blueprints.scores import scores_bp
from blueprints.points import points_bp
from blueprints.teams import teams_bp
from blueprints.sheets import sheets_bp

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

# CORS 설정
CORS(app, 
     origins=["http://localhost:3000", "http://localhost:8080"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
     supports_credentials=True)

# CORS preflight 요청을 위한 명시적 핸들러
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "http://localhost:3000")
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization,X-Requested-With")
        response.headers.add('Access-Control-Allow-Methods', "GET,PUT,POST,DELETE,OPTIONS")
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

# 데이터베이스 초기화
db.init_app(app)

# Blueprint 등록 (OCR 제외)
app.register_blueprint(auth_bp)
app.register_blueprint(members_bp)
app.register_blueprint(scores_bp)
app.register_blueprint(points_bp)
app.register_blueprint(teams_bp)
app.register_blueprint(sheets_bp)

# 페이지 라우트
@app.route('/')
def index():
    """메인 페이지"""
    return render_template('index.html')

@app.route('/members')
def members():
    """팀커버 회원 페이지"""
    return render_template('members.html')

@app.route('/scores')
def scores():
    """2025 스코어 페이지"""
    return render_template('scores.html')

@app.route('/points')
def points():
    """2025 포인트 페이지"""
    return render_template('points.html')

@app.route('/team-assignment')
def team_assignment():
    """팀 배정 페이지"""
    return render_template('team_assignment.html')

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
    with app.app_context():
        # 데이터베이스 테이블 생성
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5000) 