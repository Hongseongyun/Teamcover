import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Landing.css';

const Landing = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
      const featuresSection = document.querySelector('.features-section');

      if (featuresSection) {
        const sectionTop = featuresSection.offsetTop;
        // const sectionHeight = featuresSection.offsetHeight;
        const windowHeight = window.innerHeight;

        // 섹션이 화면에 보이기 시작할 때
        if (scrollTop + windowHeight > sectionTop + 100) {
          setIsScrolled(true);

          // 각 카드에 순차적으로 애니메이션 적용
          const cards = featuresSection.querySelectorAll('.feature-card');
          cards.forEach((card, index) => {
            setTimeout(() => {
              card.style.opacity = '1';
              card.style.transform = 'translateY(0)';
            }, index * 200); // 200ms 간격으로 순차 애니메이션
          });
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
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

      <div className={`features-section ${isScrolled ? 'visible' : ''}`}>
        <div className="container">
          <div className="features-grid">
            <div className="feature-card" onClick={() => navigate('/login')}>
              <div className="feature-icon">👥</div>
              <h3>회원</h3>
              <p>
                팀원들의 정보를 체계적으로 관리하고
                <br />
                볼링 실력을 추적하세요
              </p>
              <div className="feature-link">회원 페이지 →</div>
            </div>

            <div className="feature-card" onClick={() => navigate('/login')}>
              <div className="feature-icon">🎯</div>
              <h3>스코어</h3>
              <p>
                매 경기의 점수를 기록하고
                <br />
                개인별 통계를 확인하세요
              </p>
              <div className="feature-link">스코어 페이지 →</div>
            </div>

            <div className="feature-card" onClick={() => navigate('/login')}>
              <div className="feature-icon">🏆</div>
              <h3>포인트</h3>
              <p>
                경기 참여와 성과에 따른
                <br />
                포인트를 자동으로 관리하세요
              </p>
              <div className="feature-link">포인트 페이지 →</div>
            </div>

            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>팀 배정</h3>
              <p>
                공정한 팀 구성과
                <br />
                균형잡힌 매치를 만들어보세요
              </p>
            </div>
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
