import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './Home-new.css';

const Home = () => {
  const featureRefs = useRef([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, index) => {
          if (entry.isIntersecting) {
            // 각 카드가 순차적으로 나타나도록 지연 시간 설정
            setTimeout(() => {
              entry.target.classList.add('visible');
            }, index * 200);
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

  return (
    <div className="home">
      <div
        className="hero-section"
        style={{
          position: 'relative',
          textAlign: 'center',
          padding: '120px 20px',
          background: `
             url('/teamcover.jpg') center/cover no-repeat
           `,
          color: 'white',
          borderRadius: '20px',
          marginBottom: '60px',
          overflow: 'hidden',
          minHeight: '500px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* 안개 효과 오버레이 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `
              radial-gradient(circle at 20% 30%, rgba(255,255,255,0.2) 0%, transparent 50%),
              radial-gradient(circle at 80% 70%, rgba(255,255,255,0.15) 0%, transparent 50%),
              radial-gradient(circle at 40% 80%, rgba(255,255,255,0.1) 0%, transparent 50%),
              linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)
            `,
            backgroundSize: '300px 300px, 400px 400px, 200px 200px, 100% 100%',
            opacity: 0.8,
            zIndex: 1,
          }}
        />

        {/* 추가 안개 효과 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(3px)',
            zIndex: 1,
          }}
        />

        {/* 깊이감을 위한 추가 안개 레이어 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `
              linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 30%),
              linear-gradient(315deg, rgba(255,255,255,0.08) 0%, transparent 30%)
            `,
            zIndex: 1,
          }}
        />

        {/* 볼링 핀 실루엣 효과 */}
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '30px',
            width: '60px',
            height: '80px',
            background: `
              radial-gradient(circle at 30px 20px, rgba(255,255,255,0.25) 0%, transparent 50%),
              radial-gradient(circle at 30px 20px, rgba(255,255,255,0.15) 0%, transparent 30%)
            `,
            borderRadius: '50%',
            zIndex: 1,
            opacity: 0.8,
          }}
        />

        {/* 볼링 공 효과 */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            left: '40px',
            width: '40px',
            height: '40px',
            background: `
              radial-gradient(circle at 15px 15px, rgba(255,255,255,0.3) 0%, transparent 50%),
              radial-gradient(circle at 15px 15px, rgba(255,255,255,0.2) 0%, transparent 30%)
            `,
            borderRadius: '50%',
            zIndex: 1,
            opacity: 0.7,
          }}
        />

        <div
          className="hero-content"
          style={{
            position: 'relative',
            zIndex: 2,
            maxWidth: '800px',
          }}
        >
          <h1
            style={{
              fontSize: '2.8rem',
              marginBottom: '25px',
              fontWeight: 900,
              textShadow:
                '4px 4px 8px rgba(255, 255, 255, 0.95), 2px 2px 4px rgba(255, 255, 255, 0.9), 1px 1px 2px rgba(255, 255, 255, 0.8)',
              color: '#000000',
              letterSpacing: '1px',
              lineHeight: 1.2,
            }}
          >
            Teamcover에 오신 것을 환영합니다
          </h1>
          <p
            style={{
              fontSize: '1.2rem',
              opacity: 1,
              maxWidth: '600px',
              margin: '0 auto',
              lineHeight: 1.4,
              textShadow:
                '3px 3px 6px rgba(255, 255, 255, 0.95), 2px 2px 4px rgba(255, 255, 255, 0.9), 1px 1px 2px rgba(255, 255, 255, 0.8)',
              fontWeight: 600,
              letterSpacing: '0.5px',
              color: '#000000',
            }}
          >
            볼링 팀 관리와 스코어 추적을 위한 통합 플랫폼
          </p>
        </div>
      </div>

      <div className="features-grid">
        <div
          className="feature-card"
          ref={(el) => (featureRefs.current[0] = el)}
        >
          <div className="feature-icon">👥</div>
          <div className="feature-content">
            <h3>회원 관리</h3>
            <p>팀커버 회원들의 정보를 체계적으로 관리하고 추적합니다.</p>
            <Link to="/members" className="btn btn-primary">
              회원 관리하기
            </Link>
          </div>
        </div>

        <div
          className="feature-card"
          ref={(el) => (featureRefs.current[1] = el)}
        >
          <div className="feature-icon">🎯</div>
          <div className="feature-content">
            <h3>스코어 관리</h3>
            <p>볼링 게임 결과를 기록하고 개인별 통계를 확인합니다.</p>
            <Link to="/scores" className="btn btn-primary">
              스코어 관리하기
            </Link>
          </div>
        </div>

        <div
          className="feature-card"
          ref={(el) => (featureRefs.current[2] = el)}
        >
          <div className="feature-icon">⭐</div>
          <div className="feature-content">
            <h3>포인트 관리</h3>
            <p>회원들의 포인트 적립과 사용 내역을 관리합니다.</p>
            <Link to="/points" className="btn btn-primary">
              포인트 관리하기
            </Link>
          </div>
        </div>

        <div
          className="feature-card"
          ref={(el) => (featureRefs.current[3] = el)}
        >
          <div className="feature-icon">🎳</div>
          <div className="feature-content">
            <h3>팀 배정</h3>
            <p>공정하고 균형잡힌 팀을 자동으로 구성합니다.</p>
            <Link to="/team-assignment" className="btn btn-primary">
              팀 배정하기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
