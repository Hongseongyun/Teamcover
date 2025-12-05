"""Firebase Cloud Messaging 서비스"""
import os
import firebase_admin
from firebase_admin import credentials, messaging
from models import db, User, ClubMember

# Firebase Admin SDK 초기화 (한 번만 실행)
_fcm_initialized = False

def init_fcm():
    """Firebase Admin SDK 초기화"""
    global _fcm_initialized
    if _fcm_initialized:
        return
    
    try:
        # 환경변수에서 Firebase 서비스 계정 키 경로 가져오기
        firebase_cred_path = os.environ.get('FIREBASE_CREDENTIALS_PATH')
        
        if firebase_cred_path and os.path.exists(firebase_cred_path):
            # 파일 경로로 초기화
            cred = credentials.Certificate(firebase_cred_path)
            firebase_admin.initialize_app(cred)
        else:
            # 환경변수에서 직접 JSON 가져오기
            firebase_cred_json = os.environ.get('FIREBASE_CREDENTIALS_JSON')
            if firebase_cred_json:
                import json
                cred_dict = json.loads(firebase_cred_json)
                cred = credentials.Certificate(cred_dict)
                firebase_admin.initialize_app(cred)
            else:
                # 기본 앱 초기화 (로컬 개발 환경)
                try:
                    firebase_admin.initialize_app()
                except ValueError:
                    # 이미 초기화된 경우
                    pass
        
        _fcm_initialized = True
    except Exception as e:
        _fcm_initialized = False

def send_notification_to_admins(title, body, data=None):
    """모든 관리자에게 푸시 알림 전송"""
    try:
        init_fcm()
        
        if not _fcm_initialized:
            return 0
        
        # 관리자 계정 조회 (admin 또는 super_admin)
        admins = User.query.filter(
            User.role.in_(['admin', 'super_admin']),
            User.fcm_token.isnot(None),
            User.is_active == True
        ).all()
        
        if not admins:
            return 0
        
        # 각 관리자에게 알림 전송
        success_count = 0
        for admin in admins:
            try:
                message = messaging.Message(
                    notification=messaging.Notification(
                        title=title,
                        body=body
                    ),
                    data=data or {},
                    token=admin.fcm_token
                )
                
                messaging.send(message)
                success_count += 1
            except messaging.UnregisteredError:
                # 토큰이 만료된 경우 DB에서 제거
                admin.fcm_token = None
                db.session.commit()
            except Exception as e:
                pass
        
        return success_count
    except Exception as e:
        return 0

def send_notification_to_club_admins(club_id, title, body, data=None):
    """특정 클럽의 운영진과 슈퍼관리자에게 푸시 알림 전송"""
    try:
        init_fcm()
        
        if not _fcm_initialized:
            print("Firebase가 초기화되지 않아 푸시 알림을 전송할 수 없습니다.")
            return 0
        
        # 슈퍼관리자 조회
        super_admins = User.query.filter(
            User.role == 'super_admin',
            User.fcm_token.isnot(None),
            User.is_active == True
        ).all()
        
        # 해당 클럽의 운영진 조회 (admin 또는 owner 역할)
        club_admins = []
        if club_id:
            club_admin_memberships = ClubMember.query.filter_by(
                club_id=club_id,
                status='approved'
            ).filter(
                ClubMember.role.in_(['admin', 'owner'])
            ).all()
            
            for membership in club_admin_memberships:
                user = User.query.get(membership.user_id)
                if user and user.fcm_token and user.is_active:
                    club_admins.append(user)
        
        # 중복 제거 (슈퍼관리자가 클럽 운영진일 수도 있음)
        all_recipients = {}
        for admin in super_admins:
            all_recipients[admin.id] = admin
        for admin in club_admins:
            all_recipients[admin.id] = admin
        
        if not all_recipients:
            return 0
        
        # 각 관리자에게 알림 전송
        success_count = 0
        for admin in all_recipients.values():
            try:
                message = messaging.Message(
                    notification=messaging.Notification(
                        title=title,
                        body=body
                    ),
                    data=data or {},
                    token=admin.fcm_token
                )
                
                response = messaging.send(message)
                success_count += 1
            except messaging.UnregisteredError:
                # 토큰이 만료된 경우 DB에서 제거
                admin.fcm_token = None
                db.session.commit()
            except Exception as e:
                pass
        return success_count
    except Exception as e:
        print(f"푸시 알림 전송 중 오류 발생: {str(e)}")
        return 0

def send_notification_to_user(user_id, title, body, data=None):
    """특정 사용자에게 푸시 알림 전송"""
    try:
        init_fcm()
        
        if not _fcm_initialized:
            print("❌ Firebase가 초기화되지 않아 푸시 알림을 전송할 수 없습니다.")
            print("   백엔드 .env 파일에 FIREBASE_CREDENTIALS_PATH 또는 FIREBASE_CREDENTIALS_JSON을 설정해주세요.")
            return False
        
        # 사용자 조회
        user = User.query.get(user_id)
        if not user:
            print(f"❌ 사용자를 찾을 수 없습니다. (사용자 ID: {user_id})")
            return False
        if not user.fcm_token:
            print(f"⚠️ 사용자에게 FCM 토큰이 등록되지 않았습니다. (사용자 ID: {user_id}, 이메일: {user.email})")
            return False
        if not user.is_active:
            print(f"⚠️ 비활성화된 사용자입니다. (사용자 ID: {user_id}, 이메일: {user.email})")
            return False
        
        try:
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body
                ),
                data=data or {},
                token=user.fcm_token
            )
            
            messaging.send(message)
            return True
        except messaging.UnregisteredError:
            # 토큰이 만료된 경우 DB에서 제거
            user.fcm_token = None
            db.session.commit()
            return False
        except Exception as e:
            return False
    except Exception as e:
        return False

