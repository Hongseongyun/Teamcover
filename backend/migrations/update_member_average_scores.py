#!/usr/bin/env python3
"""
회원들의 평균 점수를 계산하고 저장하는 마이그레이션 스크립트
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from models import db, Member, Score
from datetime import datetime

def update_member_average_scores():
    """모든 회원의 평균 점수를 계산하고 저장"""
    
    with app.app_context():
        try:
            print("회원 평균 점수 업데이트를 시작합니다...")
            
            # 모든 회원 조회
            members = Member.query.all()
            updated_count = 0
            
            for member in members:
                print(f"회원 '{member.name}' 처리 중...")
                
                # 평균 점수 계산
                average_score = member.calculate_regular_season_average()
                
                if average_score is not None:
                    # 평균 점수 저장
                    member.average_score = round(average_score, 2)
                    
                    # 티어 업데이트
                    member.update_tier()
                    
                    updated_count += 1
                    print(f"  - 평균 점수: {round(average_score, 2)}")
                    print(f"  - 티어: {member.tier}")
                else:
                    print(f"  - 정기전 기록이 없어 평균 점수를 계산할 수 없습니다.")
            
            # 데이터베이스에 저장
            db.session.commit()
            
            print(f"\n업데이트 완료!")
            print(f"- 처리된 회원 수: {len(members)}")
            print(f"- 평균 점수가 업데이트된 회원 수: {updated_count}")
            
        except Exception as e:
            print(f"오류 발생: {str(e)}")
            db.session.rollback()
            return False
    
    return True

def verify_average_scores():
    """업데이트된 평균 점수 검증"""
    
    with app.app_context():
        try:
            print("\n평균 점수 검증 중...")
            
            members_with_scores = Member.query.filter(Member.average_score.isnot(None)).all()
            
            print(f"평균 점수가 있는 회원 수: {len(members_with_scores)}")
            
            for member in members_with_scores:
                print(f"- {member.name}: {member.average_score} (티어: {member.tier})")
            
        except Exception as e:
            print(f"검증 중 오류 발생: {str(e)}")

if __name__ == "__main__":
    print("=" * 50)
    print("회원 평균 점수 업데이트 마이그레이션")
    print("=" * 50)
    
    # 평균 점수 업데이트
    if update_member_average_scores():
        # 검증
        verify_average_scores()
        print("\n마이그레이션이 성공적으로 완료되었습니다!")
    else:
        print("\n마이그레이션 중 오류가 발생했습니다.")
        sys.exit(1)
