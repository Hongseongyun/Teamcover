import React, { useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import BowlingHero from '../components/BowlingHero';
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
