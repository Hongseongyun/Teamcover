#!/usr/bin/env python3
"""
기존 사용자 마이그레이션 스크립트
- 기존 사용자들을 인증 완료 상태(is_verified=True)로 자동 설정
- 데이터베이스에 새로 추가된 필드들을 안전하게 업데이트
"""

import os
import sys
from datetime import datetime

# 현재 스크립트의 디렉토리를 Python 경로에 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from models import db, User

def migrate_existing_users():
    """기존 사용자들을 인증 완료 상태로 마이그레이션"""
    with app.app_context():
        try:
            print("=" * 50)
            print("기존 사용자 마이그레이션 시작")
            print("=" * 50)
            
            # 모든 사용자 조회
            all_users = User.query.all()
            print(f"\n총 {len(all_users)}명의 사용자를 찾았습니다.")
            
            if len(all_users) == 0:
                print("마이그레이션할 사용자가 없습니다.")
                return
            
            # 마이그레이션이 필요한 사용자 필터링 (is_verified가 None 또는 False인 경우)
            users_to_migrate = [user for user in all_users if not user.is_verified]
            
            if len(users_to_migrate) == 0:
                print("\n✅ 모든 사용자가 이미 인증 완료 상태입니다.")
                return
            
            print(f"\n{len(users_to_migrate)}명의 사용자를 마이그레이션합니다:")
            print("-" * 50)
            
            migrated_count = 0
            
            for user in users_to_migrate:
                try:
                    print(f"\n처리 중: {user.email} ({user.name})")
                    
                    # 기존 사용자는 자동으로 인증 완료 처리
                    user.is_verified = True
                    user.verified_at = datetime.utcnow()
                    
                    # 인증 방식 설정
                    if user.google_id:
                        # 구글 로그인 사용자는 'auto'로 설정 (기존 사용자는 자동 인증)
                        user.verification_method = 'auto'
                        print(f"  - 구글 로그인 사용자 -> verification_method: auto")
                    elif user.password_hash:
                        # 일반 회원가입 사용자는 'email'로 설정
                        user.verification_method = 'email'
                        print(f"  - 일반 회원가입 사용자 -> verification_method: email")
                    else:
                        # 기타
                        user.verification_method = 'auto'
                        print(f"  - 기타 사용자 -> verification_method: auto")
                    
                    # 인증 코드 필드는 NULL로 설정 (기존 사용자는 필요 없음)
                    user.verification_code = None
                    user.verification_code_expires = None
                    
                    print(f"  ✅ is_verified: True")
                    print(f"  ✅ verified_at: {user.verified_at}")
                    
                    migrated_count += 1
                    
                except Exception as e:
                    print(f"  ❌ 오류 발생: {str(e)}")
                    db.session.rollback()
                    continue
            
            # 변경사항 커밋
            if migrated_count > 0:
                try:
                    db.session.commit()
                    print("\n" + "=" * 50)
                    print(f"✅ 마이그레이션 완료: {migrated_count}명의 사용자 업데이트됨")
                    print("=" * 50)
                except Exception as e:
                    db.session.rollback()
                    print(f"\n❌ 커밋 실패: {str(e)}")
                    return
            else:
                print("\n⚠️ 업데이트된 사용자가 없습니다.")
            
            # 최종 상태 확인
            print("\n" + "=" * 50)
            print("마이그레이션 후 사용자 상태:")
            print("=" * 50)
            
            all_users_after = User.query.all()
            for user in all_users_after:
                status = "✅ 인증 완료" if user.is_verified else "❌ 미인증"
                method = user.verification_method or "N/A"
                print(f"{status} | {user.email:30} | {user.name:15} | 방식: {method}")
            
        except Exception as e:
            print(f"\n❌ 마이그레이션 중 오류 발생: {str(e)}")
            import traceback
            print(traceback.format_exc())
            db.session.rollback()

if __name__ == '__main__':
    print("\n⚠️  주의: 이 스크립트는 기존 사용자 데이터를 수정합니다.")
    print("계속하시겠습니까? (y/n): ", end='')
    
    # 자동 실행을 위한 환경 변수 체크
    if os.environ.get('AUTO_MIGRATE') == 'yes':
        confirm = 'y'
        print('y (자동 실행)')
    else:
        confirm = input().lower()
    
    if confirm == 'y':
        migrate_existing_users()
    else:
        print("마이그레이션이 취소되었습니다.")
