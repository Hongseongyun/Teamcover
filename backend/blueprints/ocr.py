from flask import Blueprint, request, jsonify
import sys
import os

# 상위 디렉토리를 Python 경로에 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm_image_analyzer import llm_analyzer

# LLM 이미지 분석 Blueprint
ocr_bp = Blueprint('ocr', __name__, url_prefix='/api')

@ocr_bp.route('/ocr', methods=['POST'])
def process_ocr():
    """LLM 기반 이미지 분석 API"""
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': '이미지 파일이 없습니다.'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'success': False, 'error': '선택된 파일이 없습니다.'}), 400
        
        # 이미지 파일 읽기
        image_bytes = file.read()
        
        # LLM 분석기를 사용하여 이미지 처리
        result = llm_analyzer.process_image(image_bytes)
        
        if not result['success']:
            return jsonify(result), 500
        
        return jsonify(result)
        
    except Exception as e:
        print(f"LLM 이미지 분석 오류: {e}")
        return jsonify({'success': False, 'error': f'이미지 분석 중 오류가 발생했습니다: {str(e)}'}), 500


@ocr_bp.route('/ocr/status', methods=['GET'])
def ocr_status():
    """LLM 키 및 모델 상태 점검"""
    try:
        import google.generativeai as genai
        import os

        api_key = os.getenv('GOOGLE_API_KEY', '')
        masked = f"{api_key[:6]}..." if api_key else 'NOT_SET'

        if not api_key:
            return jsonify({
                'success': False,
                'message': 'GOOGLE_API_KEY가 설정되지 않았습니다.',
                'google_api_key': masked
            }), 200

        # API 키 설정
        genai.configure(api_key=api_key)

        # 사용 가능한 모델 목록 조회
        try:
            available_models = []
            for m in genai.list_models():
                if 'generateContent' in m.supported_generation_methods:
                    available_models.append(m.name)
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'모델 조회 실패: {str(e)}',
                'google_api_key': masked
            }), 200

        # 현재 로드된 모델 확인
        current_model = None
        if llm_analyzer.model:
            current_model = llm_analyzer.model._model_name if hasattr(llm_analyzer.model, '_model_name') else 'Unknown'

        return jsonify({
            'success': True,
            'message': 'LLM 모델이 준비되었습니다.' if llm_analyzer.model else 'LLM 모델 초기화 실패',
            'google_api_key': masked,
            'current_model': current_model,
            'available_models': available_models,
            'model_initialized': bool(llm_analyzer.model)
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'상태 점검 오류: {str(e)}'}), 500
