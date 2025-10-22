import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Landing.css';

const Landing = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const featureRefs = useRef([]);

  // 표시될 카드 개수 계산
  const getVisibleCardCount = () => {
    if (!isAuthenticated) return 2; // 로그인하지 않은 사용자: 스코어, 포인트
    if (user?.role === 'admin' || user?.role === 'super_admin') return 4; // 관리자: 모든 카드
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

  const handleGetStarted = () => {
    if (isAuthenticated) {
      // 로그인된 사용자는 역할에 따라 다른 페이지로 이동
      if (user.role === 'admin' || user.role === 'super_admin') {
        navigate('/members');
      } else {
        navigate('/scores');
      }
    } else {
      navigate('/login');
    }
  };

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
      <div className="landing-hero">
        <div className="hero-content">
          <h1 className="hero-title">Teamcover</h1>
          <p className="hero-subtitle">볼링 팀 관리의 새로운 경험</p>
          <p className="hero-description">
            회원 관리, 스코어 기록, 포인트 시스템까지
            <br />
            모든 것을 한 곳에서 관리하세요
          </p>

          {!isAuthenticated && (
            <div className="hero-actions">
              <button className="cta-button primary" onClick={handleGetStarted}>
                로그인하기
              </button>
              <button
                className="cta-button secondary"
                onClick={() => navigate('/login')}
              >
                회원가입
              </button>
            </div>
          )}
        </div>

        <div className="hero-image">
          <div className="bowling-illustration">
            <div className="bowling-pin"></div>
            <div className="bowling-ball"></div>
            <div className="score-board">
              <div className="score">300</div>
            </div>
          </div>
        </div>
      </div>

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
                  className="feature-card"
                  ref={(el) => (featureRefs.current[0] = el)}
                  onClick={() => handleCardClick('/members')}
                >
                  <div className="feature-icon">👥</div>
                  <h3>회원</h3>
                  <p>
                    팀원들의 정보를 체계적으로 관리하고
                    <br />
                    볼링 실력을 추적하세요
                  </p>
                  <div className="feature-link">회원 페이지 →</div>
                </div>
              )}

            {/* 모든 사용자가 볼 수 있는 스코어 카드 */}
            <div
              className="feature-card"
              ref={(el) => (featureRefs.current[1] = el)}
              onClick={() => handleCardClick('/scores')}
            >
              <div className="feature-icon">🎯</div>
              <h3>스코어</h3>
              <p>
                매 경기의 점수를 기록하고
                <br />
                개인별 통계를 확인하세요
              </p>
              <div className="feature-link">스코어 페이지 →</div>
            </div>

            {/* 모든 사용자가 볼 수 있는 포인트 카드 */}
            <div
              className="feature-card"
              ref={(el) => (featureRefs.current[2] = el)}
              onClick={() => handleCardClick('/points')}
            >
              <div className="feature-icon">🏆</div>
              <h3>포인트</h3>
              <p>
                경기 참여와 성과에 따른
                <br />
                포인트를 자동으로 관리하세요
              </p>
              <div className="feature-link">포인트 페이지 →</div>
            </div>

            {/* 관리자만 볼 수 있는 팀 배정 카드 */}
            {isAuthenticated &&
              (user?.role === 'admin' || user?.role === 'super_admin') && (
                <div
                  className="feature-card"
                  ref={(el) => (featureRefs.current[3] = el)}
                  onClick={() => handleCardClick('/team-assignment')}
                >
                  <div className="feature-icon">⚡</div>
                  <h3>팀 배정</h3>
                  <p>
                    공정한 팀 구성과
                    <br />
                    균형잡힌 매치를 만들어보세요
                  </p>
                  <div className="feature-link">팀 배정 페이지 →</div>
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
