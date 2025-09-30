import os
import base64
import json
import re
from io import BytesIO
from PIL import Image
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
import requests

class LLMImageAnalyzer:
    def __init__(self):
        """LLM 이미지 분석기 초기화"""
        # Google Gemini API 설정
        api_key = os.getenv('GOOGLE_API_KEY')
        try:
            if api_key:
                genai.configure(api_key=api_key)
                # Gemini 모델 우선순위대로 시도
                # API 응답에서 확인된 사용 가능한 모델들
                model_attempts = [
                    'gemini-2.5-flash',         # 최신 2.5 Flash (빠르고 효율적)
                    'gemini-2.5-pro',           # 최신 2.5 Pro (고성능)
                    'gemini-2.0-flash',         # 2.0 Flash
                    'gemini-flash-latest',      # 최신 Flash
                    'gemini-pro-latest',        # 최신 Pro
                ]
                
                self.model = None
                for model_name in model_attempts:
                    try:
                        self.model = genai.GenerativeModel(model_name)
                        # 간단한 테스트로 모델 유효성 확인
                        print(f"✅ {model_name} 모델 초기화 성공")
                        break
                    except Exception as e:
                        print(f"⚠️ {model_name} 모델 로드 실패: {str(e)}")
                        continue
                
                if not self.model:
                    print("❌ 사용 가능한 Gemini 모델을 찾을 수 없습니다.")
            else:
                self.model = None
                print("경고: GOOGLE_API_KEY가 설정되지 않았습니다.")
        except Exception as e:
            self.model = None
            print(f"Gemini 초기화 오류: {e}")
    
    def process_image(self, image_bytes):
        """
        이미지를 LLM으로 분석하여 볼링 스코어 데이터를 추출
        
        Args:
            image_bytes: 이미지 바이트 데이터
            
        Returns:
            dict: 분석 결과
        """
        try:
            if not self.model:
                return {
                    'success': False,
                    'error': 'LLM 모델이 초기화되지 않았습니다. API 키를 확인해주세요.'
                }
            
            # 이미지 전처리
            image = self._preprocess_image(image_bytes)
            if not image:
                return {
                    'success': False,
                    'error': '이미지 처리에 실패했습니다.'
                }
            
            # LLM 프롬프트 생성
            prompt = self._create_prompt()
            
            # 이미지와 함께 LLM에 요청
            response = self.model.generate_content([
                prompt,
                image
            ], safety_settings={
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
            })
            
            # 응답 파싱
            result = self._parse_response(response.text)
            
            return result
            
        except Exception as e:
            print(f"LLM 이미지 분석 오류: {e}")
            return {
                'success': False,
                'error': f'이미지 분석 중 오류가 발생했습니다: {str(e)}'
            }
    
    def _preprocess_image(self, image_bytes):
        """이미지 전처리"""
        try:
            # PIL Image로 변환
            image = Image.open(BytesIO(image_bytes))
            
            # 이미지 크기 조정 (너무 큰 이미지는 리사이즈)
            max_size = 2048
            if max(image.size) > max_size:
                ratio = max_size / max(image.size)
                new_size = (int(image.size[0] * ratio), int(image.size[1] * ratio))
                image = image.resize(new_size, Image.Resampling.LANCZOS)
            
            # RGB로 변환
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            return image
            
        except Exception as e:
            print(f"이미지 전처리 오류: {e}")
            return None
    
    def _create_prompt(self):
        """LLM 프롬프트 생성"""
        return """
이 이미지는 볼링 점수표입니다. 이미지에서 다음 정보를 추출해주세요:

1. 각 플레이어의 이름
2. 각 플레이어의 3게임 점수 (1게임, 2게임, 3게임)
3. 게임 날짜 (있다면)

다음 JSON 형식으로 응답해주세요:
{
    "game_date": "YYYY-MM-DD",
    "players": [
        {
            "member_name": "플레이어 이름",
            "score1": 첫번째게임점수,
            "score2": 두번째게임점수,
            "score3": 세번째게임점수
        }
    ]
}

주의사항:
- 점수는 0-300 사이의 정수여야 합니다
- 날짜가 없으면 오늘 날짜를 사용하세요
- 플레이어 이름은 정확히 읽어주세요
- 점수가 명확하지 않으면 0으로 설정하세요
- 한 칸(셀) 안에 숫자가 두 개 이상 보일 때는 가장 오른쪽(마지막) 숫자를 사용하세요. 예: "40/52" → 52, "190 205" → 205
- JSON 형식만 응답하고 다른 텍스트는 포함하지 마세요
"""
    
    def _parse_response(self, response_text):
        """LLM 응답 파싱"""
        try:
            # JSON 부분만 추출
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            
            if start_idx == -1 or end_idx == 0:
                raise ValueError("JSON 형식을 찾을 수 없습니다.")
            
            json_str = response_text[start_idx:end_idx]
            data = json.loads(json_str)
            
            # 데이터 검증 및 변환
            results = []
            game_date = data.get('game_date', '')
            
            def pick_rightmost_number(value):
                """문자열에서 가장 오른쪽 숫자를 선택하여 정수로 반환"""
                if isinstance(value, int):
                    return value
                if isinstance(value, float):
                    return int(value)
                if isinstance(value, str):
                    numbers = re.findall(r"\d+", value)
                    if numbers:
                        return int(numbers[-1])
                # 리스트나 기타 타입일 경우도 마지막 숫자 시도
                if isinstance(value, (list, tuple)):
                    flat = []
                    for item in value:
                        flat.extend(re.findall(r"\d+", str(item)))
                    if flat:
                        return int(flat[-1])
                return 0

            for player in data.get('players', []):
                try:
                    result = {
                        'member_name': str(player.get('member_name', '')).strip(),
                        'game_date': game_date,
                        'score1': pick_rightmost_number(player.get('score1', 0)),
                        'score2': pick_rightmost_number(player.get('score2', 0)),
                        'score3': pick_rightmost_number(player.get('score3', 0))
                    }
                    
                    # 점수 유효성 검사
                    if all(0 <= result[f'score{i}'] <= 300 for i in range(1, 4)):
                        results.append(result)
                    
                except (ValueError, TypeError) as e:
                    print(f"플레이어 데이터 파싱 오류: {e}")
                    continue
            
            if not results:
                return {
                    'success': False,
                    'error': '유효한 스코어 데이터를 찾을 수 없습니다.'
                }
            
            return {
                'success': True,
                'results': results,
                'message': f'{len(results)}명의 스코어를 인식했습니다.'
            }
            
        except json.JSONDecodeError as e:
            print(f"JSON 파싱 오류: {e}")
            print(f"응답 텍스트: {response_text}")
            return {
                'success': False,
                'error': 'LLM 응답을 파싱할 수 없습니다.'
            }
        except Exception as e:
            print(f"응답 파싱 오류: {e}")
            return {
                'success': False,
                'error': f'응답 처리 중 오류가 발생했습니다: {str(e)}'
            }

# 전역 인스턴스
llm_analyzer = LLMImageAnalyzer()
