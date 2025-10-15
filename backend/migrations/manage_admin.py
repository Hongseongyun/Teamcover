#!/usr/bin/env python3
"""슈퍼 관리자 계정 관리 스크립트"""

from app import app
from models import db, User

def list_users():
    """모든 사용자 목록 출력"""
    with app.app_context():
        users = User.query.all()
        print("\n=== 사용자 목록 ===")
        for user in users:
            print(f"ID: {user.id}, 이메일: {user.email}, 이름: {user.name}, 역할: {user.role}, 활성: {user.is_active}")
        print()

def update_admin():
    """슈퍼 관리자 계정 수정"""
    with app.app_context():
        # 현재 슈퍼 관리자 목록 출력
        admins = User.query.filter_by(role='super_admin').all()
        print("\n=== 현재 슈퍼 관리자 목록 ===")
        for admin in admins:
            print(f"ID: {admin.id}, 이메일: {admin.email}, 이름: {admin.name}")
        
        if not admins:
            print("슈퍼 관리자가 없습니다.")
            return
        
        # 수정할 관리자 선택
        admin_id = input("\n수정할 슈퍼 관리자 ID를 입력하세요: ")
        try:
            admin = User.query.get(int(admin_id))
            if not admin or admin.role != 'super_admin':
                print("해당 ID의 슈퍼 관리자를 찾을 수 없습니다.")
                return
            
            print(f"\n현재 정보: 이메일={admin.email}, 이름={admin.name}")
            
            # 새 정보 입력
            new_email = input(f"새 이메일 (현재: {admin.email}): ").strip()
            new_name = input(f"새 이름 (현재: {admin.name}): ").strip()
            new_password = input("새 비밀번호 (변경하지 않으려면 Enter): ").strip()
            
            # 정보 업데이트
            if new_email:
                admin.email = new_email
            if new_name:
                admin.name = new_name
            if new_password:
                admin.set_password(new_password)
            
            db.session.commit()
            print(f"슈퍼 관리자 계정이 수정되었습니다: {admin.email}")
            
        except ValueError:
            print("올바른 ID를 입력해주세요.")

def delete_admin():
    """슈퍼 관리자 계정 삭제"""
    with app.app_context():
        # 현재 슈퍼 관리자 목록 출력
        admins = User.query.filter_by(role='super_admin').all()
        print("\n=== 현재 슈퍼 관리자 목록 ===")
        for admin in admins:
            print(f"ID: {admin.id}, 이메일: {admin.email}, 이름: {admin.name}")
        
        if not admins:
            print("슈퍼 관리자가 없습니다.")
            return
        
        # 삭제할 관리자 선택
        admin_id = input("\n삭제할 슈퍼 관리자 ID를 입력하세요: ")
        try:
            admin = User.query.get(int(admin_id))
            if not admin or admin.role != 'super_admin':
                print("해당 ID의 슈퍼 관리자를 찾을 수 없습니다.")
                return
            
            confirm = input(f"정말로 {admin.email} 계정을 삭제하시겠습니까? (y/N): ")
            if confirm.lower() == 'y':
                db.session.delete(admin)
                db.session.commit()
                print(f"슈퍼 관리자 계정이 삭제되었습니다: {admin.email}")
            else:
                print("삭제가 취소되었습니다.")
                
        except ValueError:
            print("올바른 ID를 입력해주세요.")

def create_new_admin():
    """새 슈퍼 관리자 계정 생성"""
    with app.app_context():
        print("\n새 슈퍼 관리자 계정을 생성합니다.")
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

def main():
    while True:
        print("\n=== 슈퍼 관리자 계정 관리 ===")
        print("1. 사용자 목록 보기")
        print("2. 슈퍼 관리자 수정")
        print("3. 슈퍼 관리자 삭제")
        print("4. 새 슈퍼 관리자 생성")
        print("5. 종료")
        
        choice = input("\n선택하세요 (1-5): ").strip()
        
        if choice == '1':
            list_users()
        elif choice == '2':
            update_admin()
        elif choice == '3':
            delete_admin()
        elif choice == '4':
            create_new_admin()
        elif choice == '5':
            print("종료합니다.")
            break
        else:
            print("올바른 선택을 해주세요.")

if __name__ == '__main__':
    main()
