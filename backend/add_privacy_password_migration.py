#!/usr/bin/env python3
"""
개인정보 보호 비밀번호 필드 추가 마이그레이션
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
            print("개인정보 보호 비밀번호 필드 추가")
            print("=" * 60)
            
            # privacy_password_hash 컬럼 추가
            print("\nprivacy_password_hash 컬럼 추가 중...")
            db.session.execute(text("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS privacy_password_hash VARCHAR(128);
            """))
            db.session.commit()
            print("✅ 컬럼 추가 완료")
            
            # 결과 확인
            print("\n테이블 구조 확인:")
            result = db.session.execute(text("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'users'
                AND column_name = 'privacy_password_hash';
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
    print("\n⚠️  주의: 이 스크립트는 데이터베이스 스키마를 변경합니다.")
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

