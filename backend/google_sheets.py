import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime
import os
import re
from typing import List, Dict, Any

class GoogleSheetsManager:
    def __init__(self):
        self.scope = [
            'https://spreadsheets.google.com/feeds',
            'https://www.googleapis.com/auth/drive'
        ]
        self.credentials = None
        self.client = None
        
    def authenticate(self, credentials_file: str = None):
        """구글 서비스 계정 인증"""
        try:
            # 1. 명시된 자격 파일 경로로 시도
            if credentials_file and os.path.exists(credentials_file):
                self.credentials = Credentials.from_service_account_file(
                    credentials_file, scopes=self.scope
                )
                print(f"JSON 파일로 인증 성공: {credentials_file}")
            else:
                # 2. 다양한 위치의 API_KEY 디렉터리에서 JSON 자동 탐색
                candidate_dirs = []
                # 현재 작업 디렉터리 기준
                candidate_dirs.append(os.path.abspath(os.path.join(os.getcwd(), 'API_KEY')))
                # 현재 파일 기준 (backend/ 하위 실행 시 루트의 API_KEY 찾기)
                script_dir = os.path.dirname(os.path.abspath(__file__))
                candidate_dirs.append(os.path.abspath(os.path.join(script_dir, '..', 'API_KEY')))
                candidate_dirs.append(os.path.abspath(os.path.join(script_dir, '..', '..', 'API_KEY')))

                json_file_path = None
                for directory in candidate_dirs:
                    if os.path.isdir(directory):
                        api_key_files = [f for f in os.listdir(directory) if f.endswith('.json')]
                        if api_key_files:
                            json_file_path = os.path.join(directory, api_key_files[0])
                            break

                if json_file_path and os.path.exists(json_file_path):
                    self.credentials = Credentials.from_service_account_file(
                        json_file_path, scopes=self.scope
                    )
                    print(f"API_KEY 폴더에서 JSON 파일로 인증 성공: {json_file_path}")
                else:
                    # 3. GOOGLE_APPLICATION_CREDENTIALS 경로로 시도
                    gac_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
                    if gac_path and os.path.exists(gac_path):
                        self.credentials = Credentials.from_service_account_file(
                            gac_path, scopes=self.scope
                        )
                        print(f"GOOGLE_APPLICATION_CREDENTIALS 경로로 인증 성공: {gac_path}")
                    else:
                        # 4. 환경 변수(json 필드)로 시도
                        creds_dict = {
                            "type": os.environ.get('GOOGLE_TYPE', 'service_account'),
                            "project_id": os.environ.get('GOOGLE_PROJECT_ID'),
                            "private_key_id": os.environ.get('GOOGLE_PRIVATE_KEY_ID'),
                            "private_key": os.environ.get('GOOGLE_PRIVATE_KEY', '').replace('\\n', '\n'),
                            "client_email": os.environ.get('GOOGLE_CLIENT_EMAIL'),
                            "client_id": os.environ.get('GOOGLE_CLIENT_ID'),
                            "auth_uri": os.environ.get('GOOGLE_AUTH_URI', 'https://accounts.google.com/o/oauth2/auth'),
                            "token_uri": os.environ.get('GOOGLE_TOKEN_URI', 'https://oauth2.googleapis.com/token'),
                            "auth_provider_x509_cert_url": os.environ.get('GOOGLE_AUTH_PROVIDER_X509_CERT_URL', 'https://www.googleapis.com/oauth2/v1/certs'),
                            "client_x509_cert_url": os.environ.get('GOOGLE_CLIENT_X509_CERT_URL')
                        }

                        required_fields = ['type', 'project_id', 'private_key', 'client_email']
                        missing_fields = [field for field in required_fields if not creds_dict.get(field)]

                        if missing_fields:
                            print("API_KEY 폴더와 GOOGLE_APPLICATION_CREDENTIALS 경로에서 자격 파일을 찾지 못했고, 환경 변수 필드도 부족합니다.")
                            print(f"누락된 필드: {missing_fields}")
                            print(f"현재 설정된 환경변수들:")
                            for key, value in creds_dict.items():
                                if value:
                                    print(f"  {key}: {'SET' if value else 'NOT_SET'}")
                                else:
                                    print(f"  {key}: NOT_SET")
                            return False

                        self.credentials = Credentials.from_service_account_info(creds_dict, scopes=self.scope)
                        print("환경 변수(JSON 필드)로 인증 성공")
            
            self.client = gspread.authorize(self.credentials)
            return True
        except Exception as e:
            print(f"구글 인증 오류: {e}")
            return False
    
    def get_sheet_data(self, spreadsheet_url: str, worksheet_name: str = None) -> List[Dict[str, Any]]:
        """구글 시트에서 데이터 가져오기"""
        try:
            if not self.client:
                raise Exception("구글 클라이언트가 초기화되지 않았습니다.")
            
            # 스프레드시트 열기
            spreadsheet = self.client.open_by_url(spreadsheet_url)
            
            # 워크시트 선택
            if worksheet_name:
                worksheet = spreadsheet.worksheet(worksheet_name)
            else:
                worksheet = spreadsheet.sheet1
            
            # 모든 데이터 가져오기 (헤더 포함)
            all_values = worksheet.get_all_values()
            
            print(f"구글 시트 원본 데이터: {len(all_values)}개 행")
            if all_values:
                print(f"헤더 행: {all_values[0]}")
                if len(all_values) > 1:
                    print(f"첫 번째 데이터 행: {all_values[1]}")
                    print(f"첫 번째 데이터 행 타입: {[type(cell) for cell in all_values[1]]}")
            
            if not all_values or len(all_values) < 2:
                print("구글 시트에 데이터가 없습니다.")
                return []
            
            # 헤더 행 처리 (빈 셀을 'Column_N'으로 채우기)
            headers = all_values[0]
            processed_headers = []
            column_count = 0
            
            print(f"\n=== 구글 시트 헤더 정보 ===")
            print(f"원본 헤더: {headers}")
            print(f"헤더 개수: {len(headers)}")
            
            for i, header in enumerate(headers):
                if header.strip():  # 헤더가 비어있지 않으면 그대로 사용
                    processed_headers.append(header.strip())
                    print(f"컬럼 {i+1} (인덱스 {i}): '{header.strip()}'")
                else:  # 빈 헤더는 'Column_N'으로 채우기
                    column_count += 1
                    processed_headers.append(f'Column_{column_count}')
                    print(f"컬럼 {i+1} (인덱스 {i}): 빈 헤더 → 'Column_{column_count}'")
            
            print(f"처리된 헤더: {processed_headers}")
            print(f"B열 헤더: '{processed_headers[1] if len(processed_headers) > 1 else '없음'}'")
            
            # 데이터 행 처리
            data_rows = all_values[1:]
            all_records = []
            
            for row_idx, row in enumerate(data_rows):
                if not any(cell.strip() for cell in row):  # 빈 행 건너뛰기
                    continue
                
                print(f"\n=== 원본 행 {row_idx + 1} ===")
                print(f"원본 데이터: {row}")
                print(f"원본 타입: {[type(cell) for cell in row]}")
                
                # 헤더 개수에 맞춰 데이터 행 확장/축소
                while len(row) < len(processed_headers):
                    row.append('')
                row = row[:len(processed_headers)]
                
                print(f"헤더 개수: {len(processed_headers)}")
                print(f"데이터 행 길이: {len(row)}")
                print(f"헤더: {processed_headers}")
                
                # 딕셔너리로 변환
                record = {}
                for i, header in enumerate(processed_headers):
                    cell_value = row[i] if i < len(row) else ''
                    
                    print(f"  셀 {i} ({header}): '{cell_value}' (타입: {type(cell_value)})")
                    
                    # 숫자 형식 처리
                    if cell_value and cell_value.strip():
                        try:
                            # 날짜 컬럼인지 확인 (헤더가 날짜 관련인 경우)
                            if any(date_keyword in header.lower() for date_keyword in ['날짜', 'date', '일자', '등록일']):
                                # 날짜 컬럼은 문자열로 유지
                                record[header] = str(cell_value)
                                print(f"    -> 날짜 컬럼으로 문자열 유지: '{cell_value}'")
                            else:
                                # 숫자로 변환 가능한지 확인
                                float_val = float(cell_value)
                                if float_val.is_integer():
                                    record[header] = int(float_val)
                                    print(f"    -> 정수로 변환: {int(float_val)}")
                                else:
                                    record[header] = float_val
                                    print(f"    -> 실수로 변환: {float_val}")
                        except (ValueError, TypeError):
                            # 숫자가 아니면 문자열로 저장
                            record[header] = cell_value
                            print(f"    -> 문자열로 저장: '{cell_value}'")
                    else:
                        record[header] = ''
                        print(f"    -> 빈 값으로 저장")
                    
                all_records.append(record)
                print(f"변환된 행 {row_idx + 1}: {record}")
            
            print(f"\n구글 시트에서 {len(all_records)}개 행을 가져왔습니다.")
            return all_records
            
        except Exception as e:
            print(f"구글 시트 데이터 가져오기 오류: {e}")
            return []
    
    def parse_member_data(self, sheet_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """시트 데이터를 회원 형식으로 파싱"""
        parsed_members = []
        
        for i, row in enumerate(sheet_data):
            try:
                # 필수 필드 검증
                name = row.get('이름', row.get('name', row.get('Name', ''))).strip()
                if not name:
                    continue
                
                # 전화번호 정리
                phone = row.get('연락처', row.get('phone', row.get('Phone', '')))
                if phone:
                    phone = self._parse_phone_number(phone)
                
                # 성별 정리
                gender = row.get('성별', row.get('gender', row.get('Gender', '')))
                if gender:
                    gender_str = str(gender).strip().lower()
                    if gender_str in ['남', '남성', 'male', 'm']:
                        gender = '남'
                    elif gender_str in ['여', '여성', 'female', 'f']:
                        gender = '여'
                    else:
                        gender = ''
                
                # 레벨 정리
                level = row.get('레벨', row.get('level', row.get('Level', '')))
                if level:
                    level_str = str(level).strip()
                    if level_str in ['초급', '중급', '고급', '전문']:
                        level = level_str
                    else:
                        level = ''
                
                parsed_members.append({
                    'name': name,
                    'phone': phone,
                    'gender': gender,
                    'level': level,
                    'email': row.get('이메일', row.get('email', row.get('Email', ''))).strip(),
                    'note': row.get('메모', row.get('note', row.get('Note', ''))).strip()
                })
                
            except Exception as e:
                print(f"회원 행 파싱 오류: {e}, 데이터: {row}")
                continue
        
        print(f"총 {len(parsed_members)}개 회원 데이터 파싱 완료")
        return parsed_members
    
    def _parse_phone_number(self, phone_value) -> str:
        """전화번호를 표준 형식으로 파싱"""
        if not phone_value:
            return ''
        
        try:
            # 문자열로 변환
            phone_str = str(phone_value).strip()
            
            # 이미 올바른 형식인지 확인 (000-0000-0000 또는 000-000-0000)
            if re.match(r'^\d{3}-\d{3,4}-\d{4}$', phone_str):
                return phone_str
            
            # 숫자만 추출
            numbers = re.findall(r'\d+', phone_str)
            if not numbers:
                return ''
            
            # 모든 숫자를 하나의 문자열로 합치기
            all_numbers = ''.join(numbers)
            
            # 길이에 따라 형식 결정
            if len(all_numbers) == 11:  # 01012345678
                return f"{all_numbers[:3]}-{all_numbers[3:7]}-{all_numbers[7:]}"
            elif len(all_numbers) == 10:  # 0101234567
                return f"{all_numbers[:3]}-{all_numbers[3:6]}-{all_numbers[6:]}"
            elif len(all_numbers) == 8:  # 12345678 (일반 전화번호)
                return f"{all_numbers[:4]}-{all_numbers[4:]}"
            else:
                # 길이가 맞지 않으면 원본 반환 (하이픈 제거)
                return re.sub(r'[^\d]', '', phone_str)
                
        except Exception as e:
            print(f"전화번호 파싱 오류: {e}, 원본값: {phone_value}")
            return str(phone_value).strip()
    
    def parse_score_data(self, sheet_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """시트 데이터를 스코어 형식으로 파싱"""
        parsed_scores = []
        
        print(f"스코어 데이터 파싱 시작: {len(sheet_data)}개 행")
        
        for i, row in enumerate(sheet_data):
            try:
                member_name = row.get('이름', row.get('name', row.get('Name', '')))
                if not member_name:
                    continue
                
                print(f"\n=== 행 {i+1} 처리: {member_name} ===")
                print(f"원본 데이터: {row}")
                
                # 날짜 파싱 - 더 많은 컬럼명 패턴과 B열 인덱스 지원
                game_date_str = row.get('날짜', row.get('date', row.get('Date', row.get('일자', row.get('등록일', '')))))
                
                # B열 인덱스로 직접 접근 (B열은 인덱스 1)
                if not game_date_str and len(row) > 1:
                    # row가 딕셔너리가 아닌 리스트인 경우를 대비
                    if isinstance(row, dict):
                        # 딕셔너리의 키들을 확인하여 B열에 해당하는 키 찾기
                        keys = list(row.keys())
                        if len(keys) > 1:
                            b_column_key = keys[1]  # B열에 해당하는 키
                            game_date_str = row.get(b_column_key, '')
                            print(f"B열 키 '{b_column_key}'에서 날짜 데이터 찾음: '{game_date_str}'")
                    else:
                        # 리스트인 경우 인덱스 1 사용
                        game_date_str = row[1] if len(row) > 1 else ''
                        print(f"B열 인덱스에서 날짜 데이터 찾음: '{game_date_str}'")
                
                print(f"원본 날짜 데이터: '{game_date_str}' (타입: {type(game_date_str)})")
                print(f"전체 행 데이터: {row}")
                print(f"행 데이터 타입: {type(row)}")
                if isinstance(row, dict):
                    print(f"행의 모든 키: {list(row.keys())}")
                
                # 날짜 데이터가 없거나 빈 값인지 확인
                if not game_date_str or str(game_date_str).strip() == '':
                    print(f"⚠️ 날짜 데이터가 없거나 빈 값입니다. 오늘 날짜로 설정합니다.")
                    game_date = datetime.now().date()
                elif isinstance(game_date_str, datetime):
                    # datetime 객체인 경우
                    game_date = game_date_str.date()
                    print(f"datetime 객체에서 날짜 추출: {game_date}")
                elif isinstance(game_date_str, str):
                    # 다양한 날짜 형식 처리
                    date_formats = [
                        '%Y-%m-%d',      # 2025-01-20
                        '%Y/%m/%d',      # 2025/01/20
                        '%m/%d/%Y',      # 01/20/2025
                        '%d/%m/%Y',      # 20/01/2025
                        '%Y년 %m월 %d일', # 2025년 01월 20일
                        '%Y년%m월%d일',  # 2025년01월20일
                        '%Y.%m.%d',      # 2025.01.20
                        '%Y-%m-%d %H:%M:%S',  # 2025-01-20 14:30:00
                        '%Y/%m/%d %H:%M:%S',  # 2025/01/20 14:30:00
                    ]
                    
                    game_date = None
                    
                    # 먼저 월일만 있는 형식 처리 (예: 01월 25일)
                    import re
                    month_day_pattern = r'(\d{1,2})월\s*(\d{1,2})일'
                    match = re.match(month_day_pattern, game_date_str)
                    if match:
                        month = int(match.group(1))
                        day = int(match.group(2))
                        current_year = datetime.now().year
                        try:
                            game_date = datetime(current_year, month, day).date()
                            print(f"월일 형식 파싱 성공: '{game_date_str}' → {game_date} (현재 연도 사용)")
                        except ValueError:
                            print(f"월일 형식 파싱 실패: '{game_date_str}'")
                    
                    # 일반 형식 처리
                    if game_date is None:
                        for fmt in date_formats:
                            try:
                                game_date = datetime.strptime(game_date_str, fmt).date()
                                print(f"날짜 파싱 성공: '{game_date_str}' → {game_date} (형식: {fmt})")
                                break
                            except ValueError:
                                continue
                    
                    if game_date is None:
                        print(f"⚠️ 날짜 파싱 실패: '{game_date_str}', 오늘 날짜로 설정")
                        game_date = datetime.now().date()
                else:
                    # 기타 타입 (예: date 객체)
                    try:
                        if hasattr(game_date_str, 'date'):
                            game_date = game_date_str.date()
                            print(f"date 객체에서 날짜 추출: {game_date}")
                        else:
                            game_date = datetime.now().date()
                            print(f"⚠️ 지원하지 않는 날짜 타입: {type(game_date_str)}, 오늘 날짜로 설정")
                    except:
                        print(f"⚠️ 날짜 객체 변환 실패, 오늘 날짜로 설정")
                        game_date = datetime.now().date()
                
                print(f"최종 날짜: {game_date}")
                
                # 스코어 데이터 파싱 - 더 많은 컬럼명 지원
                score1_raw = row.get('1게임', row.get('score1', row.get('Score1', row.get('1', row.get('첫게임', 0)))))
                score2_raw = row.get('2게임', row.get('score2', row.get('Score2', row.get('2', row.get('둘째게임', 0)))))
                score3_raw = row.get('3게임', row.get('score3', row.get('Score3', row.get('3', row.get('셋째게임', 0)))))
                
                print(f"원본 스코어: 1게임={score1_raw}, 2게임={score2_raw}, 3게임={score3_raw}")
                
                score1 = self._parse_score(score1_raw)
                score2 = self._parse_score(score2_raw)
                score3 = self._parse_score(score3_raw)
                
                print(f"파싱된 스코어: 1게임={score1}, 2게임={score2}, 3게임={score3}")
                
                # 총점 계산
                total_score = score1 + score2 + score3
                average_score = total_score / 3 if total_score > 0 else 0
                
                print(f"계산 결과: 총점={total_score}, 평균={average_score}")
                
                parsed_scores.append({
                    'member_name': member_name,
                    'game_date': game_date,
                    'score1': score1,
                    'score2': score2,
                    'score3': score3,
                    'total_score': total_score,
                    'average_score': round(average_score, 2),
                    'note': row.get('메모', row.get('note', row.get('Note', '')))
                })
                
            except Exception as e:
                print(f"스코어 행 파싱 오류: {e}, 데이터: {row}")
                continue
        
        print(f"\n스코어 파싱 완료: {len(parsed_scores)}개 스코어")
        return parsed_scores
    
    def _parse_score(self, score_value) -> int:
        """스코어 값을 정수로 파싱"""
        print(f"  스코어 파싱: {score_value} (타입: {type(score_value)})")
        
        if score_value is None or score_value == '':
            print(f"    -> 빈 값이므로 0 반환")
            return 0
        
        try:
            if isinstance(score_value, (int, float)):
                result = int(score_value)
                print(f"    -> 숫자 타입: {result}")
                return result
            elif isinstance(score_value, str):
                # 문자열에서 숫자만 추출
                cleaned_str = score_value.strip()
                print(f"    -> 문자열 정리: '{cleaned_str}'")
                
                # 빈 문자열 체크
                if not cleaned_str:
                    print(f"    -> 빈 문자열이므로 0 반환")
                    return 0
                
                # 숫자만 추출
                numbers = re.findall(r'\d+', cleaned_str)
                if numbers:
                    result = int(numbers[0])
                    print(f"    -> 숫자 추출: {result}")
                    return result
                else:
                    # 숫자가 없으면 전체 문자열을 숫자로 변환 시도
                    try:
                        result = int(float(cleaned_str))
                        print(f"    -> 문자열을 숫자로 변환: {result}")
                        return result
                    except (ValueError, TypeError):
                        print(f"    -> 숫자 변환 실패, 0 반환")
                        return 0
            else:
                print(f"    -> 지원하지 않는 타입, 0 반환")
                return 0
        except Exception as e:
            print(f"    -> 파싱 예외: {e}, 0 반환")
            return 0 

    def parse_point_data(self, sheet_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """시트 데이터를 포인트 형식으로 파싱"""
        parsed_points = []
        
        print(f"포인트 데이터 파싱 시작: {len(sheet_data)}개 행")
        
        for i, row in enumerate(sheet_data):
            try:
                member_name = row.get('이름', row.get('name', row.get('Name', '')))
                if not member_name:
                    continue
                
                print(f"\n=== 행 {i+1} 처리: {member_name} ===")
                print(f"원본 데이터: {row}")
                
                # 날짜 파싱 - 더 많은 컬럼명 패턴과 B열 인덱스 지원
                point_date_str = row.get('날짜', row.get('date', row.get('Date', row.get('일자', row.get('등록일', '')))))
                
                # B열 인덱스로 직접 접근 (B열은 인덱스 1)
                if not point_date_str and len(row) > 1:
                    # row가 딕셔너리가 아닌 리스트인 경우를 대비
                    if isinstance(row, dict):
                        # 딕셔너리의 키들을 확인하여 B열에 해당하는 키 찾기
                        keys = list(row.keys())
                        if len(keys) > 1:
                            b_column_key = keys[1]  # B열에 해당하는 키
                            point_date_str = row.get(b_column_key, '')
                            print(f"B열 키 '{b_column_key}'에서 날짜 데이터 찾음: '{point_date_str}'")
                    else:
                        # 리스트인 경우 인덱스 1 사용
                        point_date_str = row[1] if len(row) > 1 else ''
                        print(f"B열 인덱스에서 날짜 데이터 찾음: '{point_date_str}'")
                
                print(f"원본 날짜 데이터: '{point_date_str}' (타입: {type(point_date_str)})")
                print(f"전체 행 데이터: {row}")
                print(f"행 데이터 타입: {type(row)}")
                if isinstance(row, dict):
                    print(f"행의 모든 키: {list(row.keys())}")
                
                # 날짜 데이터가 없거나 빈 값인지 확인
                if not point_date_str or str(point_date_str).strip() == '':
                    print(f"⚠️ 날짜 데이터가 없거나 빈 값입니다. 오늘 날짜로 설정합니다.")
                    point_date = datetime.now().date()
                elif isinstance(point_date_str, datetime):
                    # datetime 객체인 경우
                    point_date = point_date_str.date()
                    print(f"datetime 객체에서 날짜 추출: {point_date}")
                elif isinstance(point_date_str, str):
                    # 다양한 날짜 형식 처리
                    date_formats = [
                        '%Y-%m-%d',      # 2025-01-20
                        '%Y/%m/%d',      # 2025/01/20
                        '%m/%d/%Y',      # 01/20/2025
                        '%d/%m/%Y',      # 20/01/2025
                        '%Y년 %m월 %d일', # 2025년 01월 20일
                        '%Y년%m월%d일',  # 2025년01월20일
                        '%Y.%m.%d',      # 2025.01.20
                        '%Y-%m-%d %H:%M:%S',  # 2025-01-20 14:30:00
                        '%Y/%m/%d %H:%M:%S',  # 2025/01/20 14:30:00
                    ]
                    
                    point_date = None
                    
                    # 먼저 월일만 있는 형식 처리 (예: 01월 25일)
                    import re
                    month_day_pattern = r'(\d{1,2})월\s*(\d{1,2})일'
                    match = re.match(month_day_pattern, point_date_str)
                    if match:
                        month = int(match.group(1))
                        day = int(match.group(2))
                        current_year = datetime.now().year
                        try:
                            point_date = datetime(current_year, month, day).date()
                            print(f"월일 형식 파싱 성공: '{point_date_str}' → {point_date} (현재 연도 사용)")
                        except ValueError:
                            print(f"월일 형식 파싱 실패: '{point_date_str}'")
                    
                    # 일반 형식 처리
                    if point_date is None:
                        for fmt in date_formats:
                            try:
                                point_date = datetime.strptime(point_date_str, fmt).date()
                                print(f"날짜 파싱 성공: '{point_date_str}' → {point_date} (형식: {fmt})")
                                break
                            except ValueError:
                                continue
                    
                    if point_date is None:
                        print(f"⚠️ 날짜 파싱 실패: '{point_date_str}', 오늘 날짜로 설정")
                        point_date = datetime.now().date()
                else:
                    # 기타 타입 (예: date 객체)
                    try:
                        if hasattr(point_date_str, 'date'):
                            point_date = point_date_str.date()
                            print(f"date 객체에서 날짜 추출: {point_date}")
                        else:
                            point_date = datetime.now().date()
                            print(f"⚠️ 지원하지 않는 날짜 타입: {type(point_date_str)}, 오늘 날짜로 설정")
                    except:
                        print(f"⚠️ 날짜 객체 변환 실패, 오늘 날짜로 설정")
                        point_date = datetime.now().date()
                
                print(f"최종 날짜: {point_date}")
                
                # 포인트 유형 파싱
                point_type_raw = row.get('유형', row.get('type', row.get('Type', '')))
                point_type = ''
                print(f"원본 유형 데이터: '{point_type_raw}' (타입: {type(point_type_raw)})")
                
                if point_type_raw and str(point_type_raw).strip():
                    point_type_str = str(point_type_raw).strip()
                    print(f"정리된 유형 문자열: '{point_type_str}'")
                    
                    if point_type_str in ['적립', 'earn', 'Earn', 'EARN']:
                        point_type = '적립'
                        print(f"유형을 '적립'으로 설정")
                    elif point_type_str in ['사용', 'use', 'Use', 'USE', '소모', '차감']:
                        point_type = '사용'
                        print(f"유형을 '사용'으로 설정")
                    else:
                        print(f"알 수 없는 유형: '{point_type_str}' - 자동 설정 예정")
                else:
                    print(f"유형 데이터가 없거나 빈 값 - 자동 설정 예정")
                
                print(f"파싱 후 유형: '{point_type}'")
                
                # 포인트 금액 파싱
                amount_raw = row.get('포인트', row.get('amount', row.get('Amount', row.get('점수', 0))))
                amount = self._parse_point_amount(amount_raw)
                
                print(f"포인트 금액: {amount}")
                
                # 포인트 유형이 명시되지 않은 경우에만 금액에 따라 자동 설정
                if not point_type:
                    print(f"유형이 명시되지 않아 자동 설정 시작")
                    if amount < 0:
                        point_type = '사용'
                        print(f"음수 금액({amount})으로 인해 포인트 유형을 '사용'으로 설정")
                    elif amount > 0:
                        point_type = '적립'
                        print(f"양수 금액({amount})으로 인해 포인트 유형을 '적립'으로 설정")
                    else:
                        # 금액이 0인 경우 기본적으로 '적립'으로 설정
                        point_type = '적립'
                        print(f"금액이 0이므로 기본적으로 '적립'으로 설정")
                else:
                    print(f"유형이 이미 설정되어 있음: '{point_type}', 자동 설정 건너뜀")
                
                print(f"최종 포인트 유형: '{point_type}'")
                
                # 유형이 "사용"인 경우 금액을 음수로 변환
                if point_type == '사용' and amount > 0:
                    amount = -amount
                    print(f"유형이 '사용'이므로 금액을 음수로 변환: {amount}")
                elif point_type == '적립' and amount < 0:
                    print(f"유형이 '적립'이지만 금액이 음수입니다: {amount}")
                
                # 사유 파싱
                reason = row.get('사유', row.get('reason', row.get('Reason', '')))
                
                # 메모 파싱
                note = row.get('메모', row.get('note', row.get('Note', '')))
                
                print(f"최종 검증: member_name='{member_name}', point_type='{point_type}', amount={amount}")
                
                if member_name and point_type:
                    parsed_points.append({
                        'member_name': member_name,
                        'point_date': point_date,
                        'point_type': point_type,
                        'amount': amount,
                        'reason': reason,
                        'note': note
                    })
                    print(f"✅ 포인트 추가됨: {member_name} - {point_type} {amount}P")
                else:
                    print(f"❌ 포인트 건너뜀: member_name={bool(member_name)}, point_type={bool(point_type)}, amount={amount}")
                
            except Exception as e:
                print(f"포인트 행 파싱 오류: {e}, 데이터: {row}")
                continue
        
        print(f"\n포인트 파싱 완료: {len(parsed_points)}개 포인트")
        return parsed_points
    
    def _parse_point_amount(self, amount_value) -> int:
        """포인트 금액을 정수로 파싱 (음수 지원, 000 보존)"""
        print(f"  포인트 금액 파싱: {amount_value} (타입: {type(amount_value)})")
        
        if amount_value is None or amount_value == '':
            print(f"    -> 빈 값이므로 0 반환")
            return 0
        
        try:
            if isinstance(amount_value, (int, float)):
                result = int(amount_value)
                print(f"    -> 숫자 타입: {result}")
                return result
            elif isinstance(amount_value, str):
                # 문자열에서 숫자와 부호 추출
                cleaned_str = amount_value.strip()
                print(f"    -> 문자열 정리: '{cleaned_str}'")
                
                # 빈 문자열 체크
                if not cleaned_str:
                    print(f"    -> 빈 문자열이므로 0 반환")
                    return 0
                
                # 음수 부호 확인
                is_negative = False
                if cleaned_str.startswith('-') or cleaned_str.startswith('−'):  # 일반 하이픈과 유니코드 마이너스
                    is_negative = True
                    cleaned_str = cleaned_str[1:].strip()
                    print(f"    -> 음수 부호 감지됨")
                
                # 숫자만 추출 (부호 제외) - 더 정확한 정규식 사용
                # 쉼표나 공백이 포함된 숫자도 처리
                cleaned_str = cleaned_str.replace(',', '').replace(' ', '')
                print(f"    -> 쉼표/공백 제거 후: '{cleaned_str}'")
                
                # 숫자 패턴 매칭 (소수점 포함)
                import re
                number_pattern = r'^-?\d+(?:\.\d+)?$'
                if re.match(number_pattern, cleaned_str):
                    # 정확한 숫자 형식
                    result = int(float(cleaned_str))
                    if is_negative:
                        result = -result
                    print(f"    -> 정확한 숫자 형식: {result}")
                    return result
                else:
                    # 숫자 부분만 추출
                    numbers = re.findall(r'\d+', cleaned_str)
                    if numbers:
                        # 모든 숫자를 연결하여 하나의 숫자로 만듦
                        full_number = ''.join(numbers)
                        result = int(full_number)
                        if is_negative:
                            result = -result
                        print(f"    -> 숫자 추출 후 연결: {result}")
                        return result
                    else:
                        # 숫자가 없으면 전체 문자열을 숫자로 변환 시도
                        try:
                            result = int(float(cleaned_str))
                            if is_negative:
                                result = -result
                            print(f"    -> 문자열을 숫자로 변환: {result}")
                            return result
                        except (ValueError, TypeError):
                            print(f"    -> 숫자 변환 실패, 0 반환")
                            return 0
            else:
                print(f"    -> 지원하지 않는 타입, 0 반환")
                return 0
        except Exception as e:
            print(f"    -> 파싱 예외: {e}, 0 반환")
            return 0 