#!/usr/bin/env python3
"""
고정 슈퍼계정 생성 스크립트
syun4224@naver.com / 123qweASD! 계정을 생성합니다.
"""

import os
import sys
from datetime import datetime

# 현재 디렉토리를 Python 경로에 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app, db, User

def create_super_admin():
    """고정 슈퍼계정 생성"""
    with app.app_context():
        try:
            # 기존 슈퍼계정 확인
            existing_admin = User.query.filter_by(email='syun4224@naver.com').first()
            if existing_admin:
                print(f"슈퍼계정이 이미 존재합니다: {existing_admin.email}")
                print(f"현재 역할: {existing_admin.role}")
                
                # 역할이 super_admin이 아니면 업데이트
                if existing_admin.role != 'super_admin':
                    existing_admin.role = 'super_admin'
                    existing_admin.set_password('123qweASD!')
                    db.session.commit()
                    print("슈퍼계정 역할로 업데이트되었습니다.")
                return
            
            # 새 슈퍼계정 생성
            admin = User(
                email='syun4224@naver.com',
                name='슈퍼관리자',
                role='super_admin',
                is_active=True
            )
            admin.set_password('123qweASD!')
            
            db.session.add(admin)
            db.session.commit()
            
            print("✅ 고정 슈퍼계정이 생성되었습니다!")
            print(f"이메일: syun4224@naver.com")
            print(f"비밀번호: 123qweASD!")
            print(f"역할: super_admin")
            
        except Exception as e:
            print(f"❌ 슈퍼계정 생성 실패: {e}")
            db.session.rollback()

if __name__ == "__main__":
    print("=== 고정 슈퍼계정 생성 ===")
    create_super_admin()
    print("=== 완료 ===")
