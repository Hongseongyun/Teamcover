import React, { useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import BowlingHero from '../components/BowlingHero';
import FeatureSection from '../components/FeatureSection';
import './Landing.css';

const Landing = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, hasRole } = useAuth();
  const { currentClub, isAdmin: isClubAdmin } = useClub();
  const featureRefs = useRef([]);

  // 활성화된 메뉴 목록 계산
  const availableMenus = useMemo(() => {
    if (!isAuthenticated) {
      console.log('Landing: Not authenticated');
      return [];
    }

    const isSuperAdmin = user?.role === 'super_admin';
    const isAdminForCurrentClub = isSuperAdmin || isClubAdmin;
    const isUser =
      user?.role === 'user' || user?.role === 'admin' || isSuperAdmin;

    console.log('Landing: Calculating menus', {
      isAuthenticated,
      userRole: user?.role,
      isSuperAdmin,
      isClubAdmin,
      isAdminForCurrentClub,
      currentClub: currentClub?.name,
      isPointsEnabled: currentClub?.is_points_enabled,
    });

    const menus = [];

    // 회원 (관리자만)
    if (isAdminForCurrentClub) {
      menus.push({
        path: '/members',
        icon: '👥',
        title: '회원',
        description:
          '팀원들의 정보를 체계적으로 관리하고 볼링 실력을 추적하세요',
      });
    }

    // 스코어 (모든 사용자)
    if (isUser) {
      menus.push({
        path: '/scores',
        icon: '🎯',
        title: '스코어',
        description: '매 경기의 점수를 기록하고 개인별 통계를 확인하세요',
      });
    }

    // 포인트 (포인트 시스템이 활성화된 경우만)
    if (isUser && currentClub?.is_points_enabled) {
      menus.push({
        path: '/points',
        icon: '🏆',
        title: '포인트',
        description: '경기 참여와 성과에 따른 포인트를 자동으로 관리하세요',
      });
    }

    // 게시판 (모든 사용자)
    if (isUser) {
      menus.push({
        path: '/board',
        icon: '📋',
        title: '게시판',
        description: '팀 소식과 공지사항을 공유하고 소통하세요',
      });
    }

    // 회비관리 (관리자만)
    if (isAdminForCurrentClub) {
      menus.push({
        path: '/payments',
        icon: '💰',
        title: '회비관리',
        description: '월회비와 정기전 게임비를 효율적으로 관리하세요',
      });
    }

    // 팀 배정 (관리자만)
    if (isAdminForCurrentClub) {
      menus.push({
        path: '/team-assignment',
        icon: '⚡',
        title: '팀 배정',
        description: '공정한 팀 구성과 균형잡힌 매치를 만들어보세요',
      });
    }

    // 사용자 관리 (슈퍼관리자만)
    if (isSuperAdmin) {
      menus.push({
        path: '/user-management',
        icon: '👤',
        title: '사용자 관리',
        description: '시스템 사용자들의 역할과 상태를 관리할 수 있습니다',
      });
    }

    console.log('Landing: Available menus', menus);
    return menus;
  }, [isAuthenticated, user, currentClub, isClubAdmin]);

  useEffect(() => {
    // availableMenus가 변경될 때마다 observer 재설정
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // 카드가 화면에 나타나면 즉시 애니메이션 적용
            entry.target.classList.add('visible');
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    // featureRefs 초기화
    featureRefs.current = featureRefs.current.slice(0, availableMenus.length);

    featureRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [availableMenus]);

  // handleGetStarted 함수는 주석 처리된 hero 섹션에서 사용됨
  // const handleGetStarted = () => {
  //   if (isAuthenticated) {
  //     // 로그인된 사용자는 역할에 따라 다른 페이지로 이동
  //     if (user.role === 'admin' || user.role === 'super_admin') {
  //       navigate('/members');
  //     } else {
  //       navigate('/scores');
  //     }
  //   } else {
  //     navigate('/login');
  //   }
  // };

  const handleCardClick = (page) => {
    if (isAuthenticated) {
      // 로그인된 사용자는 해당 페이지로 직접 이동
      navigate(page);
    } else {
      // 로그인되지 않은 사용자는 로그인 페이지로 이동
      navigate('/login');
    }
  };

  return (
    <div className="landing-container">
      {/* 토스 스타일 히어로 섹션 */}
      <BowlingHero />

      {/* 기능 소개 섹션들 - 로그인 전에도 표시 */}
      {!isAuthenticated && (
        <>
          {/* 회원 관리 섹션 */}
          <FeatureSection
            title="회원 관리"
            subtitle="팀원 정보를 체계적으로 관리하세요"
            description="회원 정보를 한 곳에서 관리하고, 볼링 실력을 추적하며, 티어 시스템으로 성장을 시각화하세요."
            features={[
              '회원 정보 통합 관리',
              '볼링 실력 추적 및 통계',
              '티어 시스템으로 성장 시각화',
              '회원별 상세 프로필 관리',
            ]}
            imagePosition="right"
            imageComponent={
              <div className="feature-preview members-preview">
                <div className="preview-card">
                  <div className="preview-header">회원 목록</div>
                  <div className="preview-content">
                    <div className="preview-item">
                      <span className="preview-name">김볼링</span>
                      <span className="preview-badge gold">GOLD</span>
                    </div>
                    <div className="preview-item">
                      <span className="preview-name">이스코어</span>
                      <span className="preview-badge platinum">PLATINUM</span>
                    </div>
                    <div className="preview-item">
                      <span className="preview-name">박스트라이크</span>
                      <span className="preview-badge diamond">DIAMOND</span>
                    </div>
                  </div>
                </div>
              </div>
            }
            ctaText="회원 관리 시작하기"
            ctaPath="/login"
          />

          {/* 스코어 기록 섹션 */}
          <FeatureSection
            title="스코어 기록"
            subtitle="매 경기의 점수를 기록하고 통계를 확인하세요"
            description="경기 점수를 쉽게 기록하고, 개인별 통계와 평균 순위를 확인하여 실력 향상을 추적하세요."
            features={[
              '간편한 점수 기록',
              '개인별 통계 및 그래프',
              '평균 순위 및 티어 표시',
              '경기 이력 관리',
            ]}
            imagePosition="left"
            imageComponent={
              <div className="feature-preview scores-preview">
                <div className="preview-card">
                  <div className="preview-header">스코어 기록</div>
                  <div className="preview-content">
                    <div className="preview-score-row">
                      <span>게임 1</span>
                      <span className="preview-score">180</span>
                    </div>
                    <div className="preview-score-row">
                      <span>게임 2</span>
                      <span className="preview-score">195</span>
                    </div>
                    <div className="preview-score-row">
                      <span>게임 3</span>
                      <span className="preview-score">210</span>
                    </div>
                    <div className="preview-average">
                      평균: <strong>195</strong>
                    </div>
                  </div>
                </div>
              </div>
            }
            ctaText="스코어 기록 시작하기"
            ctaPath="/login"
          />

          {/* 포인트 시스템 섹션 */}
          <FeatureSection
            title="포인트 시스템"
            subtitle="경기 참여와 성과에 따른 포인트를 자동으로 관리하세요"
            description="경기 참여와 성과에 따라 포인트를 자동으로 적립하고, 포인트 내역을 한눈에 확인하세요."
            features={[
              '경기 참여 포인트 자동 적립',
              '성과별 포인트 차등 지급',
              '포인트 내역 실시간 조회',
              '포인트로 회비 납부 가능',
            ]}
            imagePosition="right"
            imageComponent={
              <div className="feature-preview points-preview">
                <div className="preview-card">
                  <div className="preview-header">포인트 내역</div>
                  <div className="preview-content">
                    <div className="preview-point-item plus">
                      <span>경기 참여</span>
                      <span>+100</span>
                    </div>
                    <div className="preview-point-item plus">
                      <span>1등 달성</span>
                      <span>+200</span>
                    </div>
                    <div className="preview-point-item minus">
                      <span>회비 납부</span>
                      <span>-50</span>
                    </div>
                    <div className="preview-balance">
                      잔액: <strong>250</strong>
                    </div>
                  </div>
                </div>
              </div>
            }
            ctaText="포인트 시스템 확인하기"
            ctaPath="/login"
          />

          {/* 회비 관리 섹션 */}
          <FeatureSection
            title="회비 관리"
            subtitle="월회비와 게임비를 효율적으로 관리하세요"
            description="월회비와 정기전 게임비를 체계적으로 관리하고, 납입 현황을 한눈에 확인하세요."
            features={[
              '월회비 자동 관리',
              '게임비 일괄 처리',
              '납입 현황 실시간 조회',
              '포인트로 회비 납부 가능',
            ]}
            imagePosition="left"
            imageComponent={
              <div className="feature-preview payments-preview">
                <div className="preview-card">
                  <div className="preview-header">회비 관리</div>
                  <div className="preview-content">
                    <div className="preview-payment-item">
                      <span>2025년 12월 회비</span>
                      <span className="preview-status paid">납입완료</span>
                    </div>
                    <div className="preview-payment-item">
                      <span>정기전 게임비</span>
                      <span className="preview-status pending">미납</span>
                    </div>
                    <div className="preview-total">
                      총 잔액: <strong>613,600원</strong>
                    </div>
                  </div>
                </div>
              </div>
            }
            ctaText="회비 관리 시작하기"
            ctaPath="/login"
          />

          {/* 팀 배정 섹션 */}
          <FeatureSection
            title="팀 배정"
            subtitle="공정한 팀 구성과 균형잡힌 매치를 만들어보세요"
            description="회원들의 평균 점수를 기반으로 공정하고 균형잡힌 팀을 자동으로 구성하세요."
            features={[
              '평균 점수 기반 자동 팀 배정',
              '공정한 팀 밸런싱',
              '다양한 배정 알고리즘',
              '팀 구성 결과 미리보기',
            ]}
            imagePosition="right"
            imageComponent={
              <div className="feature-preview team-preview">
                <div className="preview-card">
                  <div className="preview-header">팀 배정</div>
                  <div className="preview-content">
                    <div className="preview-team">
                      <div className="preview-team-title">팀 A</div>
                      <div className="preview-team-members">
                        <span>김볼링</span>
                        <span>이스코어</span>
                      </div>
                      <div className="preview-team-avg">평균: 185</div>
                    </div>
                    <div className="preview-team">
                      <div className="preview-team-title">팀 B</div>
                      <div className="preview-team-members">
                        <span>박스트라이크</span>
                        <span>최퍼펙트</span>
                      </div>
                      <div className="preview-team-avg">평균: 183</div>
                    </div>
                  </div>
                </div>
              </div>
            }
            ctaText="팀 배정 시작하기"
            ctaPath="/login"
          />

          {/* 게시판 섹션 */}
          <FeatureSection
            title="게시판"
            subtitle="팀 소식과 공지사항을 공유하고 소통하세요"
            description="팀 소식, 공지사항, 경기 결과를 공유하고 회원들과 소통하는 공간입니다."
            features={[
              '공지사항 및 소식 공유',
              '경기 결과 및 사진 업로드',
              '댓글 및 좋아요 기능',
              '실시간 알림',
            ]}
            imagePosition="left"
            imageComponent={
              <div className="feature-preview board-preview">
                <div className="preview-card">
                  <div className="preview-header">게시판</div>
                  <div className="preview-content">
                    <div className="preview-post">
                      <div className="preview-post-title">12월 정기전 안내</div>
                      <div className="preview-post-meta">2025.12.01</div>
                    </div>
                    <div className="preview-post">
                      <div className="preview-post-title">이번주 경기 결과</div>
                      <div className="preview-post-meta">2025.11.28</div>
                    </div>
                    <div className="preview-post">
                      <div className="preview-post-title">
                        새로운 회원 환영합니다!
                      </div>
                      <div className="preview-post-meta">2025.11.25</div>
                    </div>
                  </div>
                </div>
              </div>
            }
            ctaText="게시판 보기"
            ctaPath="/login"
          />
        </>
      )}

      {/* 기존 hero 섹션 (주석 처리 또는 제거 가능) */}
      {/* <div className="landing-hero">
        <div className="landing-hero-inner">
          <div className="hero-content">
            <p className="hero-kicker">우리 팀의 모든 볼링 활동을, 한눈에</p>
            <h1 className="hero-title">
              볼링 팀 운영,
              <br />
              Teamcover로 쉽고 간편하게
            </h1>
            <p className="hero-subtitle">
              회원·스코어·포인트·팀 배정까지 한 곳에서 관리하고,
              <br />
              매주 반복되는 팀 운영을 자동화하세요.
            </p>

            <div className="hero-actions">
              <button className="cta-button primary" onClick={handleGetStarted}>
                지금 시작하기
              </button>
            </div>
          </div>
        </div>
      </div> */}

      {/* 하단 기능 카드: 로그인 + 클럽 선택 후에만 표시 (슈퍼관리자는 클럽 선택 없이도 사용자 관리 표시) */}
      {(() => {
        const shouldShow =
          isAuthenticated &&
          (currentClub || user?.role === 'super_admin') &&
          availableMenus.length > 0;
        console.log('Landing: Should show cards?', {
          isAuthenticated,
          hasCurrentClub: !!currentClub,
          isSuperAdmin: user?.role === 'super_admin',
          availableMenusCount: availableMenus.length,
          shouldShow,
        });
        return shouldShow;
      })() && (
        <div className="features-section">
          <div className="container">
            <div
              className={`features-grid ${
                availableMenus.length <= 2 ? 'two-cards' : ''
              }`}
            >
              {availableMenus.map((menu, index) => (
                <div
                  key={menu.path}
                  className={`feature-card ${
                    index % 2 === 0 ? 'left-aligned' : 'right-aligned'
                  }`}
                  ref={(el) => {
                    if (el) {
                      featureRefs.current[index] = el;
                    }
                  }}
                  onClick={() => handleCardClick(menu.path)}
                >
                  <div className="feature-icon">{menu.icon}</div>
                  <div className="feature-content">
                    <h3>{menu.title}</h3>
                    <p>{menu.description}</p>
                    <div className="feature-link">{menu.title} 페이지 →</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Landing;
