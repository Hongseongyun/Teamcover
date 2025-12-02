import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

// 충돌 감지 함수 (두 이미지가 겹치는지 확인) - 단순화된 버전
const checkCollision = (pos1, size1, pos2, size2) => {
  // 픽셀 단위로 변환 (화면 크기 1920x1080 기준)
  const screenWidth = 1920;
  const screenHeight = 1080;

  // 첫 번째 이미지의 중심점과 크기 계산
  let x1, y1;
  if (pos1.left !== undefined) {
    x1 = (parseFloat(pos1.left) / 100) * screenWidth;
  } else if (pos1.right !== undefined) {
    x1 = screenWidth - (parseFloat(pos1.right) / 100) * screenWidth;
  } else {
    x1 = screenWidth / 2;
  }

  if (pos1.top !== undefined) {
    y1 = (parseFloat(pos1.top) / 100) * screenHeight;
  } else if (pos1.bottom !== undefined) {
    y1 = screenHeight - (parseFloat(pos1.bottom) / 100) * screenHeight;
  } else {
    y1 = screenHeight / 2;
  }

  const w1 = parseFloat(size1.width);
  const h1 = parseFloat(size1.height) || w1 * 1.5; // 높이를 더 크게 추정

  // 두 번째 이미지의 중심점과 크기 계산
  let x2, y2;
  if (pos2.left !== undefined) {
    x2 = (parseFloat(pos2.left) / 100) * screenWidth;
  } else if (pos2.right !== undefined) {
    x2 = screenWidth - (parseFloat(pos2.right) / 100) * screenWidth;
  } else {
    x2 = screenWidth / 2;
  }

  if (pos2.top !== undefined) {
    y2 = (parseFloat(pos2.top) / 100) * screenHeight;
  } else if (pos2.bottom !== undefined) {
    y2 = screenHeight - (parseFloat(pos2.bottom) / 100) * screenHeight;
  } else {
    y2 = screenHeight / 2;
  }

  const w2 = parseFloat(size2.width);
  const h2 = parseFloat(size2.height) || w2 * 1.5;

  // 충분한 여유 공간 (최소 200px, 이미지 크기의 80%)
  const minPadding = 200;
  const padding1 = Math.max(w1, h1) * 0.8 + minPadding;
  const padding2 = Math.max(w2, h2) * 0.8 + minPadding;

  // 충돌 감지: 두 이미지의 경계 박스가 겹치는지 확인
  const left1 = x1 - padding1;
  const right1 = x1 + w1 + padding1;
  const top1 = y1 - padding1;
  const bottom1 = y1 + h1 + padding1;

  const left2 = x2 - padding2;
  const right2 = x2 + w2 + padding2;
  const top2 = y2 - padding2;
  const bottom2 = y2 + h2 + padding2;

  // 겹침 확인
  return !(
    right1 < left2 ||
    left1 > right2 ||
    bottom1 < top2 ||
    top1 > bottom2
  );
};

// 랜덤 위치 생성 함수 (기존 배치된 이미지들과 겹치지 않는 위치 찾기) - 개선된 버전
const generateRandomPosition = (existingPositions, itemSize) => {
  const maxAttempts = 200; // 최대 시도 횟수 증가
  let attempts = 0;

  // 그리드 기반 배치를 위한 영역 분할
  const gridCols = 8; // 가로 8개 영역
  const gridRows = 6; // 세로 6개 영역
  const usedGrids = new Set();

  // 기존 위치들을 그리드로 변환하여 기록
  existingPositions.forEach((existing) => {
    const pos = existing.position;
    let x, y;

    if (pos.left !== undefined) {
      x = Math.floor((parseFloat(pos.left) / 100) * gridCols);
    } else if (pos.right !== undefined) {
      x = Math.floor((1 - parseFloat(pos.right) / 100) * gridCols);
    } else {
      x = Math.floor(gridCols / 2);
    }

    if (pos.top !== undefined) {
      y = Math.floor((parseFloat(pos.top) / 100) * gridRows);
    } else if (pos.bottom !== undefined) {
      y = Math.floor((1 - parseFloat(pos.bottom) / 100) * gridRows);
    } else {
      y = Math.floor(gridRows / 2);
    }

    // 이미지 크기에 따라 여러 그리드 셀 차지
    const size = parseFloat(existing.size.width);
    const cellSpan = Math.ceil(size / (1920 / gridCols)) + 1;
    for (let dx = -cellSpan; dx <= cellSpan; dx++) {
      for (let dy = -cellSpan; dy <= cellSpan; dy++) {
        const gx = Math.max(0, Math.min(gridCols - 1, x + dx));
        const gy = Math.max(0, Math.min(gridRows - 1, y + dy));
        usedGrids.add(`${gx},${gy}`);
      }
    }
  });

  while (attempts < maxAttempts) {
    const useTop = Math.random() > 0.5;
    const useLeft = Math.random() > 0.5;

    let newPosition;
    let gridX, gridY;

    if (useTop) {
      const top = Math.random() * 70 + 15; // 15% ~ 85%
      const side = Math.random() * 20 + 5; // 5% ~ 25%
      newPosition = {
        top: `${top}%`,
        [useLeft ? 'left' : 'right']: `${side}%`,
      };
      gridY = Math.floor((top / 100) * gridRows);
      gridX = useLeft
        ? Math.floor((side / 100) * gridCols)
        : Math.floor((1 - side / 100) * gridCols);
    } else {
      const bottom = Math.random() * 70 + 15; // 15% ~ 85%
      const side = Math.random() * 20 + 5; // 5% ~ 25%
      newPosition = {
        bottom: `${bottom}%`,
        [useLeft ? 'left' : 'right']: `${side}%`,
      };
      gridY = Math.floor((1 - bottom / 100) * gridRows);
      gridX = useLeft
        ? Math.floor((side / 100) * gridCols)
        : Math.floor((1 - side / 100) * gridCols);
    }

    // 그리드 기반 충돌 확인
    const size = parseFloat(itemSize.width);
    const cellSpan = Math.ceil(size / (1920 / gridCols)) + 1;
    let gridCollision = false;

    for (let dx = -cellSpan; dx <= cellSpan; dx++) {
      for (let dy = -cellSpan; dy <= cellSpan; dy++) {
        const gx = Math.max(0, Math.min(gridCols - 1, gridX + dx));
        const gy = Math.max(0, Math.min(gridRows - 1, gridY + dy));
        if (usedGrids.has(`${gx},${gy}`)) {
          gridCollision = true;
          break;
        }
      }
      if (gridCollision) break;
    }

    // 그리드 충돌이 없으면 정밀 충돌 검사
    if (!gridCollision) {
      let hasCollision = false;
      for (const existing of existingPositions) {
        if (
          checkCollision(
            newPosition,
            itemSize,
            existing.position,
            existing.size
          )
        ) {
          hasCollision = true;
          break;
        }
      }

      // 충돌이 없으면 이 위치 반환하고 그리드에 기록
      if (!hasCollision) {
        for (let dx = -cellSpan; dx <= cellSpan; dx++) {
          for (let dy = -cellSpan; dy <= cellSpan; dy++) {
            const gx = Math.max(0, Math.min(gridCols - 1, gridX + dx));
            const gy = Math.max(0, Math.min(gridRows - 1, gridY + dy));
            usedGrids.add(`${gx},${gy}`);
          }
        }
        return newPosition;
      }
    }

    attempts++;
  }

  // 최대 시도 횟수 초과 시 랜덤 위치 반환 (충돌 가능하지만 무한 루프 방지)
  const useTop = Math.random() > 0.5;
  const useLeft = Math.random() > 0.5;
  if (useTop) {
    return {
      top: `${Math.random() * 70 + 15}%`,
      [useLeft ? 'left' : 'right']: `${Math.random() * 20 + 5}%`,
    };
  } else {
    return {
      bottom: `${Math.random() * 70 + 15}%`,
      [useLeft ? 'left' : 'right']: `${Math.random() * 20 + 5}%`,
    };
  }
};

// 볼링 아이템 기본 데이터
const bowlingItemsData = [
  {
    id: 1,
    type: 'pin', // 볼링핀
    image: '/bowling-pin.png', // 이미지 경로 (public 폴더 기준)
    delay: 0,
    size: { width: '120px', height: 'auto' },
  },
  {
    id: 2,
    type: 'ball', // 볼링공
    image: '/bowling-ball.png',
    delay: 0.3,
    size: { width: '100px', height: 'auto' },
  },
  {
    id: 3,
    type: 'pin',
    image: '/bowling-pin.png',
    delay: 0.6,
    size: { width: '110px', height: 'auto' },
  },
  {
    id: 4,
    type: 'wrist-support',
    image: '/wrist-support.png',
    delay: 0.2,
    size: { width: '100px', height: 'auto' },
  },
  {
    id: 5,
    type: 'ball',
    image: '/bowling-ball-2.png',
    delay: 0.5,
    size: { width: '90px', height: 'auto' },
  },
  {
    id: 6,
    type: 'bowling-shoes',
    image: '/bowling-shoes.png',
    delay: 0.4,
    size: { width: '115px', height: 'auto' },
  },
  {
    id: 7,
    type: 'ball',
    image: '/bowling-ball-3.png',
    delay: 0.7,
    size: { width: '105px', height: 'auto' },
  },
  {
    id: 8,
    type: 'bowling-bag',
    image: '/bowling-bag.png',
    delay: 0.1,
    size: { width: '125px', height: 'auto' },
  },
];

const BowlingHero = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { theme } = useTheme();

  // 마우스 위치 추적 (사용하지 않지만 useEffect에서 업데이트됨)
  const [, setMousePosition] = useState({ x: 0, y: 0 });

  // Floating 애니메이션을 위한 시간 상태
  const [animationTime, setAnimationTime] = useState(0);

  // 각 이미지의 밀린 위치 저장 (누적)
  const [itemOffsets, setItemOffsets] = useState({});

  // 랜덤 위치를 가진 아이템 배열 생성 (겹치지 않도록)
  const [bowlingItems, setBowlingItems] = useState(() => {
    const items = [];
    const existingPositions = [];

    bowlingItemsData.forEach((item) => {
      const position = generateRandomPosition(existingPositions, item.size);
      const newItem = {
        ...item,
        position,
      };
      items.push(newItem);
      existingPositions.push({ position, size: item.size });
    });

    return items;
  });

  // 컴포넌트 마운트 시 랜덤 위치 생성 (겹치지 않도록)
  useEffect(() => {
    const items = [];
    const existingPositions = [];

    bowlingItemsData.forEach((item) => {
      const position = generateRandomPosition(existingPositions, item.size);
      const newItem = {
        ...item,
        position,
      };
      items.push(newItem);
      existingPositions.push({ position, size: item.size });
    });

    setBowlingItems(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 빈 배열로 마운트 시에만 실행 (bowlingItemsData는 상수이므로 의존성 불필요)

  // 마우스 위치 추적 및 오프셋 업데이트 (throttle 적용)
  useEffect(() => {
    let throttleTimeout;
    const throttleDelay = 16; // ~60fps

    const handleMouseMove = (e) => {
      if (throttleTimeout) return;

      throttleTimeout = setTimeout(() => {
        const newMousePos = { x: e.clientX, y: e.clientY };
        setMousePosition(newMousePos);

        // 모든 아이템의 오프셋 업데이트
        setItemOffsets((prev) => {
          const newOffsets = { ...prev };
          const screenWidth = window.innerWidth || 1920;
          const screenHeight = window.innerHeight || 1080;

          bowlingItems.forEach((item) => {
            // 이미지 중심점 계산
            let baseX, baseY;
            if (item.position.left !== undefined) {
              baseX = (parseFloat(item.position.left) / 100) * screenWidth;
            } else if (item.position.right !== undefined) {
              baseX =
                screenWidth -
                (parseFloat(item.position.right) / 100) * screenWidth;
            } else {
              baseX = screenWidth / 2;
            }

            if (item.position.top !== undefined) {
              baseY = (parseFloat(item.position.top) / 100) * screenHeight;
            } else if (item.position.bottom !== undefined) {
              baseY =
                screenHeight -
                (parseFloat(item.position.bottom) / 100) * screenHeight;
            } else {
              baseY = screenHeight / 2;
            }

            const imgWidth = parseFloat(item.size.width);
            const imgHeight = parseFloat(item.size.height) || imgWidth * 1.5;

            // 현재 누적 오프셋 고려한 실제 위치
            const currentOffset = prev[item.id] || { x: 0, y: 0 };
            const x = baseX + currentOffset.x + imgWidth / 2;
            const y = baseY + currentOffset.y + imgHeight / 2;

            // 마우스와의 거리 계산
            const dx = newMousePos.x - x;
            const dy = newMousePos.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // 같은 극끼리 밀어내는 효과 (N-N, S-S 반발력)
            const maxDistance = 350; // 영향 범위
            const minDistance = 50; // 최소 거리 (이 거리 이하에서는 최대 힘)
            const maxPush = 200; // 최대 밀림 거리 (더 강하게)

            let pushFactor = 0;
            if (distance < maxDistance && distance > 0) {
              if (distance < minDistance) {
                // 매우 가까우면 최대 힘으로 밀어냄 (같은 극처럼 강한 반발)
                pushFactor = 1.0;
              } else {
                // 거리에 따라 반발력 감소 (역제곱 법칙)
                const normalizedDistance =
                  (distance - minDistance) / (maxDistance - minDistance);
                // 거리가 멀어질수록 빠르게 약해짐 (같은 극 효과)
                pushFactor = Math.pow(1 - normalizedDistance, 3.0);
              }
            }

            // 밀어내는 방향: 마우스에서 이미지 중심으로의 벡터의 반대 방향
            // 같은 극끼리 밀어내는 것처럼 마우스에서 멀어지는 방향
            const currentPushX =
              distance > 0 ? (dx / distance) * maxPush * pushFactor : 0;
            const currentPushY =
              distance > 0 ? (dy / distance) * maxPush * pushFactor : 0;

            // 오프셋 누적 (같은 극 효과처럼 즉각적이고 강하게 반응)
            const accumulationRate = 0.25; // 누적 비율 증가 (더 빠르고 강한 반응)
            const newX =
              (prev[item.id]?.x || 0) + currentPushX * accumulationRate;
            const newY =
              (prev[item.id]?.y || 0) + currentPushY * accumulationRate;

            // 화면 경계 감지 및 튕김 효과
            const margin = 50; // 경계 여유 공간
            const bounceStrength = 0.3; // 튕김 강도

            let finalX = newX;
            let finalY = newY;

            // 왼쪽 경계
            if (baseX + newX < margin) {
              finalX = newX + (margin - (baseX + newX)) * bounceStrength;
            }
            // 오른쪽 경계
            if (baseX + newX + imgWidth > screenWidth - margin) {
              finalX =
                newX -
                (baseX + newX + imgWidth - (screenWidth - margin)) *
                  bounceStrength;
            }
            // 위쪽 경계
            if (baseY + newY < margin) {
              finalY = newY + (margin - (baseY + newY)) * bounceStrength;
            }
            // 아래쪽 경계
            if (baseY + newY + imgHeight > screenHeight - margin) {
              finalY =
                newY -
                (baseY + newY + imgHeight - (screenHeight - margin)) *
                  bounceStrength;
            }

            newOffsets[item.id] = {
              x: finalX,
              y: finalY,
            };
          });

          return newOffsets;
        });

        throttleTimeout = null;
      }, throttleDelay);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [bowlingItems]);

  // Floating 애니메이션을 위한 시간 업데이트
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationTime(Date.now());
    }, 50); // 20fps로 업데이트 (부드러운 애니메이션)

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`relative w-full min-h-screen overflow-hidden ${
        theme === 'dark'
          ? 'bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900'
          : 'bg-gradient-to-b from-blue-50 via-white to-blue-50'
      }`}
    >
      {/* 배경 그라데이션 레이어 */}
      <div
        className={`absolute inset-0 ${
          theme === 'dark'
            ? 'bg-gradient-to-b from-slate-900/90 via-slate-800/50 to-slate-900/90'
            : 'bg-gradient-to-b from-slate-50 via-blue-50/30 to-white'
        }`}
      />

      {/* 볼링 아이템들 - 자연스러운 산개 배치 (이미지 사용) */}
      {bowlingItems.map((item, index) => {
        // 누적된 오프셋 가져오기
        const savedOffset = itemOffsets[item.id] || { x: 0, y: 0 };

        // Floating 애니메이션을 위한 오프셋 (시간 기반, 부드러운 움직임)
        const floatingOffset =
          Math.sin((animationTime / 1000) * 0.5 + item.delay * 2) * 15;

        // 최종 위치 = 저장된 누적 위치 + floating 효과
        const finalPushX = savedOffset.x;
        const finalPushY = savedOffset.y + floatingOffset;

        return (
          <motion.div
            key={item.id}
            className="absolute"
            style={{
              ...item.position,
              ...item.size,
              filter:
                'drop-shadow(0 8px 32px rgba(0, 0, 0, 0.1)) drop-shadow(0 2px 8px rgba(0, 0, 0, 0.06))',
              zIndex: 1,
            }}
            animate={{
              x: finalPushX,
              y: finalPushY,
              transition: {
                x: {
                  type: 'spring',
                  stiffness: 50,
                  damping: 25,
                  mass: 1.2,
                },
                y: {
                  type: 'spring',
                  stiffness: 50,
                  damping: 25,
                  mass: 1.2,
                },
              },
            }}
            // Floating 애니메이션을 별도로 적용 (마우스 밀림과 독립적)
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{
              delay: item.delay,
              duration: 0.6,
              ease: 'easeOut',
            }}
          >
            <img
              src={item.image}
              alt={item.type === 'pin' ? '볼링핀' : '볼링공'}
              className="w-full h-auto object-contain"
              style={{
                width: item.size.width,
                height: item.size.height,
                display: 'block',
              }}
              onError={(e) => {
                console.error('이미지 로드 실패:', item.image, e);
              }}
              onLoad={() => {
                console.log('이미지 로드 성공:', item.image);
              }}
            />
          </motion.div>
        );
      })}

      {/* 메인 콘텐츠 섹션 - 중앙 정렬 */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-20">
        {/* 메인 카피 */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
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
            팀 커버와 함께하는 스마트한 볼링 관리
          </p>
        </motion.div>

        {/* 지금 시작하기 버튼 - 로그인하지 않은 경우에만 표시 */}
        {!isAuthenticated && (
          <motion.div
            className="mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
          >
            <motion.button
              onClick={() => navigate('/login')}
              className="bg-slate-800 hover:bg-slate-700 text-white px-12 py-4 rounded-xl font-semibold text-lg shadow-lg transition-all duration-300"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.98 }}
              style={{
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
              }}
            >
              지금 시작하기
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default BowlingHero;
