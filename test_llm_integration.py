#!/usr/bin/env python3
"""
LLM 이미지 분석 기능 테스트 스크립트
"""

import os
import sys
import requests
from PIL import Image, ImageDraw, ImageFont
import io

# 백엔드 디렉토리를 Python 경로에 추가
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

def create_test_image():
    """테스트용 볼링 점수표 이미지 생성"""
    # 이미지 크기 설정
    width, height = 800, 600
    image = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(image)
    
    # 기본 폰트 사용
    try:
        font_large = ImageFont.truetype("arial.ttf", 24)
        font_medium = ImageFont.truetype("arial.ttf", 18)
        font_small = ImageFont.truetype("arial.ttf", 14)
    except:
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    # 제목
    draw.text((50, 30), "볼링 점수표", fill='black', font=font_large)
    draw.text((50, 60), "2025-01-15", fill='black', font=font_medium)
    
    # 헤더
    y_start = 100
    draw.text((50, y_start), "이름", fill='black', font=font_medium)
    draw.text((200, y_start), "1게임", fill='black', font=font_medium)
    draw.text((300, y_start), "2게임", fill='black', font=font_medium)
    draw.text((400, y_start), "3게임", fill='black', font=font_medium)
    draw.text((500, y_start), "총점", fill='black', font=font_medium)
    
    # 데이터 행들
    players = [
        ("김철수", 180, 200, 165),
        ("이영희", 195, 185, 210),
        ("박민수", 170, 175, 180),
        ("정수진", 220, 205, 195)
    ]
    
    y = y_start + 40
    for name, score1, score2, score3 in players:
        total = score1 + score2 + score3
        draw.text((50, y), name, fill='black', font=font_small)
        draw.text((200, y), str(score1), fill='black', font=font_small)
        draw.text((300, y), str(score2), fill='black', font=font_small)
        draw.text((400, y), str(score3), fill='black', font=font_small)
        draw.text((500, y), str(total), fill='black', font=font_small)
        y += 30
    
    # 이미지를 바이트로 변환
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format='PNG')
    img_byte_arr = img_byte_arr.getvalue()
    
    return img_byte_arr

def test_llm_analyzer():
    """LLM 분석기 직접 테스트"""
    try:
        from llm_image_analyzer import llm_analyzer
        
        print("테스트 이미지 생성 중...")
        test_image = create_test_image()
        
        print("LLM 이미지 분석 시작...")
        result = llm_analyzer.process_image(test_image)
        
        print("분석 결과:")
        print(f"성공: {result['success']}")
        if result['success']:
            print(f"메시지: {result['message']}")
            print("인식된 스코어:")
            for i, player in enumerate(result['results'], 1):
                print(f"  {i}. {player['member_name']}: {player['score1']}, {player['score2']}, {player['score3']}")
        else:
            print(f"오류: {result['error']}")
            
    except Exception as e:
        print(f"테스트 실패: {e}")

def test_api_endpoint():
    """API 엔드포인트 테스트"""
    try:
        print("테스트 이미지 생성 중...")
        test_image = create_test_image()
        
        print("API 엔드포인트 테스트 중...")
        files = {'image': ('test_score.png', test_image, 'image/png')}
        
        response = requests.post('http://localhost:5000/api/ocr', files=files)
        
        print(f"응답 상태 코드: {response.status_code}")
        result = response.json()
        
        print("API 응답:")
        print(f"성공: {result['success']}")
        if result['success']:
            print(f"메시지: {result['message']}")
            print("인식된 스코어:")
            for i, player in enumerate(result['results'], 1):
                print(f"  {i}. {player['member_name']}: {player['score1']}, {player['score2']}, {player['score3']}")
        else:
            print(f"오류: {result['error']}")
            
    except Exception as e:
        print(f"API 테스트 실패: {e}")

if __name__ == "__main__":
    print("=== LLM 이미지 분석 기능 테스트 ===\n")
    
    # 환경 변수 확인
    if not os.getenv('GOOGLE_API_KEY'):
        print("경고: GOOGLE_API_KEY 환경 변수가 설정되지 않았습니다.")
        print("LLM 분석기 테스트를 건너뜁니다.\n")
    else:
        print("1. LLM 분석기 직접 테스트")
        test_llm_analyzer()
        print()
    
    print("2. API 엔드포인트 테스트")
    print("   (백엔드 서버가 실행 중이어야 합니다)")
    test_api_endpoint()
    
    print("\n테스트 완료!")
