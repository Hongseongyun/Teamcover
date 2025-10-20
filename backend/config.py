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
    
    # PostgreSQL 데이터베이스 설정 - 안전한 연결 보장
    def get_database_uri():
        """안전한 데이터베이스 URI 생성"""
        print("=== 데이터베이스 URI 생성 시작 ===")
        
        # 1순위: Private Network URL
        private_url = os.environ.get('DATABASE_PRIVATE_URL')
        if private_url and private_url != '' and not private_url.startswith('postgresql://postgres:'):
            print(f"✅ Private Network URL 사용: {private_url[:50]}...")
            return private_url
        
        # 2순위: 일반 DATABASE_URL
        database_url = os.environ.get('DATABASE_URL')
        if database_url and database_url != '':
            print(f"✅ 일반 DATABASE_URL 사용: {database_url[:50]}...")
            return database_url
        
        # 3순위: 개별 변수로 구성
        pg_host = os.environ.get('PGHOST')
        pg_port = os.environ.get('PGPORT')
        pg_user = os.environ.get('PGUSER')
        pg_password = os.environ.get('PGPASSWORD')
        pg_database = os.environ.get('PGDATABASE')
        
        print(f"개별 변수 확인:")
        print(f"  PGHOST: {pg_host}")
        print(f"  PGPORT: {pg_port}")
        print(f"  PGUSER: {pg_user}")
        print(f"  PGPASSWORD: {'SET' if pg_password else 'NOT_SET'}")
        print(f"  PGDATABASE: {pg_database}")
        
        if all([pg_host, pg_port, pg_user, pg_password, pg_database]):
            # 포트가 숫자인지 확인
            try:
                int(pg_port)
                constructed_url = f"postgresql://{pg_user}:{pg_password}@{pg_host}:{pg_port}/{pg_database}"
                print(f"✅ 개별 변수로 구성된 URL 사용: {constructed_url[:50]}...")
                return constructed_url
            except ValueError:
                print(f"❌ PGPORT가 숫자가 아님: {pg_port}")
        
        # 4순위: DATABASE_PUBLIC_URL (최후의 수단)
        public_url = os.environ.get('DATABASE_PUBLIC_URL')
        if public_url and public_url != '':
            print(f"⚠️ Public URL 사용 (egress 비용 발생): {public_url[:50]}...")
            return public_url
        
        # 5순위: 기본값 (개발 환경)
        default_url = "postgresql://postgres:password@localhost:5432/teamcover"
        print(f"❌ 기본값 사용 (개발 환경): {default_url}")
        return default_url
    
    # 데이터베이스 URI 설정
    DATABASE_URL = get_database_uri()
    
    # SQLAlchemy 설정
    if DATABASE_URL.startswith('postgres://'):
        SQLALCHEMY_DATABASE_URI = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
    else:
        SQLALCHEMY_DATABASE_URI = DATABASE_URL
    
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
        'connect_args': {
            'connect_timeout': 30,  # 연결 타임아웃 증가
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