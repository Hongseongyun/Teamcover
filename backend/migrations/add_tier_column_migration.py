#!/usr/bin/env python3
"""
티어 컬럼 추가 마이그레이션
- members 테이블에 tier 컬럼 추가
- 기존 level 데이터를 tier로 마이그레이션
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from models import db, Member
from sqlalchemy import text

def migrate_tier_column():
    """티어 컬럼 추가 및 데이터 마이그레이션"""
    app = create_app()
    
    with app.app_context():
        try:
            # 1. tier 컬럼 추가
            print("1. members 테이블에 tier 컬럼 추가 중...")
            db.engine.execute(text("""
                ALTER TABLE members 
                ADD COLUMN tier VARCHAR(20) NULL
            """))
            print("✅ tier 컬럼 추가 완료")
            
            # 2. scores 테이블에 시즌 정보 컬럼 추가
            print("2. scores 테이블에 시즌 정보 컬럼 추가 중...")
            db.engine.execute(text("""
                ALTER TABLE scores 
                ADD COLUMN is_regular_season BOOLEAN DEFAULT TRUE
            """))
            db.engine.execute(text("""
                ALTER TABLE scores 
                ADD COLUMN season_year INTEGER NULL
            """))
            db.engine.execute(text("""
                ALTER TABLE scores 
                ADD COLUMN season_half VARCHAR(10) NULL
            """))
            print("✅ 시즌 정보 컬럼 추가 완료")
            
            # 3. 기존 level 데이터를 tier로 마이그레이션
            print("3. 기존 level 데이터를 tier로 마이그레이션 중...")
            
            # level -> tier 매핑
            level_to_tier = {
                '초급': '아이언',
                '중급': '브론즈', 
                '고급': '실버',
                '프로': '골드'
            }
            
            members = Member.query.all()
            updated_count = 0
            
            for member in members:
                if member.level and member.level in level_to_tier:
                    member.tier = level_to_tier[member.level]
                    updated_count += 1
                else:
                    # level이 없거나 매핑되지 않는 경우 기본값
                    member.tier = '아이언'
                    updated_count += 1
            
            db.session.commit()
            print(f"✅ {updated_count}명의 회원 데이터 마이그레이션 완료")
            
            # 4. 기존 스코어에 시즌 정보 설정
            print("4. 기존 스코어에 시즌 정보 설정 중...")
            
            scores = Score.query.all()
            updated_scores = 0
            
            for score in scores:
                if not score.season_year or not score.season_half:
                    score.set_season_info()
                    updated_scores += 1
            
            db.session.commit()
            print(f"✅ {updated_scores}개의 스코어 시즌 정보 설정 완료")
            
            # 5. 모든 회원의 티어를 점수 기반으로 재계산
            print("5. 모든 회원의 티어를 점수 기반으로 재계산 중...")
            
            for member in members:
                old_tier = member.tier
                member.update_tier()
                if old_tier != member.tier:
                    print(f"  - {member.name}: {old_tier} → {member.tier}")
            
            db.session.commit()
            print("✅ 점수 기반 티어 재계산 완료")
            
            print("\n🎉 티어 시스템 마이그레이션 완료!")
            
        except Exception as e:
            print(f"❌ 마이그레이션 실패: {e}")
            db.session.rollback()
            raise

if __name__ == "__main__":
    migrate_tier_column()
