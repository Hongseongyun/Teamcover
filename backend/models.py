from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(UserMixin, db.Model):
    """사용자 모델"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='user')  # 'user', 'admin', 'super_admin'
    google_id = db.Column(db.String(100), unique=True, nullable=True)
    password_hash = db.Column(db.String(128), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)
    
    # 인증 관련 필드
    is_verified = db.Column(db.Boolean, default=False)  # 인증 완료 여부
    verification_method = db.Column(db.String(20), nullable=True)  # 'email', 'code', 'auto'
    verification_code = db.Column(db.String(10), nullable=True)  # 인증 코드
    verification_code_expires = db.Column(db.DateTime, nullable=True)  # 인증 코드 만료 시간
    verified_at = db.Column(db.DateTime, nullable=True)  # 인증 완료 시간
    
    def __repr__(self):
        return f'<User {self.email}>'
    
    def set_password(self, password):
        """비밀번호 해시화"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """비밀번호 확인"""
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        """딕셔너리 형태로 변환"""
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'role': self.role,
            'is_active': self.is_active,
            'is_verified': self.is_verified,
            'verification_method': self.verification_method,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'last_login': self.last_login.strftime('%Y-%m-%d %H:%M:%S') if self.last_login else None,
            'verified_at': self.verified_at.strftime('%Y-%m-%d %H:%M:%S') if self.verified_at else None
        }

class Member(db.Model):
    """회원 모델"""
    __tablename__ = 'members'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    gender = db.Column(db.String(10), nullable=True)  # '남', '여'
    level = db.Column(db.String(20), nullable=True)   # '초급', '중급', '고급', '전문'
    email = db.Column(db.String(100), nullable=True)
    note = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<Member {self.name}>'
    
    def to_dict(self):
        """딕셔너리 형태로 변환"""
        return {
            'id': self.id,
            'name': self.name,
            'phone': self.phone,
            'gender': self.gender,
            'level': self.level,
            'email': self.email,
            'note': self.note,
            'created_at': self.created_at.strftime('%Y-%m-%d') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%Y-%m-%d') if self.updated_at else None
        }

class Score(db.Model):
    """스코어 모델"""
    __tablename__ = 'scores'
    
    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)
    game_date = db.Column(db.Date, nullable=False)
    score1 = db.Column(db.Integer, nullable=True)
    score2 = db.Column(db.Integer, nullable=True)
    score3 = db.Column(db.Integer, nullable=True)
    total_score = db.Column(db.Integer, nullable=True)
    average_score = db.Column(db.Float, nullable=True)
    note = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 관계 설정
    member = db.relationship('Member', backref=db.backref('scores', lazy=True))
    
    def __repr__(self):
        return f'<Score {self.member.name} {self.game_date}>'

class Point(db.Model):
    """포인트 모델"""
    __tablename__ = 'points'
    
    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)
    point_date = db.Column(db.Date, nullable=True)  # 구글 시트에서 가져온 날짜
    point_type = db.Column(db.String(20), nullable=False)  # '적립', '사용'
    amount = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(100), nullable=True)
    note = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)  # 시스템 등록 시간
    
    # 관계 설정
    member = db.relationship('Member', backref=db.backref('points', lazy=True))
    
    def __repr__(self):
        return f'<Point {self.member.name} {self.point_type} {self.amount}>' 