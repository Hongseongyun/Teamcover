from flask import Blueprint, request, jsonify
from models import db, Member, Score, Point
from google_sheets import GoogleSheetsManager
from datetime import datetime

# 구글 시트 연동 Blueprint
sheets_bp = Blueprint('sheets', __name__, url_prefix='/api')

# 구글 시트 매니저 초기화
sheets_manager = GoogleSheetsManager()

@sheets_bp.route('/sheets/debug-auth', methods=['GET'])
def debug_auth():
    """구글 시트 인증 상태 디버그 엔드포인트"""
    try:
        import os
        from google.oauth2.service_account import Credentials
        
        # 환경변수 상태 확인
        env_status = {
            'GOOGLE_TYPE': os.environ.get('GOOGLE_TYPE', 'NOT_SET'),
            'GOOGLE_PROJECT_ID': os.environ.get('GOOGLE_PROJECT_ID', 'NOT_SET'),
            'GOOGLE_PRIVATE_KEY_ID': os.environ.get('GOOGLE_PRIVATE_KEY_ID', 'NOT_SET'),
            'GOOGLE_PRIVATE_KEY': 'SET' if os.environ.get('GOOGLE_PRIVATE_KEY') else 'NOT_SET',
            'GOOGLE_CLIENT_EMAIL': os.environ.get('GOOGLE_CLIENT_EMAIL', 'NOT_SET'),
            'GOOGLE_CLIENT_ID': os.environ.get('GOOGLE_CLIENT_ID', 'NOT_SET'),
            'GOOGLE_AUTH_URI': os.environ.get('GOOGLE_AUTH_URI', 'NOT_SET'),
            'GOOGLE_TOKEN_URI': os.environ.get('GOOGLE_TOKEN_URI', 'NOT_SET'),
            'GOOGLE_AUTH_PROVIDER_X509_CERT_URL': os.environ.get('GOOGLE_AUTH_PROVIDER_X509_CERT_URL', 'NOT_SET'),
            'GOOGLE_CLIENT_X509_CERT_URL': os.environ.get('GOOGLE_CLIENT_X509_CERT_URL', 'NOT_SET'),
        }
        
        # 필수 필드 확인
        required_fields = ['GOOGLE_TYPE', 'GOOGLE_PROJECT_ID', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_CLIENT_EMAIL']
        missing_fields = [field for field in required_fields if env_status.get(field) == 'NOT_SET']
        
        # 인증 시도
        auth_result = sheets_manager.authenticate()
        
        return jsonify({
            'success': True,
            'environment_variables': env_status,
            'missing_required_fields': missing_fields,
            'authentication_result': auth_result,
            'client_initialized': sheets_manager.client is not None,
            'credentials_initialized': sheets_manager.credentials is not None
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'environment_variables': env_status if 'env_status' in locals() else {},
            'authentication_result': False
        })

@sheets_bp.route('/scores/import-from-sheets', methods=['POST'])
def import_scores_from_sheets():
    """구글 시트에서 스코어 데이터 가져오기 API"""
    try:
        data = request.get_json()
        spreadsheet_url = data.get('spreadsheet_url', '').strip()
        worksheet_name = data.get('worksheet_name', '').strip() or None
        clear_existing = data.get('clear_existing', False)  # 기존 스코어 삭제 옵션
        
        if not spreadsheet_url:
            return jsonify({'success': False, 'message': '구글 시트 URL을 입력해주세요.'})
        
        # 기존 스코어 삭제 (옵션)
        if clear_existing:
            deleted_count = Score.query.delete()
            db.session.commit()
            print(f"기존 스코어 {deleted_count}개 삭제됨")
        
        # 구글 시트 인증
        auth_result = sheets_manager.authenticate()
        if not auth_result:
            return jsonify({
                'success': False, 
                'message': '구글 시트 인증에 실패했습니다. 환경변수 설정을 확인해주세요.',
                'error_type': 'authentication_failed'
            })
        
        # 시트 데이터 가져오기
        sheet_data = sheets_manager.get_sheet_data(spreadsheet_url, worksheet_name)
        if not sheet_data:
            return jsonify({
                'success': False, 
                'message': '구글 시트에서 데이터를 가져올 수 없습니다. URL과 권한을 확인해주세요.',
                'error_type': 'data_fetch_failed'
            })
        
        # 데이터 파싱
        parsed_scores = sheets_manager.parse_score_data(sheet_data)
        if not parsed_scores:
            return jsonify({
                'success': False, 
                'message': '파싱할 수 있는 스코어 데이터가 없습니다. 시트 형식을 확인해주세요.',
                'error_type': 'parsing_failed'
            })
        
        # 데이터베이스에 저장
        imported_count = 0
        skipped_count = 0
        errors = []
        unregistered_members = []
        
        # 등록된 회원 목록 미리 조회
        registered_members = {member.name: member for member in Member.query.all()}
        print(f"등록된 회원 수: {len(registered_members)}")
        print(f"등록된 회원 목록: {list(registered_members.keys())}")
        
        for score_data in parsed_scores:
            try:
                member_name = score_data['member_name']
                if not member_name:
                    skipped_count += 1
                    continue
                
                # 등록된 회원인지 확인
                if member_name not in registered_members:
                    if member_name not in unregistered_members:
                        unregistered_members.append(member_name)
                        print(f"등록되지 않은 회원 무시: {member_name}")
                    skipped_count += 1
                    continue
                
                member = registered_members[member_name]
                
                # 새 스코어 생성
                new_score = Score(
                    member_id=member.id,
                    game_date=score_data['game_date'],
                    score1=score_data['score1'],
                    score2=score_data['score2'],
                    score3=score_data['score3'],
                    total_score=score_data['total_score'],
                    average_score=score_data['average_score'],
                    note=score_data['note']
                )
                
                db.session.add(new_score)
                imported_count += 1
                print(f"스코어 추가됨: {member_name} - 총점: {score_data['total_score']}")
                
            except Exception as e:
                print(f"스코어 저장 오류: {e}")
                errors.append(f'스코어 저장 오류: {str(e)}')
                skipped_count += 1
                continue
        
        db.session.commit()
        
        message = f'스코어 가져오기 완료: {imported_count}개 저장, {skipped_count}개 건너뜀'
        if clear_existing:
            message += f', 기존 스코어 삭제됨'
        if unregistered_members:
            message += f', 등록되지 않은 회원: {", ".join(unregistered_members)}'
        if errors:
            message += f', {len(errors)}개 오류'
        
        return jsonify({
            'success': True,
            'message': message,
            'imported_count': imported_count,
            'skipped_count': skipped_count,
            'error_count': len(errors),
            'unregistered_members': unregistered_members,
            'errors': errors[:10]  # 최대 10개 오류만 반환
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'구글 시트 가져오기 중 오류가 발생했습니다: {str(e)}'})

@sheets_bp.route('/members/import-from-sheets', methods=['POST'])
def import_members_from_sheets():
    """구글 시트에서 회원 데이터 가져오기 API"""
    try:
        data = request.get_json()
        spreadsheet_url = data.get('spreadsheet_url', '').strip()
        worksheet_name = data.get('worksheet_name', '').strip() or None
        
        if not spreadsheet_url:
            return jsonify({'success': False, 'message': '구글 시트 URL을 입력해주세요.'})
        
        # 구글 시트 인증
        auth_result = sheets_manager.authenticate()
        if not auth_result:
            return jsonify({
                'success': False, 
                'message': '구글 시트 인증에 실패했습니다. 환경변수 설정을 확인해주세요.',
                'error_type': 'authentication_failed'
            })
        
        # 시트 데이터 가져오기
        sheet_data = sheets_manager.get_sheet_data(spreadsheet_url, worksheet_name)
        if not sheet_data:
            return jsonify({
                'success': False, 
                'message': '구글 시트에서 데이터를 가져올 수 없습니다. URL과 권한을 확인해주세요.',
                'error_type': 'data_fetch_failed'
            })
        
        # 데이터 파싱
        parsed_members = sheets_manager.parse_member_data(sheet_data)
        if not parsed_members:
            return jsonify({
                'success': False, 
                'message': '파싱할 수 있는 회원 데이터가 없습니다. 시트 형식을 확인해주세요.',
                'error_type': 'parsing_failed'
            })
        
        # 데이터베이스에 저장
        imported_count = 0
        skipped_count = 0
        errors = []
        
        for member_data in parsed_members:
            try:
                name = member_data['name']
                if not name:
                    skipped_count += 1
                    continue
                
                # 중복 회원 체크
                existing_member = Member.query.filter_by(name=name).first()
                if existing_member:
                    # 기존 회원 정보 업데이트
                    existing_member.phone = member_data['phone']
                    existing_member.gender = member_data['gender']
                    existing_member.level = member_data['level']
                    existing_member.email = member_data['email']
                    existing_member.note = member_data['note']
                    existing_member.updated_at = datetime.utcnow()
                    
                    imported_count += 1
                    continue
                
                # 새 회원 생성
                new_member = Member(
                    name=name,
                    phone=member_data['phone'],
                    gender=member_data['gender'],
                    level=member_data['level'],
                    email=member_data['email'],
                    note=member_data['note']
                )
                
                db.session.add(new_member)
                imported_count += 1
                
            except Exception as e:
                errors.append(f'회원 저장 오류: {str(e)}')
                skipped_count += 1
                continue
        
        db.session.commit()
        
        message = f'회원 가져오기 완료: {imported_count}개 저장, {skipped_count}개 건너뜀'
        if errors:
            message += f', {len(errors)}개 오류'
        
        return jsonify({
            'success': True,
            'message': message,
            'imported_count': imported_count,
            'skipped_count': skipped_count,
            'error_count': len(errors),
            'errors': errors[:10]  # 최대 10개 오류만 반환
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'구글 시트 가져오기 중 오류가 발생했습니다: {str(e)}'})

@sheets_bp.route('/points/import-from-sheets', methods=['POST'])
def import_points_from_sheets():
    """구글 시트에서 포인트 데이터 가져오기 API"""
    try:
        data = request.get_json()
        spreadsheet_url = data.get('spreadsheet_url', '').strip()
        worksheet_name = data.get('worksheet_name', '').strip() or None
        clear_existing = data.get('clear_existing', False)  # 기존 포인트 삭제 옵션
        
        if not spreadsheet_url:
            return jsonify({'success': False, 'message': '구글 시트 URL을 입력해주세요.'})
        
        # 기존 포인트 삭제 (옵션)
        if clear_existing:
            deleted_count = Point.query.delete()
            db.session.commit()
            print(f"기존 포인트 {deleted_count}개 삭제됨")
        
        # 구글 시트 인증
        auth_result = sheets_manager.authenticate()
        if not auth_result:
            return jsonify({
                'success': False, 
                'message': '구글 시트 인증에 실패했습니다. 환경변수 설정을 확인해주세요.',
                'error_type': 'authentication_failed'
            })
        
        # 시트 데이터 가져오기
        sheet_data = sheets_manager.get_sheet_data(spreadsheet_url, worksheet_name)
        if not sheet_data:
            return jsonify({
                'success': False, 
                'message': '구글 시트에서 데이터를 가져올 수 없습니다. URL과 권한을 확인해주세요.',
                'error_type': 'data_fetch_failed'
            })
        
        # 데이터 파싱
        parsed_points = sheets_manager.parse_point_data(sheet_data)
        print(f"파싱된 포인트 수: {len(parsed_points)}")
        if not parsed_points:
            return jsonify({
                'success': False, 
                'message': '파싱할 수 있는 포인트 데이터가 없습니다. 시트 형식을 확인해주세요.',
                'error_type': 'parsing_failed'
            })
        
        print(f"파싱된 포인트 목록:")
        for i, point in enumerate(parsed_points):
            print(f"  {i+1}. {point.get('member_name', 'N/A')} - {point.get('point_type', 'N/A')} {point.get('amount', 0)}P - {point.get('point_date', 'N/A')}")
        
        # 데이터베이스에 저장
        imported_count = 0
        skipped_count = 0
        errors = []
        unregistered_members = []
        
        # 등록된 회원 목록 미리 조회
        registered_members = {member.name: member for member in Member.query.all()}
        print(f"등록된 회원 수: {len(registered_members)}")
        print(f"등록된 회원 목록: {list(registered_members.keys())}")
        
        for point_data in parsed_points:
            try:
                member_name = point_data['member_name']
                if not member_name:
                    skipped_count += 1
                    continue
                
                # 등록된 회원인지 확인
                if member_name not in registered_members:
                    if member_name not in unregistered_members:
                        unregistered_members.append(member_name)
                        print(f"등록되지 않은 회원 무시: {member_name}")
                    skipped_count += 1
                    continue
                
                member = registered_members[member_name]
                
                # 새 포인트 생성
                new_point = Point(
                    member_id=member.id,
                    point_date=point_data['point_date'],
                    point_type=point_data['point_type'],
                    amount=point_data['amount'],
                    reason=point_data['reason'],
                    note=point_data['note']
                )
                
                db.session.add(new_point)
                imported_count += 1
                print(f"포인트 추가됨: {member_name} - {point_data['point_type']} {point_data['amount']}P")
                
            except Exception as e:
                print(f"포인트 저장 오류: {e}")
                errors.append(f'포인트 저장 오류: {str(e)}')
                skipped_count += 1
                continue
        
        db.session.commit()
        
        message = f'포인트 가져오기 완료: {imported_count}개 저장, {skipped_count}개 건너뜀'
        if clear_existing:
            message += f', 기존 포인트 삭제됨'
        if unregistered_members:
            message += f', 등록되지 않은 회원: {", ".join(unregistered_members)}'
        if errors:
            message += f', {len(errors)}개 오류'
        
        return jsonify({
            'success': True,
            'message': message,
            'imported_count': imported_count,
            'skipped_count': skipped_count,
            'error_count': len(errors),
            'unregistered_members': unregistered_members,
            'errors': errors[:10]  # 최대 10개 오류만 반환
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'구글 시트 가져오기 중 오류가 발생했습니다: {str(e)}'})
