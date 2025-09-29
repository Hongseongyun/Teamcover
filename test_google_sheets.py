#!/usr/bin/env python3
"""
구글 시트 기능 테스트 스크립트
배포된 서버에서 구글 시트 연동이 제대로 작동하는지 확인합니다.
"""

import requests
import json
import os
from dotenv import load_dotenv

# 환경변수 로드
load_dotenv()

# 서버 URL 설정 (배포된 서버 URL로 변경)
SERVER_URL = os.environ.get('SERVER_URL', 'http://localhost:5000')

def test_google_sheets_auth():
    """구글 시트 인증 상태 테스트"""
    print("=== 구글 시트 인증 상태 테스트 ===")
    
    try:
        response = requests.get(f"{SERVER_URL}/api/sheets/debug-auth")
        data = response.json()
        
        print(f"응답 상태: {response.status_code}")
        print(f"성공 여부: {data.get('success', False)}")
        
        if data.get('success'):
            print("\n환경변수 상태:")
            env_vars = data.get('environment_variables', {})
            for key, value in env_vars.items():
                print(f"  {key}: {value}")
            
            print(f"\n누락된 필수 필드: {data.get('missing_required_fields', [])}")
            print(f"인증 결과: {data.get('authentication_result', False)}")
            print(f"클라이언트 초기화: {data.get('client_initialized', False)}")
            print(f"자격 증명 초기화: {data.get('credentials_initialized', False)}")
        else:
            print(f"오류: {data.get('error', '알 수 없는 오류')}")
            
    except Exception as e:
        print(f"테스트 실패: {e}")

def test_google_sheets_import():
    """구글 시트 가져오기 기능 테스트"""
    print("\n=== 구글 시트 가져오기 기능 테스트 ===")
    
    # 테스트용 구글 시트 URL (실제 URL로 변경 필요)
    test_url = input("테스트할 구글 시트 URL을 입력하세요 (또는 Enter로 건너뛰기): ").strip()
    
    if not test_url:
        print("테스트를 건너뜁니다.")
        return
    
    # 스코어 가져오기 테스트
    print("\n1. 스코어 가져오기 테스트")
    try:
        payload = {
            "spreadsheet_url": test_url,
            "worksheet_name": "",
            "clear_existing": False
        }
        
        response = requests.post(f"{SERVER_URL}/api/scores/import-from-sheets", 
                               json=payload,
                               headers={'Content-Type': 'application/json'})
        
        data = response.json()
        print(f"응답 상태: {response.status_code}")
        print(f"성공 여부: {data.get('success', False)}")
        print(f"메시지: {data.get('message', '')}")
        
        if data.get('success'):
            print(f"가져온 스코어 수: {data.get('imported_count', 0)}")
            print(f"건너뛴 수: {data.get('skipped_count', 0)}")
            print(f"오류 수: {data.get('error_count', 0)}")
        else:
            print(f"오류 타입: {data.get('error_type', 'unknown')}")
            
    except Exception as e:
        print(f"스코어 가져오기 테스트 실패: {e}")
    
    # 포인트 가져오기 테스트
    print("\n2. 포인트 가져오기 테스트")
    try:
        payload = {
            "spreadsheet_url": test_url,
            "worksheet_name": "",
            "clear_existing": False
        }
        
        response = requests.post(f"{SERVER_URL}/api/points/import-from-sheets", 
                               json=payload,
                               headers={'Content-Type': 'application/json'})
        
        data = response.json()
        print(f"응답 상태: {response.status_code}")
        print(f"성공 여부: {data.get('success', False)}")
        print(f"메시지: {data.get('message', '')}")
        
        if data.get('success'):
            print(f"가져온 포인트 수: {data.get('imported_count', 0)}")
            print(f"건너뛴 수: {data.get('skipped_count', 0)}")
            print(f"오류 수: {data.get('error_count', 0)}")
        else:
            print(f"오류 타입: {data.get('error_type', 'unknown')}")
            
    except Exception as e:
        print(f"포인트 가져오기 테스트 실패: {e}")

def main():
    """메인 함수"""
    print("구글 시트 기능 테스트 시작")
    print(f"서버 URL: {SERVER_URL}")
    print("-" * 50)
    
    # 1. 인증 상태 테스트
    test_google_sheets_auth()
    
    # 2. 가져오기 기능 테스트
    test_google_sheets_import()
    
    print("\n테스트 완료!")

if __name__ == "__main__":
    main()
