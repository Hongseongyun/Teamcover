import os
from dotenv import load_dotenv

# .env 파일 로드 (백엔드 디렉토리 기준)
env_path = os.path.join(os.path.dirname(__file__), '.env')
print(f"Loading .env from: {env_path}")
load_dotenv(env_path)

# 환경변수 로드 확인
print(f"GOOGLE_CLIENT_ID: {os.environ.get('GOOGLE_CLIENT_ID', 'NOT_SET')}")
print(f"GOOGLE_CLIENT_SECRET: {'SET' if os.environ.get('GOOGLE_CLIENT_SECRET') else 'NOT_SET'}")

class Config:
    # Flask 설정
    SECRET_KEY = os.environ.get('FLASK_SECRET_KEY') or 'teamcover_secret_key_2025'
    
    # PostgreSQL 데이터베이스 설정
    # 우선순위: DATABASE_URL(풀 URI) > 개별 항목(DB_HOST 등)
    # Railway에서는 DATABASE_URL 또는 DATABASE_PUBLIC_URL을 제공합니다
    DATABASE_URL = os.environ.get('DATABASE_URL') or os.environ.get('DATABASE_PUBLIC_URL')
    DB_HOST = os.environ.get('DB_HOST') or 'localhost'
    DB_PORT = os.environ.get('DB_PORT') or '5432'
    DB_NAME = os.environ.get('DB_NAME') or 'teamcover_db'
    DB_USER = os.environ.get('DB_USER') or 'postgres'
    DB_PASSWORD = os.environ.get('DB_PASSWORD') or 'teamcover123'

    # SQLAlchemy 설정 (psycopg2 드라이버 사용)
    if DATABASE_URL:
        # Railway의 postgres:// URL을 postgresql://로 변환
        if DATABASE_URL.startswith('postgres://'):
            SQLALCHEMY_DATABASE_URI = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
        else:
            SQLALCHEMY_DATABASE_URI = DATABASE_URL
    else:
        SQLALCHEMY_DATABASE_URI = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
        'connect_args': {
            'connect_timeout': 10,
        }
    }
    
    # Google OAuth 2.0 설정
    GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID') or '여기에_실제_클라이언트_ID_입력'
    GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET') or '여기에_실제_클라이언트_시크릿_입력'
    
    # JWT 설정
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'your-secret-key-change-this-in-production'

    # Frontend/Base URL 및 CORS 설정
    FRONTEND_BASE_URL = os.environ.get('FRONTEND_BASE_URL') or 'http://localhost:3000'
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS')  # 콤마(,)로 구분된 허용 오리진 목록
    if CORS_ORIGINS:
        CORS_ALLOWED_ORIGINS = [origin.strip() for origin in CORS_ORIGINS.split(',') if origin.strip()]
    else:
        CORS_ALLOWED_ORIGINS = [FRONTEND_BASE_URL]

    # Google OAuth Redirect URI
    # 환경변수에서 설정하거나 기본값으로 프론트엔드 도메인 사용
    GOOGLE_REDIRECT_URI = os.environ.get('GOOGLE_REDIRECT_URI') or f"{FRONTEND_BASE_URL}/google-callback"