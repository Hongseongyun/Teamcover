from flask import Blueprint, request, jsonify
from ocr_module import ocr_engine

# OCR Blueprint
ocr_bp = Blueprint('ocr', __name__, url_prefix='/api')

@ocr_bp.route('/ocr', methods=['POST'])
def process_ocr():
    """OCR 이미지 처리 API"""
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': '이미지 파일이 없습니다.'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'success': False, 'error': '선택된 파일이 없습니다.'}), 400
        
        # 이미지 파일 읽기
        image_bytes = file.read()
        
        # OCR 모듈을 사용하여 이미지 처리
        result = ocr_engine.process_image(image_bytes)
        
        if not result['success']:
            return jsonify(result), 500
        
        return jsonify(result)
        
    except Exception as e:
        print(f"OCR 처리 오류: {e}")
        return jsonify({'success': False, 'error': f'OCR 처리 중 오류가 발생했습니다: {str(e)}'}), 500
