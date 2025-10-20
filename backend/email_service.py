"""
이메일 인증 서비스
Gmail SMTP를 사용한 무료 이메일 인증
"""

import os
import secrets
from datetime import datetime, timedelta
from flask import current_app
from flask_mail import Mail, Message
from itsdangerous import URLSafeTimedSerializer
from models import db, User

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

def generate_verification_token(email, name, password, role='user'):
    """이메일 인증 토큰 생성 (사용자 정보 포함)"""
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    user_data = {
        'email': email,
        'name': name,
        'password': password,
        'role': role
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

def send_verification_email_with_debug(email, name, password, role='user'):
    """인증 이메일 발송 (디버그 정보 포함)"""
    debug_info = {
        'email': email,
        'name': name,
        'role': role,
        'steps': [],
        'config': {},
        'error': None
    }
    
    try:
        print(f"=== send_verification_email 시작 ===")
        print(f"이메일: {email}")
        print(f"이름: {name}")
        print(f"역할: {role}")
        
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
        
        # SendGrid API 방식 시도
        debug_info['steps'].append("SendGrid API 방식 시도")
        return send_via_sendgrid_api(email, name, password, role, debug_info)
        
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

def send_via_sendgrid_api(email, name, password, role, debug_info):
    """SendGrid API를 사용한 이메일 발송"""
    try:
        import requests
        
        debug_info['steps'].append("SendGrid API 요청 준비")
        
        # 인증 토큰 생성
        token = generate_verification_token(email, name, password, role)
        verification_url = f"{current_app.config.get('FRONTEND_BASE_URL', 'http://localhost:3000')}/verify-email?token={token}"
        debug_info['verification_url'] = verification_url
        
        # SendGrid API 요청
        api_key = current_app.config.get('MAIL_PASSWORD')
        url = "https://api.sendgrid.com/v3/mail/send"
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        data = {
            "personalizations": [
                {
                    "to": [{"email": email}],
                    "subject": "Teamcover 이메일 인증"
                }
            ],
            "from": {
                "email": "syun4224@gmail.com",
                "name": "Teamcover"
            },
            "content": [
                {
                    "type": "text/html",
                    "value": f"""
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
                        </div>
                    </body>
                    </html>
                    """
                }
            ]
        }
        
        debug_info['steps'].append("SendGrid API 요청 전송")
        response = requests.post(url, headers=headers, json=data)
        
        if response.status_code == 202:
            debug_info['steps'].append("SendGrid API 요청 성공")
            print(f"✅ SendGrid API 이메일 발송 성공!")
            return {
                'success': True,
                'debug_info': debug_info
            }
        else:
            debug_info['steps'].append(f"SendGrid API 오류: {response.status_code}")
            print(f"❌ SendGrid API 오류: {response.status_code} - {response.text}")
            return {
                'success': False,
                'debug_info': debug_info
            }
            
    except Exception as e:
        debug_info['steps'].append(f"SendGrid API 오류: {str(e)}")
        print(f"❌ SendGrid API 오류: {e}")
        return {
            'success': False,
            'debug_info': debug_info
        }
        html_body = f"""
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
        
        # 이메일 발송
        debug_info['steps'].append("이메일 메시지 생성 중")
        print(f"이메일 메시지 생성 중...")
        msg = Message(
            subject=subject,
            recipients=[email],
            html=html_body
        )
        print(f"이메일 메시지 생성 완료")
        debug_info['steps'].append("이메일 메시지 생성 완료")
        
        debug_info['steps'].append("SMTP 서버 연결 시도 중")
        print(f"SMTP 서버 연결 시도 중...")
        print(f"MAIL_SERVER: {current_app.config.get('MAIL_SERVER')}")
        print(f"MAIL_PORT: {current_app.config.get('MAIL_PORT')}")
        print(f"MAIL_USERNAME: {current_app.config.get('MAIL_USERNAME')}")
        print(f"MAIL_PASSWORD: {'SET' if current_app.config.get('MAIL_PASSWORD') else 'NOT_SET'}")
        
        mail.send(msg)
        print(f"✅ 이메일 발송 성공!")
        debug_info['steps'].append("이메일 발송 성공")
        
        return {
            'success': True,
            'debug_info': debug_info
        }
        
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

def send_verification_email(email, name, password, role='user'):
    """인증 이메일 발송 (기존 함수 - 호환성 유지)"""
    try:
        print(f"=== send_verification_email 시작 ===")
        print(f"이메일: {email}")
        print(f"이름: {name}")
        print(f"역할: {role}")
        
        # 인증 토큰 생성 (사용자 정보 포함)
        token = generate_verification_token(email, name, password, role)
        verification_url = f"{current_app.config.get('FRONTEND_BASE_URL', 'http://localhost:3000')}/verify-email?token={token}"
        print(f"인증 URL: {verification_url}")
        
        # 이메일 내용
        subject = "Teamcover 이메일 인증"
        html_body = f"""
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
        
        # 이메일 발송
        print(f"이메일 메시지 생성 중...")
        msg = Message(
            subject=subject,
            recipients=[email],
            html=html_body
        )
        print(f"이메일 메시지 생성 완료")
        
        print(f"SMTP 서버 연결 시도 중...")
        print(f"MAIL_SERVER: {current_app.config.get('MAIL_SERVER')}")
        print(f"MAIL_PORT: {current_app.config.get('MAIL_PORT')}")
        print(f"MAIL_USERNAME: {current_app.config.get('MAIL_USERNAME')}")
        print(f"MAIL_PASSWORD: {'SET' if current_app.config.get('MAIL_PASSWORD') else 'NOT_SET'}")
        
        mail.send(msg)
        print(f"✅ 이메일 발송 성공!")
        return True
        
    except Exception as e:
        print(f"❌ 이메일 발송 실패: {e}")
        print(f"오류 타입: {type(e)}")
        import traceback
        print(f"상세 오류: {traceback.format_exc()}")
        return False

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
        
        # 이미 존재하는 사용자인지 확인
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            if not existing_user.is_active:
                existing_user.is_active = True
                existing_user.is_verified = True
                existing_user.verified_at = datetime.utcnow()
                if not existing_user.verification_method:
                    existing_user.verification_method = 'email'
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
        db.session.commit()
        
        return {'success': True, 'message': '이메일 인증이 완료되었습니다. 이제 로그인할 수 있습니다.'}
        
    except Exception as e:
        db.session.rollback()
        return {'success': False, 'message': f'인증 처리 중 오류가 발생했습니다: {str(e)}'}

def send_verification_code_email(email, name, verification_code):
    """인증 코드 이메일 발송 (구글 로그인용)"""
    try:
        print(f"=== 인증 코드 이메일 발송 시작 ===")
        print(f"이메일: {email}")
        print(f"이름: {name}")
        print(f"인증 코드: {verification_code}")
        
        # 이메일 내용
        subject = "Teamcover 인증 코드"
        html_body = f"""
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
        
        # 이메일 발송
        print(f"이메일 메시지 생성 중...")
        
        # SendGrid용 발신자 이메일 설정
        sender_email = current_app.config.get('MAIL_DEFAULT_SENDER') or 'syun4224@gmail.com'
        
        msg = Message(
            subject=subject,
            recipients=[email],
            sender=sender_email,
            html=html_body
        )
        print(f"이메일 메시지 생성 완료 (발신자: {sender_email})")
        
        print(f"SMTP 서버 연결 시도 중...")
        
        # SMTP 방식으로 이메일 발송 (타임아웃 120초)
        import socket
        original_timeout = socket.getdefaulttimeout()
        socket.setdefaulttimeout(120)  # 120초 타임아웃
        
        try:
            mail.send(msg)
            print(f"✅ 인증 코드 이메일 발송 성공!")
            return True
        except Exception as e:
            print(f"❌ SMTP 이메일 발송 실패: {e}")
            return False
        finally:
            socket.setdefaulttimeout(original_timeout)
        
    except Exception as e:
        print(f"❌ 인증 코드 이메일 발송 실패: {e}")
        print(f"오류 타입: {type(e)}")
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
    """비밀번호 재설정 이메일 발송"""
    try:
        print(f"=== 비밀번호 재설정 이메일 발송 시작 ===")
        print(f"이메일: {email}")
        print(f"이름: {name}")
        print(f"재설정 코드: {reset_code}")
        
        # 이메일 내용
        subject = "Teamcover 비밀번호 재설정"
        html_body = f"""
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
        
        # 이메일 발송
        print(f"이메일 메시지 생성 중...")
        
        # SendGrid용 발신자 이메일 설정
        sender_email = current_app.config.get('MAIL_DEFAULT_SENDER') or 'syun4224@gmail.com'
        
        msg = Message(
            subject=subject,
            recipients=[email],
            sender=sender_email,
            html=html_body
        )
        print(f"이메일 메시지 생성 완료 (발신자: {sender_email})")
        
        print(f"SMTP 서버 연결 시도 중...")
        
        # SMTP 방식으로 이메일 발송 (타임아웃 120초)
        import socket
        original_timeout = socket.getdefaulttimeout()
        socket.setdefaulttimeout(120)  # 120초 타임아웃
        
        try:
            mail.send(msg)
            print(f"✅ 비밀번호 재설정 이메일 발송 성공!")
            return True
        except Exception as e:
            print(f"❌ SMTP 이메일 발송 실패: {e}")
            return False
        finally:
            socket.setdefaulttimeout(original_timeout)
        
    except Exception as e:
        print(f"❌ 비밀번호 재설정 이메일 발송 실패: {e}")
        print(f"오류 타입: {type(e)}")
        import traceback
        print(f"상세 오류: {traceback.format_exc()}")
        return False