#!/usr/bin/env python3
"""슈퍼 관리자 계정 생성 스크립트"""

from app import app
from models import db, User

def create_super_admin():
    with app.app_context():
        print("슈퍼 관리자 계정을 생성합니다.")
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
    create_super_admin()
