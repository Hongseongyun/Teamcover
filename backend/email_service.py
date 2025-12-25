"""
이메일 인증 서비스
Brevo API를 사용한 이메일 인증
"""

import os
import secrets
from datetime import datetime, timedelta
from flask import current_app
from flask_mail import Mail, Message
from itsdangerous import URLSafeTimedSerializer
from models import db, User, ClubMember

# Flask-Mail 인스턴스
mail = Mail()

def init_mail(app):
    """Flask-Mail 초기화"""
    mail_username = os.getenv('MAIL_USERNAME')
    mail_password = os.getenv('MAIL_PASSWORD')
    
    # 환경 변수 로딩 확인
    print(f"MAIL_USERNAME: {mail_username}")
    print(f"MAIL_PASSWORD: {'SET' if mail_password else 'NOT_SET'}")
    
    # SMTP 설정 (환경 변수 우선, 기본값은 Gmail)
    app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
    app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', '587'))
    app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'true').lower() == 'true'
    app.config['MAIL_USE_SSL'] = os.getenv('MAIL_USE_SSL', 'false').lower() == 'true'
    app.config['MAIL_USERNAME'] = mail_username
    app.config['MAIL_PASSWORD'] = mail_password
    app.config['MAIL_DEFAULT_SENDER'] = mail_username
    
    # 추가 설정
    app.config['MAIL_DEBUG'] = os.getenv('MAIL_DEBUG', 'true').lower() == 'true'  # 디버그 모드
    
    mail.init_app(app)
    
    # 이메일 설정 검증
    if not mail_username or not mail_password:
        print("⚠️ 경고: MAIL_USERNAME 또는 MAIL_PASSWORD가 설정되지 않았습니다!")
        print("이메일 인증 기능이 작동하지 않습니다.")
    else:
        print("✅ 이메일 설정이 완료되었습니다.")

def generate_verification_token(email, name, password, role='user', club_id=None):
    """이메일 인증 토큰 생성 (사용자 정보 포함)"""
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    user_data = {
        'email': email,
        'name': name,
        'password': password,
        'role': role,
        'club_id': club_id  # 선택한 클럽 ID 포함
    }
    return serializer.dumps(user_data, salt='email-verification')

def verify_token(token, expiration=3600):
    """이메일 인증 토큰 검증 (기본 1시간 유효)"""
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    try:
        user_data = serializer.loads(token, salt='email-verification', max_age=expiration)
        return user_data
    except Exception:
        return None

def send_verification_email_with_debug(email, name, password, role='user', club_id=None):
    """인증 이메일 발송 (디버그 정보 포함)"""
    debug_info = {
        'email': email,
        'name': name,
        'role': role,
        'club_id': club_id,
        'steps': [],
        'config': {},
        'error': None
    }
    
    try:
        print(f"=== send_verification_email 시작 ===")
        print(f"이메일: {email}")
        print(f"이름: {name}")
        print(f"역할: {role}")
        print(f"클럽 ID: {club_id}")
        
        debug_info['steps'].append("이메일 발송 시작")
        
        # 이메일 설정 정보 수집
        debug_info['config'] = {
            'mail_server': current_app.config.get('MAIL_SERVER'),
            'mail_port': current_app.config.get('MAIL_PORT'),
            'mail_username': current_app.config.get('MAIL_USERNAME'),
            'mail_password_set': bool(current_app.config.get('MAIL_PASSWORD')),
            'mail_use_tls': current_app.config.get('MAIL_USE_TLS'),
            'frontend_base_url': current_app.config.get('FRONTEND_BASE_URL')
        }
        
        # Brevo API 방식 사용
        debug_info['steps'].append("Brevo API 방식 시도")
        brevo_result = send_via_brevo_api(email, name, password, role, debug_info, club_id)
        
        # Brevo 결과 반환
        return brevo_result
        
    except Exception as e:
        print(f"❌ 이메일 발송 실패: {e}")
        print(f"오류 타입: {type(e)}")
        import traceback
        print(f"상세 오류: {traceback.format_exc()}")
        
        debug_info['error'] = {
            'message': str(e),
            'type': str(type(e)),
            'traceback': traceback.format_exc()
        }
        debug_info['steps'].append(f"오류 발생: {str(e)}")
        
        return {
            'success': False,
            'debug_info': debug_info
        }

def send_via_brevo_api(email, name, password, role, debug_info, club_id=None):
    """Brevo (Sendinblue) API를 사용한 이메일 발송 (무료: 일 300건, 월 9,000건, 도메인 인증 불필요)"""
    try:
        import requests
        
        debug_info['steps'].append("Brevo API 요청 준비")
        
        # 인증 토큰 생성
        token = generate_verification_token(email, name, password, role, club_id)
        verification_url = f"{current_app.config.get('FRONTEND_BASE_URL', 'http://localhost:3000')}/verify-email?token={token}"
        debug_info['verification_url'] = verification_url
        
        # Brevo API 키 (환경 변수에서 가져오기)
        api_key = os.getenv('BREVO_API_KEY')
        if not api_key:
            debug_info['steps'].append("Brevo API 키가 설정되지 않음")
            return {
                'success': False,
                'debug_info': debug_info
            }
        
        url = "https://api.brevo.com/v3/smtp/email"
        
        headers = {
            "api-key": api_key,
            "Content-Type": "application/json"
        }
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
                <h1 style="color: #333; margin-bottom: 20px;">🎳 Teamcover</h1>
                <h2 style="color: #007bff; margin-bottom: 20px;">이메일 인증이 필요합니다</h2>
                
                <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
                    안녕하세요 <strong>{name}</strong>님!<br>
                    Teamcover 회원가입을 완료하려면 아래 버튼을 클릭하여 이메일을 인증해주세요.
                </p>
                
                <a href="{verification_url}" 
                   style="display: inline-block; background-color: #007bff; color: white; 
                          padding: 15px 30px; text-decoration: none; border-radius: 5px; 
                          font-size: 16px; font-weight: bold; margin-bottom: 20px;">
                    이메일 인증하기
                </a>
                
                <p style="font-size: 14px; color: #999; margin-top: 30px;">
                    이 링크는 1시간 후에 만료됩니다.<br>
                    만약 버튼이 작동하지 않는다면 아래 링크를 복사하여 브라우저에 붙여넣으세요:<br>
                    <a href="{verification_url}" style="color: #007bff; word-break: break-all;">{verification_url}</a>
                </p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="font-size: 12px; color: #999;">
                    이 이메일은 Teamcover 시스템에서 자동으로 발송되었습니다.<br>
                    만약 회원가입을 하지 않으셨다면 이 이메일을 무시하셔도 됩니다.
                </p>
            </div>
        </body>
        </html>
        """
        
        # Brevo는 sender 정보가 필요함 (무료 티어는 등록된 이메일 사용)
        sender_email = os.getenv('BREVO_SENDER_EMAIL', 'noreply@teamcover.com')
        sender_name = os.getenv('BREVO_SENDER_NAME', 'Teamcover')
        
        print(f"📧 Brevo 발신자: {sender_name} <{sender_email}>")
        print(f"📧 Brevo 수신자: {name} <{email}>")
        
        data = {
            "sender": {
                "name": sender_name,
                "email": sender_email
            },
            "to": [
                {
                    "email": email,
                    "name": name
                }
            ],
            "subject": "Teamcover 이메일 인증",
            "htmlContent": html_content
        }
        
        debug_info['steps'].append(f"Brevo API 요청 전송 (발신자: {sender_email}, 수신자: {email})")
        response = requests.post(url, headers=headers, json=data)
        
        # 응답 상세 로깅
        print(f"📨 Brevo API 응답 상태 코드: {response.status_code}")
        print(f"📨 Brevo API 응답 내용: {response.text}")
        
        if response.status_code == 201:
            response_data = response.json() if response.text else {}
            message_id = response_data.get('messageId', 'N/A')
            debug_info['steps'].append(f"Brevo API 요청 성공 (Message ID: {message_id})")
            print(f"✅ Brevo API 이메일 발송 성공! (Message ID: {message_id})")
            print(f"💡 Brevo 대시보드에서 발송 상태를 확인하세요: https://app.brevo.com/statistics/email")
            
            # 발신자 이메일이 검증되지 않았을 수 있음
            if not sender_email or sender_email == 'noreply@teamcover.com':
                print(f"⚠️ 주의: 발신자 이메일이 Brevo 계정에 등록되지 않았을 수 있습니다.")
                print(f"⚠️ Brevo 대시보드 > Senders & IP > Verified Senders에서 이메일을 등록하세요.")
            
            return {
                'success': True,
                'debug_info': debug_info,
                'message_id': message_id
            }
        else:
            debug_info['steps'].append(f"Brevo API 오류: {response.status_code}")
            error_text = response.text
            print(f"❌ Brevo API 오류: {response.status_code} - {error_text}")
            
            # 일반적인 오류 메시지 파싱
            try:
                error_data = response.json()
                error_message = error_data.get('message', error_text)
                print(f"❌ 오류 메시지: {error_message}")
            except:
                pass
            
            return {
                'success': False,
                'debug_info': debug_info
            }
            
    except Exception as e:
        debug_info['steps'].append(f"Brevo API 오류: {str(e)}")
        print(f"❌ Brevo API 오류: {e}")
        return {
            'success': False,
            'debug_info': debug_info
        }

def send_verification_email(email, name, password, role='user'):
    """인증 이메일 발송 (기존 함수 - 호환성 유지, Brevo 사용)"""
    debug_info = {
        'email': email,
        'name': name,
        'role': role,
        'club_id': None,
        'steps': [],
        'config': {},
        'error': None
    }
    result = send_verification_email_with_debug(email, name, password, role, None, debug_info)
    return result.get('success', False)

def verify_email_token(token):
    """이메일 인증 토큰 검증 및 사용자 생성"""
    try:
        user_data = verify_token(token)
        if not user_data:
            return {'success': False, 'message': '유효하지 않거나 만료된 인증 링크입니다.'}
        
        email = user_data.get('email')
        name = user_data.get('name')
        password = user_data.get('password')
        role = user_data.get('role', 'user')
        club_id = user_data.get('club_id')  # 선택한 클럽 ID
        
        # 이미 존재하는 사용자인지 확인
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            if not existing_user.is_active:
                existing_user.is_active = True
                existing_user.is_verified = True
                existing_user.verified_at = datetime.utcnow()
                if not existing_user.verification_method:
                    existing_user.verification_method = 'email'
                
                # 클럽 가입 처리 (이미 가입되어 있지 않은 경우)
                if club_id:
                    existing_membership = ClubMember.query.filter_by(
                        user_id=existing_user.id,
                        club_id=club_id
                    ).first()
                    if not existing_membership:
                        membership = ClubMember(
                            user_id=existing_user.id,
                            club_id=club_id,
                            role='member'
                        )
                        db.session.add(membership)
                
                db.session.commit()
                return {'success': True, 'message': '이메일 인증이 완료되었습니다. 이제 로그인할 수 있습니다.'}
            else:
                return {'success': True, 'message': '이미 인증된 이메일입니다. 로그인 페이지로 이동합니다.'}
        
        # 새 사용자 생성 (인증 완료 시에만 DB에 저장)
        new_user = User(
            email=email,
            name=name,
            role=role,
            is_active=True,  # 인증 완료로 바로 활성화
            is_verified=True,  # 이메일 인증 완료
            verification_method='email',  # 이메일 인증 방식
            verified_at=datetime.utcnow()  # 인증 완료 시간
        )
        new_user.set_password(password)
        
        db.session.add(new_user)
        db.session.flush()  # ID 생성
        
        # 선택한 클럽에 가입 (club_id가 있는 경우)
        if club_id:
            membership = ClubMember(
                user_id=new_user.id,
                club_id=club_id,
                role='member'
            )
            db.session.add(membership)
        else:
            # 클럽을 선택하지 않은 경우, 기본 클럽(Teamcover)에 가입
            from models import Club
            default_club = Club.query.filter_by(name='Teamcover').first()
            if default_club:
                membership = ClubMember(
                    user_id=new_user.id,
                    club_id=default_club.id,
                    role='member'
                )
                db.session.add(membership)
        
        db.session.commit()
        
        return {'success': True, 'message': '이메일 인증이 완료되었습니다. 이제 로그인할 수 있습니다.'}
        
    except Exception as e:
        db.session.rollback()
        return {'success': False, 'message': f'인증 처리 중 오류가 발생했습니다: {str(e)}'}

def send_verification_code_email(email, name, verification_code):
    """인증 코드 이메일 발송 (구글 로그인용, Brevo 사용)"""
    try:
        import requests
        
        print(f"=== 인증 코드 이메일 발송 시작 (Brevo) ===")
        print(f"이메일: {email}")
        print(f"이름: {name}")
        print(f"인증 코드: {verification_code}")
        
        # Brevo API 키
        api_key = os.getenv('BREVO_API_KEY')
        if not api_key:
            print("❌ Brevo API 키가 설정되지 않음")
            return False
        
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "api-key": api_key,
            "Content-Type": "application/json"
        }
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
                <h1 style="color: #333; margin-bottom: 20px;">🎳 Teamcover</h1>
                <h2 style="color: #007bff; margin-bottom: 20px;">인증 코드가 발급되었습니다</h2>
                
                <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
                    안녕하세요 <strong>{name}</strong>님!<br>
                    구글 로그인 인증을 완료하려면 아래 인증 코드를 입력해주세요.
                </p>
                
                <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 30px 0;">
                    <p style="font-size: 14px; color: #999; margin: 0 0 10px 0;">인증 코드</p>
                    <p style="font-size: 48px; font-weight: bold; color: #007bff; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">
                        {verification_code}
                    </p>
                </div>
                
                <p style="font-size: 14px; color: #999; margin-top: 30px;">
                    이 코드는 <strong>24시간</strong> 동안 유효합니다.<br>
                    인증 페이지에서 위 코드를 입력하여 가입을 완료하세요.
                </p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="font-size: 12px; color: #999;">
                    이 이메일은 Teamcover 시스템에서 자동으로 발송되었습니다.<br>
                    만약 구글 로그인을 시도하지 않으셨다면 이 이메일을 무시하셔도 됩니다.
                </p>
            </div>
        </body>
        </html>
        """
        
        sender_email = os.getenv('BREVO_SENDER_EMAIL', 'noreply@teamcover.com')
        sender_name = os.getenv('BREVO_SENDER_NAME', 'Teamcover')
        
        data = {
            "sender": {
                "name": sender_name,
                "email": sender_email
            },
            "to": [{"email": email, "name": name}],
            "subject": "Teamcover 인증 코드",
            "htmlContent": html_content
        }
        
        response = requests.post(url, headers=headers, json=data)
        
        if response.status_code == 201:
            print(f"✅ 인증 코드 이메일 발송 성공! (Brevo)")
            return True
        else:
            print(f"❌ Brevo 이메일 발송 실패: {response.status_code} - {response.text}")
            return False
        
    except Exception as e:
        print(f"❌ 인증 코드 이메일 발송 실패: {e}")
        import traceback
        print(f"상세 오류: {traceback.format_exc()}")
        return False

def resend_verification_email(email):
    """인증 이메일 재발송"""
    try:
        user = User.query.filter_by(email=email).first()
        if not user:
            return {'success': False, 'message': '등록되지 않은 이메일입니다.'}
        
        if user.is_active:
            return {'success': False, 'message': '이미 인증된 이메일입니다.'}
        
        # 이메일 재발송 (사용자 정보가 없으므로 재발송 불가)
        return {'success': False, 'message': '이메일 재발송은 지원되지 않습니다. 새로 회원가입해주세요.'}
            
    except Exception as e:
        return {'success': False, 'message': f'이메일 재발송 중 오류가 발생했습니다: {str(e)}'}

def send_password_reset_email(email, name, reset_code):
    """비밀번호 재설정 이메일 발송 (Brevo 사용)"""
    try:
        import requests
        
        print(f"=== 비밀번호 재설정 이메일 발송 시작 (Brevo) ===")
        print(f"이메일: {email}")
        print(f"이름: {name}")
        print(f"재설정 코드: {reset_code}")
        
        # Brevo API 키
        api_key = os.getenv('BREVO_API_KEY')
        if not api_key:
            print("❌ Brevo API 키가 설정되지 않음")
            return False
        
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "api-key": api_key,
            "Content-Type": "application/json"
        }
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
                <h1 style="color: #333; margin-bottom: 20px;">🎳 Teamcover</h1>
                <h2 style="color: #dc3545; margin-bottom: 20px;">비밀번호 재설정 요청</h2>
                
                <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
                    안녕하세요 <strong>{name}</strong>님!<br>
                    비밀번호 재설정을 위한 인증 코드를 발송해드립니다.
                </p>
                
                <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 30px 0; border: 2px solid #dc3545;">
                    <p style="font-size: 14px; color: #999; margin: 0 0 10px 0;">비밀번호 재설정 코드</p>
                    <p style="font-size: 48px; font-weight: bold; color: #dc3545; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">
                        {reset_code}
                    </p>
                </div>
                
                <p style="font-size: 14px; color: #999; margin-top: 30px;">
                    이 코드는 <strong>1시간</strong> 동안 유효합니다.<br>
                    비밀번호 재설정 페이지에서 위 코드를 입력하여 새 비밀번호를 설정하세요.
                </p>
                
                <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;">
                    <p style="font-size: 14px; color: #856404; margin: 0;">
                        <strong>⚠️ 보안 알림:</strong><br>
                        만약 비밀번호 재설정을 요청하지 않으셨다면, 이 이메일을 무시하셔도 됩니다.<br>
                        다른 사람이 계정에 접근하지 못하도록 주의해주세요.
                    </p>
                </div>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="font-size: 12px; color: #999;">
                    이 이메일은 Teamcover 시스템에서 자동으로 발송되었습니다.<br>
                    문의사항이 있으시면 관리자에게 연락해주세요.
                </p>
            </div>
        </body>
        </html>
        """
        
        sender_email = os.getenv('BREVO_SENDER_EMAIL', 'noreply@teamcover.com')
        sender_name = os.getenv('BREVO_SENDER_NAME', 'Teamcover')
        
        data = {
            "sender": {
                "name": sender_name,
                "email": sender_email
            },
            "to": [{"email": email, "name": name}],
            "subject": "Teamcover 비밀번호 재설정",
            "htmlContent": html_content
        }
        
        response = requests.post(url, headers=headers, json=data, timeout=10)
        
        if response.status_code == 201:
            print(f"✅ 비밀번호 재설정 이메일 발송 성공! (Brevo)")
            return True
        else:
            print(f"❌ Brevo 이메일 발송 실패: {response.status_code} - {response.text}")
            return False
        
    except Exception as e:
        print(f"❌ 비밀번호 재설정 이메일 발송 실패: {e}")
        import traceback
        print(f"상세 오류: {traceback.format_exc()}")
        return False