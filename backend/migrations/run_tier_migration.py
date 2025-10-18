#!/usr/bin/env python3
"""
티어 시스템 마이그레이션 실행 스크립트
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from add_tier_column_migration import migrate_tier_column

if __name__ == "__main__":
    print("🎯 티어 시스템 마이그레이션을 시작합니다...")
    print("=" * 50)
    
    try:
        migrate_tier_column()
        print("\n✅ 마이그레이션이 성공적으로 완료되었습니다!")
        print("\n📋 변경 사항:")
        print("- members 테이블에 tier 컬럼 추가")
        print("- 기존 level 데이터를 tier로 마이그레이션")
        print("- 모든 회원의 티어를 점수 기반으로 재계산")
        print("\n🎮 새로운 티어 시스템:")
        print("- 아이언: 100점 이하")
        print("- 브론즈: 101-150점")
        print("- 실버: 151-200점")
        print("- 골드: 201-250점")
        print("- 플레티넘: 251-280점")
        print("- 다이아: 281-300점")
        print("- 마스터: 301-320점")
        print("- 챌린저: 321점 이상")
        
    except Exception as e:
        print(f"\n❌ 마이그레이션 실패: {e}")
        sys.exit(1)
