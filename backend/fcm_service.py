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
        print("✅ Firebase Admin SDK 초기화 완료")
    except Exception as e:
        print(f"❌ Firebase Admin SDK 초기화 실패: {str(e)}")
        print("   백엔드 .env 파일에 다음 중 하나를 설정해주세요:")
        print("   1. FIREBASE_CREDENTIALS_PATH=/path/to/firebase-service-account-key.json")
        print("   2. FIREBASE_CREDENTIALS_JSON={\"type\":\"service_account\",...}")
        print("   Firebase Console > 프로젝트 설정 > 서비스 계정 탭에서 키를 생성하세요.")
        _fcm_initialized = False

def send_notification_to_admins(title, body, data=None):
    """모든 관리자에게 푸시 알림 전송"""
    try:
        init_fcm()
        
        if not _fcm_initialized:
            print("Firebase가 초기화되지 않아 푸시 알림을 전송할 수 없습니다.")
            return 0
        
        # 관리자 계정 조회 (admin 또는 super_admin)
        admins = User.query.filter(
            User.role.in_(['admin', 'super_admin']),
            User.fcm_token.isnot(None),
            User.is_active == True
        ).all()
        
        if not admins:
            print("푸시 알림을 받을 관리자가 없습니다.")
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
                
                response = messaging.send(message)
                print(f"푸시 알림 전송 성공 (관리자: {admin.email}, 메시지 ID: {response})")
                success_count += 1
            except messaging.UnregisteredError:
                # 토큰이 만료된 경우 DB에서 제거
                print(f"만료된 FCM 토큰 제거 (관리자: {admin.email})")
                admin.fcm_token = None
                db.session.commit()
            except Exception as e:
                print(f"푸시 알림 전송 실패 (관리자: {admin.email}): {str(e)}")
        
        print(f"총 {success_count}/{len(admins)}명의 관리자에게 푸시 알림 전송 완료")
        return success_count
    except Exception as e:
        print(f"푸시 알림 전송 중 오류 발생: {str(e)}")
        return 0

def send_notification_to_club_admins(club_id, title, body, data=None):
    """특정 클럽의 운영진과 슈퍼관리자에게 푸시 알림 전송"""
    try:
        init_fcm()
        
        if not _fcm_initialized:
            print("Firebase가 초기화되지 않아 푸시 알림을 전송할 수 없습니다.")
            return 0
        
        # 슈퍼관리자 조회
        print(f"🔍 슈퍼관리자 조회 시작")
        super_admins = User.query.filter(
            User.role == 'super_admin',
            User.fcm_token.isnot(None),
            User.is_active == True
        ).all()
        print(f"   - 조회된 슈퍼관리자 수: {len(super_admins)}")
        for admin in super_admins:
            print(f"     ✅ 슈퍼관리자: {admin.email} (ID: {admin.id})")
        
        # 해당 클럽의 운영진 조회 (admin 또는 owner 역할)
        club_admins = []
        if club_id:
            print(f"🔍 클럽 운영진 조회 시작 (클럽 ID: {club_id})")
            club_admin_memberships = ClubMember.query.filter_by(
                club_id=club_id,
                status='approved'
            ).filter(
                ClubMember.role.in_(['admin', 'owner'])
            ).all()
            
            print(f"   - 조회된 운영진 멤버십 수: {len(club_admin_memberships)}")
            for membership in club_admin_memberships:
                print(f"   - 멤버십 ID {membership.id}: user_id={membership.user_id}, role={membership.role}")
                user = User.query.get(membership.user_id)
                if user:
                    print(f"     사용자: {user.email}, FCM 토큰: {'있음' if user.fcm_token else '없음'}, 활성: {user.is_active}")
                    if user.fcm_token and user.is_active:
                        club_admins.append(user)
                        print(f"     ✅ 운영진 목록에 추가됨: {user.email}")
                    else:
                        print(f"     ⚠️ 운영진 목록에 추가되지 않음 (FCM 토큰 없음 또는 비활성)")
                else:
                    print(f"     ❌ 사용자를 찾을 수 없음 (user_id: {membership.user_id})")
        else:
            print(f"⚠️ 클럽 ID가 없어 클럽 운영진을 조회할 수 없습니다.")
        
        # 중복 제거 (슈퍼관리자가 클럽 운영진일 수도 있음)
        all_recipients = {}
        for admin in super_admins:
            all_recipients[admin.id] = admin
        for admin in club_admins:
            all_recipients[admin.id] = admin
        
        if not all_recipients:
            print(f"⚠️ 푸시 알림을 받을 관리자가 없습니다. (클럽 ID: {club_id})")
            print(f"   - 슈퍼관리자 수: {len(super_admins)}")
            print(f"   - 클럽 운영진 수: {len(club_admins)}")
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
                print(f"✅ 문의 푸시 알림 전송 성공 (관리자: {admin.email}, 메시지 ID: {response})")
                print(f"   제목: {title}")
                print(f"   내용: {body}")
                success_count += 1
            except messaging.UnregisteredError:
                # 토큰이 만료된 경우 DB에서 제거
                print(f"⚠️ 만료된 FCM 토큰 제거 (관리자: {admin.email})")
                admin.fcm_token = None
                db.session.commit()
            except Exception as e:
                print(f"❌ 문의 푸시 알림 전송 실패 (관리자: {admin.email}): {str(e)}")
                import traceback
                print(f"   상세 오류: {traceback.format_exc()}")
        
        print(f"📊 총 {success_count}/{len(all_recipients)}명의 관리자에게 문의 푸시 알림 전송 완료 (클럽 ID: {club_id})")
        if success_count == 0:
            print(f"   ⚠️ 푸시 알림이 전송되지 않았습니다. 관리자들의 FCM 토큰을 확인해주세요.")
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
            
            response = messaging.send(message)
            print(f"✅ 푸시 알림 전송 성공 (사용자: {user.email}, 메시지 ID: {response})")
            print(f"   제목: {title}")
            print(f"   내용: {body}")
            return True
        except messaging.UnregisteredError:
            # 토큰이 만료된 경우 DB에서 제거
            print(f"만료된 FCM 토큰 제거 (사용자: {user.email})")
            user.fcm_token = None
            db.session.commit()
            return False
        except Exception as e:
            print(f"❌ 푸시 알림 전송 실패 (사용자: {user.email}): {str(e)}")
            import traceback
            print(f"   상세 오류: {traceback.format_exc()}")
            return False
    except Exception as e:
        print(f"❌ 푸시 알림 전송 중 오류 발생: {str(e)}")
        import traceback
        print(f"   상세 오류: {traceback.format_exc()}")
        return False

