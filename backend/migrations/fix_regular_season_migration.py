#!/usr/bin/env python3
"""
기존 스코어 데이터의 is_regular_season 필드를 True로 업데이트하는 마이그레이션
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from models import db, Score

def fix_regular_season():
    """기존 스코어 데이터의 is_regular_season을 True로 설정"""
    with app.app_context():
        try:
            # 모든 스코어의 is_regular_season을 True로 설정
            updated_count = Score.query.update({Score.is_regular_season: True})
            db.session.commit()
            
            print(f"✅ {updated_count}개의 스코어 데이터가 정기전으로 설정되었습니다.")
            
            # 결과 확인
            total_scores = Score.query.count()
            regular_scores = Score.query.filter(Score.is_regular_season == True).count()
            print(f"📊 총 스코어: {total_scores}, 정기전 스코어: {regular_scores}")
            
        except Exception as e:
            print(f"❌ 오류 발생: {str(e)}")
            db.session.rollback()

if __name__ == "__main__":
    fix_regular_season()
