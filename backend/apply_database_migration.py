#!/usr/bin/env python3
"""
데이터베이스 마이그레이션 스크립트
User 테이블에 인증 관련 컬럼을 추가합니다.
"""

import os
import sys
from sqlalchemy import text

# 현재 스크립트의 디렉토리를 Python 경로에 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from models import db

def apply_migration():
    """데이터베이스 마이그레이션 적용"""
    with app.app_context():
        try:
            print("=" * 60)
            print("데이터베이스 마이그레이션 시작")
            print("=" * 60)
            
            # SQL 파일 읽기
            sql_file = os.path.join(os.path.dirname(__file__), 'add_verification_columns.sql')
            
            if not os.path.exists(sql_file):
                print(f"❌ SQL 파일을 찾을 수 없습니다: {sql_file}")
                return False
            
            with open(sql_file, 'r', encoding='utf-8') as f:
                sql_content = f.read()
            
            print("\n실행할 SQL:")
            print("-" * 60)
            print(sql_content)
            print("-" * 60)
            
            # SQL 실행
            print("\n마이그레이션 실행 중...")
            
            # SQL을 세미콜론으로 분리하여 각각 실행
            statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip() and not stmt.strip().startswith('--')]
            
            for i, statement in enumerate(statements, 1):
                if statement:
                    print(f"\n[{i}/{len(statements)}] 실행 중...")
                    try:
                        result = db.session.execute(text(statement))
                        db.session.commit()
                        
                        # SELECT 문인 경우 결과 출력
                        if statement.strip().upper().startswith('SELECT'):
                            rows = result.fetchall()
                            if rows:
                                print("결과:")
                                for row in rows:
                                    print(f"  {dict(row._mapping)}")
                        
                        print(f"✅ 완료")
                    except Exception as e:
                        print(f"⚠️  경고: {str(e)}")
                        db.session.rollback()
                        # IF NOT EXISTS를 사용하므로 이미 존재하는 컬럼 오류는 무시
                        if 'already exists' not in str(e).lower() and 'duplicate column' not in str(e).lower():
                            raise
            
            print("\n" + "=" * 60)
            print("✅ 마이그레이션 완료!")
            print("=" * 60)
            
            # 최종 확인
            print("\n최종 테이블 구조 확인:")
            result = db.session.execute(text("""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = 'users'
                ORDER BY ordinal_position;
            """))
            
            print("\nUsers 테이블 컬럼:")
            print("-" * 60)
            for row in result:
                col_info = dict(row._mapping)
                print(f"  {col_info['column_name']:30} {col_info['data_type']:20} NULL: {col_info['is_nullable']}")
            
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
    
    # 자동 실행을 위한 환경 변수 체크
    if os.environ.get('AUTO_MIGRATE') == 'yes':
        confirm = 'y'
        print('y (자동 실행)')
    else:
        confirm = input().lower()
    
    if confirm == 'y':
        success = apply_migration()
        if success:
            print("\n이제 migrate_existing_users.py를 실행할 수 있습니다!")
            sys.exit(0)
        else:
            print("\n마이그레이션이 실패했습니다.")
            sys.exit(1)
    else:
        print("마이그레이션이 취소되었습니다.")
        sys.exit(0)
