import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

// 기본 볼링 아이템 데이터 (이미지와 크기만 정의)
const BOWLING_ITEMS = [
  {
    id: 1,
    image: '/bowling-pin.png',
    type: 'pin',
    radius: 60,
  },
  {
    id: 2,
    image: '/bowling-ball.png',
    type: 'ball',
    radius: 55,
  },
  {
    id: 3,
    image: 'bowling_abag.png',
    type: 'abag',
    radius: 58,
  },
  {
    id: 4,
    image: '/wrist-support.png',
    type: 'wrist',
    radius: 55,
  },
  {
    id: 5,
    image: '/bowling-ball-2.png',
    type: 'ball',
    radius: 52,
  },
  {
    id: 6,
    image: '/bowling-shoes.png',
    type: 'shoes',
    radius: 62,
  },
  {
    id: 7,
    image: '/bowling-ball-3.png',
    type: 'ball',
    radius: 57,
  },
  {
    id: 8,
    image: '/bowling-bag.png',
    type: '3bag',
    radius: 65,
  },
];

// 랜덤 초기 위치 생성 (서로 겹치지 않도록 간단한 반복 배치)
function createInitialBodies(width, height) {
  const padding = 120; // 화면 가장자리와의 최소 거리
  const maxAttempts = 500;
  const bodies = [];

  BOWLING_ITEMS.forEach((item) => {
    let attempts = 0;
    let placed = false;

    while (!placed && attempts < maxAttempts) {
      const x = padding + Math.random() * (width - padding * 2); // padding~(width-padding) 사이
      const y = padding + Math.random() * (height - padding * 2 - 200); // 윗쪽 여백 조금 더

      const radius = item.radius;
      let overlaps = false;

      for (const other of bodies) {
        const dx = other.x - x;
        const dy = other.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < other.radius + radius + 20) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        bodies.push({
          id: item.id,
          image: item.image,
          type: item.type,
          radius,
          x,
          y,
          vx: (Math.random() - 0.5) * 0.5, // 아주 작은 랜덤 속도
          vy: (Math.random() - 0.5) * 0.5,
        });
        placed = true;
      }

      attempts += 1;
    }
  });

  return bodies;
}

const BowlingHero = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { theme } = useTheme();

  // 렌더링용 상태: x, y, radius 정도만 노출
  const [renderBodies, setRenderBodies] = useState([]);

  // 실제 물리 계산에 쓰는 ref
  const bodiesRef = useRef([]);
  const mouseRef = useRef({ x: null, y: null, active: false });
  const animationRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const width = rect.width || window.innerWidth || 1920;
    const height = rect.height || window.innerHeight || 1080;

    // 초기 바디 생성
    const initial = createInitialBodies(width, height);
    bodiesRef.current = initial;
    setRenderBodies(
      initial.map(({ id, x, y, radius, image, type }) => ({
        id,
        x,
        y,
        radius,
        image,
        type,
      }))
    );

    // 마우스 이동 핸들러
    const handleMouseMove = (e) => {
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    let lastTime = performance.now();

    const tick = (time) => {
      const dt = Math.min((time - lastTime) / 16.67, 2); // 60fps 기준 배율, 최대 2배
      lastTime = time;

      const bodies = bodiesRef.current.map((b) => ({ ...b }));

      const centerX = width / 2;
      const centerY = height / 2;

      // 1. 마우스 반발력
      if (mouseRef.current.active && mouseRef.current.x != null) {
        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;
        const mouseRadius = 130; // 마우스 영향 반경

        bodies.forEach((b) => {
          const dx = b.x - mx;
          const dy = b.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          if (dist < mouseRadius) {
            // 가까울수록 강하게 미는 힘
            const strength = (1 - dist / mouseRadius) * 400; // 힘 크기
            const fx = (dx / dist) * strength;
            const fy = (dy / dist) * strength;
            b.vx += (fx / b.radius) * dt;
            b.vy += (fy / b.radius) * dt;
          }
        });
      }

      // 2. 공들끼리 충돌 처리 (단순한 반발)
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i];
          const b = bodies[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minDist = a.radius + b.radius;

          if (dist < minDist) {
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;

            // 위치를 반씩 밀어서 겹침 해소
            const push = overlap / 2;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;

            // 속도를 반대로 조금 튕김
            const bounce = 0.4;
            const relativeVx = b.vx - a.vx;
            const relativeVy = b.vy - a.vy;
            const relDotN = relativeVx * nx + relativeVy * ny;

            if (relDotN < 0) {
              const impulse = -relDotN * bounce;
              const ix = impulse * nx;
              const iy = impulse * ny;

              a.vx -= ix;
              a.vy -= iy;
              b.vx += ix;
              b.vy += iy;
            }
          }
        }
      }

      // 3. 속도/위치 업데이트 + 경계 처리
      const friction = 0.96; // 마찰(저항)
      const cornerThreshold = 140; // 코너 근처 판정

      bodies.forEach((b) => {
        // 속도에 마찰 적용
        b.vx *= friction;
        b.vy *= friction;

        // 위치 업데이트
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        const left = b.radius;
        const right = width - b.radius;
        const top = b.radius + 40; // 상단 텍스트와 조금 떨어뜨리기
        const bottom = height - b.radius - 40;

        let hitHorizontal = false;
        let hitVertical = false;

        // 좌우 벽
        if (b.x < left) {
          b.x = left;
          b.vx = Math.abs(b.vx) * 0.7;
          hitHorizontal = true;
        } else if (b.x > right) {
          b.x = right;
          b.vx = -Math.abs(b.vx) * 0.7;
          hitHorizontal = true;
        }

        // 상하 벽
        if (b.y < top) {
          b.y = top;
          b.vy = Math.abs(b.vy) * 0.7;
          hitVertical = true;
        } else if (b.y > bottom) {
          b.y = bottom;
          b.vy = -Math.abs(b.vy) * 0.7;
          hitVertical = true;
        }

        // 코너 근처에서 중앙으로 더 강하게 튕기기
        const nearLeft = b.x < cornerThreshold;
        const nearRight = b.x > width - cornerThreshold;
        const nearTop = b.y < cornerThreshold;
        const nearBottom = b.y > height - cornerThreshold;

        if (
          (nearLeft || nearRight) &&
          (nearTop || nearBottom) &&
          (hitHorizontal || hitVertical)
        ) {
          const dx = centerX - b.x;
          const dy = centerY - b.y;
          const distToCenter = Math.sqrt(dx * dx + dy * dy) || 1;
          const boost = 22; // 중앙으로 당기는 힘 크기
          b.vx += (dx / distToCenter) * boost;
          b.vy += (dy / distToCenter) * boost;
        }
      });

      bodiesRef.current = bodies;
      setRenderBodies(
        bodies.map(({ id, x, y, radius, image, type }) => ({
          id,
          x,
          y,
          radius,
          image,
          type,
        }))
      );

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full min-h-screen overflow-hidden ${
        theme === 'dark'
          ? 'bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900'
          : 'bg-gradient-to-b from-blue-50 via-white to-blue-50'
      }`}
    >
      {/* 볼링 이미지들 (자유롭게 떠다니는 객체) */}
      {renderBodies.map((b) => (
        <div
          key={b.id}
          className="absolute pointer-events-none"
          style={{
            left: 0,
            top: 0,
            transform: `translate(${b.x}px, ${b.y}px) translate(-50%, -50%)`,
            width: `${b.radius * 2}px`,
            height: `${b.radius * 2}px`,
            filter:
              'drop-shadow(0 24px 55px rgba(15,23,42,0.45)) drop-shadow(0 10px 20px rgba(15,23,42,0.35))',
            transition: 'transform 0.04s linear',
            zIndex: 1,
          }}
        >
          <img
            src={b.image}
            alt={b.type}
            className="w-full h-full object-contain select-none"
            draggable={false}
          />
        </div>
      ))}

      {/* 중앙 카피 영역 */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-20 pointer-events-none">
        <div className="text-center mb-8">
          <h1
            className={`text-5xl md:text-6xl lg:text-7xl font-bold mb-4 leading-tight ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}
          >
            볼링의 모든 것,
            <br />
            여기서 쉽고 간편하게
          </h1>
          <p
            className={`text-lg md:text-xl mt-4 ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            Bowlib와 함께하는 스마트한 볼링 관리
          </p>
        </div>

        {!isAuthenticated && (
          <div className="mt-8 pointer-events-auto">
            <button
              onClick={() => navigate('/login')}
              className="bg-slate-800 hover:bg-slate-700 text-white px-12 py-4 rounded-xl font-semibold text-lg shadow-lg transition-all duration-300"
              style={{
                boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
              }}
            >
              지금 시작하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BowlingHero;
