#!/usr/bin/env python3
"""
앱 설정 테이블 추가 마이그레이션
"""

import os
import sys
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from models import db

def apply_migration():
    """데이터베이스 마이그레이션 적용"""
    with app.app_context():
        try:
            print("=" * 60)
            print("앱 설정 테이블 생성")
            print("=" * 60)
            
            # app_settings 테이블 생성
            print("\napp_settings 테이블 생성 중...")
            db.session.execute(text("""
                CREATE TABLE IF NOT EXISTS app_settings (
                    id SERIAL PRIMARY KEY,
                    setting_key VARCHAR(50) UNIQUE NOT NULL,
                    setting_value TEXT,
                    updated_at TIMESTAMP DEFAULT NOW(),
                    updated_by INTEGER REFERENCES users(id)
                );
            """))
            db.session.commit()
            print("✅ 테이블 생성 완료")
            
            # 인덱스 생성
            print("\n인덱스 생성 중...")
            db.session.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_app_settings_key 
                ON app_settings(setting_key);
            """))
            db.session.commit()
            print("✅ 인덱스 생성 완료")
            
            # 결과 확인
            print("\n테이블 확인:")
            result = db.session.execute(text("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'app_settings'
                ORDER BY ordinal_position;
            """))
            
            for row in result:
                print(f"  {dict(row._mapping)}")
            
            print("\n" + "=" * 60)
            print("✅ 마이그레이션 완료!")
            print("=" * 60)
            
            return True
            
        except Exception as e:
            print(f"\n❌ 마이그레이션 실패: {str(e)}")
            import traceback
            print(traceback.format_exc())
            db.session.rollback()
            return False

if __name__ == '__main__':
    print("\n⚠️  주의: 이 스크립트는 데이터베이스에 새 테이블을 생성합니다.")
    print("계속하시겠습니까? (y/n): ", end='')
    
    if os.environ.get('AUTO_MIGRATE') == 'yes':
        confirm = 'y'
        print('y (자동 실행)')
    else:
        confirm = input().lower()
    
    if confirm == 'y':
        success = apply_migration()
        sys.exit(0 if success else 1)
    else:
        print("마이그레이션이 취소되었습니다.")
        sys.exit(0)

