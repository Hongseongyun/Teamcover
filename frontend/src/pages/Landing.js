import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BowlingHero from '../components/BowlingHero';
import './Landing.css';

const Landing = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const featureRefs = useRef([]);

  // 표시될 카드 개수 계산
  const getVisibleCardCount = () => {
    if (!isAuthenticated) return 2; // 로그인하지 않은 사용자: 스코어, 포인트
    if (user?.role === 'admin' || user?.role === 'super_admin') return 5; // 관리자: 모든 카드
    return 2; // 일반 사용자: 스코어, 포인트
  };

  const visibleCardCount = getVisibleCardCount();

  useEffect(() => {
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

    featureRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

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

      <div className="features-section">
        <div className="container">
          <div
            className={`features-grid ${
              visibleCardCount === 2 ? 'two-cards' : ''
            }`}
          >
            {/* 관리자만 볼 수 있는 회원 카드 */}
            {isAuthenticated &&
              (user?.role === 'admin' || user?.role === 'super_admin') && (
                <div
                  className="feature-card left-aligned"
                  ref={(el) => (featureRefs.current[0] = el)}
                  onClick={() => handleCardClick('/members')}
                >
                  <div className="feature-icon">👥</div>
                  <div className="feature-content">
                    <h3>회원</h3>
                    <p>
                      팀원들의 정보를 체계적으로 관리하고 볼링 실력을 추적하세요
                    </p>
                    <div className="feature-link">회원 페이지 →</div>
                  </div>
                </div>
              )}

            {/* 모든 사용자가 볼 수 있는 스코어 카드 */}
            <div
              className="feature-card right-aligned"
              ref={(el) => (featureRefs.current[1] = el)}
              onClick={() => handleCardClick('/scores')}
            >
              <div className="feature-icon">🎯</div>
              <div className="feature-content">
                <h3>스코어</h3>
                <p>매 경기의 점수를 기록하고 개인별 통계를 확인하세요</p>
                <div className="feature-link">스코어 페이지 →</div>
              </div>
            </div>

            {/* 모든 사용자가 볼 수 있는 포인트 카드 */}
            <div
              className="feature-card left-aligned"
              ref={(el) => (featureRefs.current[2] = el)}
              onClick={() => handleCardClick('/points')}
            >
              <div className="feature-icon">🏆</div>
              <div className="feature-content">
                <h3>포인트</h3>
                <p>경기 참여와 성과에 따른 포인트를 자동으로 관리하세요</p>
                <div className="feature-link">포인트 페이지 →</div>
              </div>
            </div>

            {/* 관리자만 볼 수 있는 팀 배정 카드 */}
            {isAuthenticated &&
              (user?.role === 'admin' || user?.role === 'super_admin') && (
                <div
                  className="feature-card right-aligned"
                  ref={(el) => (featureRefs.current[3] = el)}
                  onClick={() => handleCardClick('/team-assignment')}
                >
                  <div className="feature-icon">⚡</div>
                  <div className="feature-content">
                    <h3>팀 배정</h3>
                    <p>공정한 팀 구성과 균형잡힌 매치를 만들어보세요</p>
                    <div className="feature-link">팀 배정 페이지 →</div>
                  </div>
                </div>
              )}

            {/* 관리자만 볼 수 있는 회비관리 카드 */}
            {isAuthenticated &&
              (user?.role === 'admin' || user?.role === 'super_admin') && (
                <div
                  className="feature-card left-aligned"
                  ref={(el) => (featureRefs.current[4] = el)}
                  onClick={() => handleCardClick('/payments')}
                >
                  <div className="feature-icon">💰</div>
                  <div className="feature-content">
                    <h3>회비관리</h3>
                    <p>월회비와 정기전 게임비를 효율적으로 관리하세요</p>
                    <div className="feature-link">회비관리 페이지 →</div>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>

      <footer className="landing-footer">
        <div className="container">
          <p>&copy; 2025 Teamcover. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
