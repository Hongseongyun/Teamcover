import React, { useState, useRef, useEffect, useCallback } from 'react';
import './BowlingGame.css';

const BowlingGame = () => {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  // 게임 상태
  const [position, setPosition] = useState(0); // -1 ~ 1 (좌우 위치)
  const [power, setPower] = useState(50); // 0 ~ 100
  const [effect, setEffect] = useState(0); // -1 ~ 1 (좌우 커브)
  const [isRolling, setIsRolling] = useState(false);
  const [gameState, setGameState] = useState('ready'); // ready, rolling, finished
  
  // 볼링 점수 상태
  const [currentFrame, setCurrentFrame] = useState(1);
  const [currentRoll, setCurrentRoll] = useState(1);
  const [scores, setScores] = useState([]);
  const [totalScore, setTotalScore] = useState(0);
  
  // 공 상태 (1인칭 시점에서의 3D 좌표)
  const [ball, setBall] = useState({
    lanePos: 0, // 레인상 위치 (0~1, 0이 시작, 1이 핀)
    laneX: 0, // 레인상 좌우 위치 (-1~1)
    vx: 0,
    vy: 0,
    rotation: 0,
    visible: false
  });
  
  // 핀 상태
  const [pins, setPins] = useState([]);
  
  // Canvas 크기
  const CANVAS_WIDTH = 1000;
  const CANVAS_HEIGHT = 700;
  
  // 핀 초기 위치 (1인칭 시점에서의 3D 위치)
  const initializePins = useCallback(() => {
    // 표준 볼링 핀 배치 (삼각형)
    const pinPositions = [
      { x: 0, y: 0, standing: true }, // 1번 (중앙)
      { x: -0.15, y: -0.1, standing: true }, // 2번
      { x: 0.15, y: -0.1, standing: true }, // 3번
      { x: -0.3, y: -0.2, standing: true }, // 4번
      { x: 0, y: -0.2, standing: true }, // 5번
      { x: 0.3, y: -0.2, standing: true }, // 6번
      { x: -0.45, y: -0.3, standing: true }, // 7번
      { x: -0.15, y: -0.3, standing: true }, // 8번
      { x: 0.15, y: -0.3, standing: true }, // 9번
      { x: 0.45, y: -0.3, standing: true }, // 10번
    ];
    setPins(pinPositions);
  }, []);
  
  useEffect(() => {
    initializePins();
  }, [initializePins]);
  
  // 3D 좌표를 2D 화면 좌표로 변환 (1인칭 시점)
  const project3D = (lanePos, laneX) => {
    // lanePos: 0(시작) ~ 1(핀)
    // laneX: -1(왼쪽) ~ 1(오른쪽)
    
    const viewDistance = 0.3; // 시점 거리
    const laneWidth = 0.4; // 레인 너비
    
    // 원근감 계산
    const scale = 1 / (1 + lanePos * 2);
    const y = CANVAS_HEIGHT - 100 - (lanePos * (CANVAS_HEIGHT - 200));
    const x = CANVAS_WIDTH / 2 + (laneX * laneWidth * CANVAS_WIDTH * scale);
    
    return { x, y, scale };
  };
  
  // 공 던지기
  const throwBall = () => {
    if (isRolling || gameState === 'rolling') return;
    
    setIsRolling(true);
    setGameState('rolling');
    
    // 공의 시작 위치
    const baseSpeed = (power / 100) * 0.02;
    const angle = effect * 0.3; // 이펙트에 따른 각도
    
    setBall({
      lanePos: 0,
      laneX: position,
      vx: Math.sin(angle) * baseSpeed * 0.5,
      vy: baseSpeed,
      rotation: 0,
      visible: true
    });
  };
  
  // calculateScore를 먼저 정의
  const calculateScore = useCallback((knockedPins) => {
    setScores(prevScores => {
      const newScores = [...prevScores];
      
      setCurrentRoll(prevRoll => {
        setCurrentFrame(prevFrame => {
          // 현재 프레임의 점수 업데이트
          if (prevRoll === 1) {
            if (knockedPins === 10) {
              // 스트라이크
              newScores.push({ frame: prevFrame, roll1: 'X', roll2: '', score: null });
              setCurrentRoll(1);
              return Math.min(prevFrame + 1, 10);
            } else {
              newScores.push({ frame: prevFrame, roll1: knockedPins, roll2: '', score: null });
              setCurrentRoll(2);
              return prevFrame;
            }
          } else {
            // 두 번째 롤
            const currentFrameScore = newScores[newScores.length - 1];
            const roll1Score = currentFrameScore.roll1 === 'X' ? 10 : currentFrameScore.roll1;
            
            if (roll1Score + knockedPins === 10) {
              // 스페어
              currentFrameScore.roll2 = '/';
            } else {
              currentFrameScore.roll2 = knockedPins;
            }
            
            // 점수 계산
            if (currentFrameScore.roll1 === 'X') {
              currentFrameScore.score = 10 + knockedPins;
            } else if (currentFrameScore.roll2 === '/') {
              currentFrameScore.score = 10;
            } else {
              currentFrameScore.score = roll1Score + knockedPins;
            }
            
            setCurrentRoll(1);
            return Math.min(prevFrame + 1, 10);
          }
        });
        
        return prevRoll;
      });
      
      // 총점 계산
      const total = newScores.reduce((sum, frame) => sum + (frame.score || 0), 0);
      setTotalScore(total);
      
      return newScores;
    });
  }, []);
  
  // 롤 종료
  const finishRoll = useCallback(() => {
    setIsRolling(false);
    setGameState('finished');
    
    // 현재 핀 상태 확인
    setPins(prevPins => {
      const standingPins = prevPins.filter(pin => pin.standing).length;
      const knockedPins = 10 - standingPins;
      
      // 점수 계산
      calculateScore(knockedPins);
      
      return prevPins;
    });
  }, [calculateScore]);
  
  // 물리 시뮬레이션
  const updatePhysics = useCallback(() => {
    if (!isRolling || gameState !== 'rolling') return;
    
    setBall(prev => {
      if (!prev.visible) return prev;
      
      let { lanePos, laneX, vx, vy, rotation } = prev;
      
      // 속도 적용
      lanePos += vy;
      laneX += vx;
      rotation += vx * 10;
      
      // 마찰 적용
      vx *= 0.995;
      vy *= 0.998;
      
      // 레인 경계 체크
      if (laneX < -1) laneX = -1;
      if (laneX > 1) laneX = 1;
      
      // 공이 핀 영역에 도달했는지 확인
      if (lanePos > 0.85) {
        // 핀과 충돌 체크
        setPins(prevPins => {
          const updatedPins = prevPins.map(pin => {
            if (!pin.standing) return pin;
            
            const dx = laneX - pin.x;
            const dy = (lanePos - 0.85) - pin.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 공과 핀의 충돌 감지
            if (distance < 0.2) {
              return {
                ...pin,
                standing: false
              };
            }
            
            return pin;
          });
          
          return updatedPins;
        });
      }
      
      // 공이 핀 영역을 지나갔는지 확인
      if (lanePos > 1.1 || (lanePos > 0.9 && Math.abs(vx) < 0.0001 && Math.abs(vy) < 0.0001)) {
        setTimeout(() => {
          finishRoll();
        }, 1000);
        return { ...prev, visible: false };
      }
      
      return { lanePos, laneX, vx, vy, rotation, visible: true };
    });
  }, [isRolling, gameState, finishRoll]);
  
  // 애니메이션 루프
  useEffect(() => {
    if (isRolling && gameState === 'rolling') {
      let lastTime = performance.now();
      
      const animate = (currentTime) => {
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        
        // 물리 업데이트는 약 60fps로 제한
        if (deltaTime >= 16) {
          updatePhysics();
        }
        
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      
      animationFrameRef.current = requestAnimationFrame(animate);
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [isRolling, gameState, updatePhysics]);
  
  // Canvas 그리기 (1인칭 시점)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // 배경 (볼링장 천장/벽)
    const bgGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bgGradient.addColorStop(0, '#2c3e50');
    bgGradient.addColorStop(1, '#34495e');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // 레인 그리기 (원근감)
    const laneStartY = CANVAS_HEIGHT - 150;
    const laneEndY = 100;
    const laneStartWidth = CANVAS_WIDTH * 0.6;
    const laneEndWidth = CANVAS_WIDTH * 0.3;
    
    // 레인 배경
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.moveTo((CANVAS_WIDTH - laneStartWidth) / 2, laneStartY);
    ctx.lineTo((CANVAS_WIDTH - laneEndWidth) / 2, laneEndY);
    ctx.lineTo((CANVAS_WIDTH + laneEndWidth) / 2, laneEndY);
    ctx.lineTo((CANVAS_WIDTH + laneStartWidth) / 2, laneStartY);
    ctx.closePath();
    ctx.fill();
    
    // 레인 줄무늬 (원근감)
    for (let i = 0; i < 5; i++) {
      const y = laneStartY - (i * (laneStartY - laneEndY) / 4);
      const width = laneStartWidth - (i * (laneStartWidth - laneEndWidth) / 4);
      const x1 = (CANVAS_WIDTH - width) / 2;
      const x2 = (CANVAS_WIDTH + width) / 2;
      
      ctx.strokeStyle = i % 2 === 0 ? '#654321' : '#A0522D';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
    }
    
    // 레인 중앙선
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, laneStartY);
    ctx.lineTo(CANVAS_WIDTH / 2, laneEndY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 레인 경계선
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo((CANVAS_WIDTH - laneStartWidth) / 2, laneStartY);
    ctx.lineTo((CANVAS_WIDTH - laneEndWidth) / 2, laneEndY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo((CANVAS_WIDTH + laneStartWidth) / 2, laneStartY);
    ctx.lineTo((CANVAS_WIDTH + laneEndWidth) / 2, laneEndY);
    ctx.stroke();
    
    // 핀 영역 배경
    const pinAreaY = laneEndY - 30;
    const pinAreaWidth = laneEndWidth * 1.2;
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    ctx.moveTo((CANVAS_WIDTH - pinAreaWidth) / 2, pinAreaY);
    ctx.lineTo((CANVAS_WIDTH - laneEndWidth) / 2, laneEndY);
    ctx.lineTo((CANVAS_WIDTH + laneEndWidth) / 2, laneEndY);
    ctx.lineTo((CANVAS_WIDTH + pinAreaWidth) / 2, pinAreaY);
    ctx.closePath();
    ctx.fill();
    
    // 핀 그리기 (1인칭 시점)
    pins.forEach((pin) => {
      if (pin.standing) {
        const pinScreen = project3D(0.95, pin.x);
        const pinSize = 8 * pinScreen.scale;
        
        // 핀 그림자
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(pinScreen.x + 2, pinScreen.y + 2, pinSize, pinSize * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 핀 본체
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(pinScreen.x, pinScreen.y, pinSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
    
    // 공 그리기
    if (ball.visible) {
      const ballScreen = project3D(ball.lanePos, ball.laneX);
      const ballSize = 20 * ballScreen.scale;
      
      // 공 그림자
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(ballScreen.x + 2, ballScreen.y + 2, ballSize, ballSize * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // 공 본체
      ctx.save();
      ctx.translate(ballScreen.x, ballScreen.y);
      ctx.rotate(ball.rotation);
      
      // 공 그라데이션
      const gradient = ctx.createRadialGradient(-ballSize * 0.3, -ballSize * 0.3, 0, 0, 0, ballSize);
      gradient.addColorStop(0, '#555');
      gradient.addColorStop(1, '#000');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, ballSize, 0, Math.PI * 2);
      ctx.fill();
      
      // 공 하이라이트
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(-ballSize * 0.3, -ballSize * 0.3, ballSize * 0.3, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    
    // 플레이어 캐릭터 (하단 중앙)
    if (gameState === 'ready' && !isRolling) {
      const playerY = CANVAS_HEIGHT - 100;
      const playerX = CANVAS_WIDTH / 2 + (position * 100);
      
      // 플레이어 몸통
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(playerX - 15, playerY - 40, 30, 40);
      
      // 플레이어 머리
      ctx.fillStyle = '#f39c12';
      ctx.beginPath();
      ctx.arc(playerX, playerY - 50, 15, 0, Math.PI * 2);
      ctx.fill();
      
      // 공 (플레이어가 들고 있음)
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(playerX + 20, playerY - 30, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
  }, [ball, pins, position, gameState, isRolling]);
  
  // 렌더링 루프 (애니메이션 중일 때 지속적으로 그리기)
  useEffect(() => {
    if (!isRolling || gameState !== 'rolling') return;
    
    const renderLoop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // 배경
      const bgGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      bgGradient.addColorStop(0, '#2c3e50');
      bgGradient.addColorStop(1, '#34495e');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // 레인 그리기
      const laneStartY = CANVAS_HEIGHT - 150;
      const laneEndY = 100;
      const laneStartWidth = CANVAS_WIDTH * 0.6;
      const laneEndWidth = CANVAS_WIDTH * 0.3;
      
      ctx.fillStyle = '#8B4513';
      ctx.beginPath();
      ctx.moveTo((CANVAS_WIDTH - laneStartWidth) / 2, laneStartY);
      ctx.lineTo((CANVAS_WIDTH - laneEndWidth) / 2, laneEndY);
      ctx.lineTo((CANVAS_WIDTH + laneEndWidth) / 2, laneEndY);
      ctx.lineTo((CANVAS_WIDTH + laneStartWidth) / 2, laneStartY);
      ctx.closePath();
      ctx.fill();
      
      // 레인 줄무늬
      for (let i = 0; i < 5; i++) {
        const y = laneStartY - (i * (laneStartY - laneEndY) / 4);
        const width = laneStartWidth - (i * (laneStartWidth - laneEndWidth) / 4);
        const x1 = (CANVAS_WIDTH - width) / 2;
        const x2 = (CANVAS_WIDTH + width) / 2;
        
        ctx.strokeStyle = i % 2 === 0 ? '#654321' : '#A0522D';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
      }
      
      // 레인 중앙선
      ctx.strokeStyle = '#654321';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH / 2, laneStartY);
      ctx.lineTo(CANVAS_WIDTH / 2, laneEndY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // 레인 경계선
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo((CANVAS_WIDTH - laneStartWidth) / 2, laneStartY);
      ctx.lineTo((CANVAS_WIDTH - laneEndWidth) / 2, laneEndY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo((CANVAS_WIDTH + laneStartWidth) / 2, laneStartY);
      ctx.lineTo((CANVAS_WIDTH + laneEndWidth) / 2, laneEndY);
      ctx.stroke();
      
      // 핀 영역 배경
      const pinAreaY = laneEndY - 30;
      const pinAreaWidth = laneEndWidth * 1.2;
      ctx.fillStyle = '#27ae60';
      ctx.beginPath();
      ctx.moveTo((CANVAS_WIDTH - pinAreaWidth) / 2, pinAreaY);
      ctx.lineTo((CANVAS_WIDTH - laneEndWidth) / 2, laneEndY);
      ctx.lineTo((CANVAS_WIDTH + laneEndWidth) / 2, laneEndY);
      ctx.lineTo((CANVAS_WIDTH + pinAreaWidth) / 2, pinAreaY);
      ctx.closePath();
      ctx.fill();
      
      // 핀 그리기
      pins.forEach((pin) => {
        if (pin.standing) {
          const pinScreen = project3D(0.95, pin.x);
          const pinSize = 8 * pinScreen.scale;
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.beginPath();
          ctx.ellipse(pinScreen.x + 2, pinScreen.y + 2, pinSize, pinSize * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(pinScreen.x, pinScreen.y, pinSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
      
      // 공 그리기
      if (ball.visible) {
        const ballScreen = project3D(ball.lanePos, ball.laneX);
        const ballSize = 20 * ballScreen.scale;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(ballScreen.x + 2, ballScreen.y + 2, ballSize, ballSize * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.save();
        ctx.translate(ballScreen.x, ballScreen.y);
        ctx.rotate(ball.rotation);
        
        const gradient = ctx.createRadialGradient(-ballSize * 0.3, -ballSize * 0.3, 0, 0, 0, ballSize);
        gradient.addColorStop(0, '#555');
        gradient.addColorStop(1, '#000');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, ballSize, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(-ballSize * 0.3, -ballSize * 0.3, ballSize * 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
      
      if (isRolling && gameState === 'rolling') {
        requestAnimationFrame(renderLoop);
      }
    };
    
    const frameId = requestAnimationFrame(renderLoop);
    
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [isRolling, gameState, ball, pins]);
  
  // 다음 프레임 준비
  const resetForNextFrame = () => {
    setGameState('ready');
    setIsRolling(false);
    setBall({ lanePos: 0, laneX: 0, vx: 0, vy: 0, rotation: 0, visible: false });
    initializePins();
    setPower(50);
    setEffect(0);
    setPosition(0);
  };
  
  // 게임 리셋
  const resetGame = () => {
    setCurrentFrame(1);
    setCurrentRoll(1);
    setScores([]);
    setTotalScore(0);
    resetForNextFrame();
  };
  
  return (
    <div className="bowling-game-container">
      {/* 점수판 (상단) */}
      <div className="score-board-top">
        <div className="frame-scores-top">
          {Array.from({ length: 10 }, (_, i) => {
            const frameNum = i + 1;
            const frameScore = scores.find(s => s.frame === frameNum);
            return (
              <div key={frameNum} className={`frame-box ${currentFrame === frameNum ? 'active' : ''}`}>
                <div className="frame-num">{frameNum}</div>
                <div className="frame-rolls-top">
                  <span className="roll1">{frameScore?.roll1 !== undefined ? frameScore.roll1 : '0'}</span>
                  <span className="roll2">{frameScore?.roll2 !== undefined ? frameScore.roll2 : '0'}</span>
                </div>
                <div className="frame-score-top">{frameScore?.score !== undefined ? frameScore.score : '0'}</div>
              </div>
            );
          })}
          <div className="total-box">
            <div className="total-label">TOTAL</div>
            <div className="total-value">{totalScore}</div>
          </div>
        </div>
      </div>
      
      <div className="bowling-game-content">
        {/* 왼쪽 POWER 미터 */}
        <div className="power-meter">
          <div className="meter-label">POWER</div>
          <div className="meter-bar-container">
            <div 
              className="meter-bar power-bar"
              style={{ height: `${power}%` }}
            />
          </div>
        </div>
        
        {/* 중앙 게임 화면 */}
        <div className="game-area">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="bowling-canvas"
          />
          
          {/* 위치 조절 컨트롤 */}
          <div className="position-control-overlay">
            <button
              className="position-btn left"
              onClick={() => setPosition(Math.max(-1, position - 0.1))}
              disabled={isRolling || gameState === 'rolling'}
            >
              ←
            </button>
            <div className="position-indicator-overlay">
              <div
                className="position-marker-overlay"
                style={{ left: `${((position + 1) / 2) * 100}%` }}
              />
            </div>
            <button
              className="position-btn right"
              onClick={() => setPosition(Math.min(1, position + 0.1))}
              disabled={isRolling || gameState === 'rolling'}
            >
              →
            </button>
          </div>
          
          {/* 액션 버튼 */}
          <div className="action-buttons">
            <button
              className="throw-btn"
              onClick={throwBall}
              disabled={isRolling || gameState === 'rolling'}
            >
              공 던지기
            </button>
            {gameState === 'finished' && (
              <button className="next-btn" onClick={resetForNextFrame}>
                다음 프레임
              </button>
            )}
            <button className="reset-btn" onClick={resetGame}>
              게임 리셋
            </button>
          </div>
        </div>
        
        {/* 오른쪽 EFFECT 미터 */}
        <div className="effect-meter">
          <div className="meter-label">EFFECT</div>
          <div className="meter-bar-container">
            <div 
              className="meter-bar effect-bar"
              style={{ 
                height: `${Math.abs(effect) * 100}%`,
                bottom: effect < 0 ? '0' : 'auto',
                top: effect >= 0 ? '0' : 'auto'
              }}
            />
            {effect !== 0 && (
              <div className="effect-arrow" style={{ 
                bottom: effect < 0 ? '10px' : 'auto',
                top: effect >= 0 ? '10px' : 'auto'
              }}>
                {effect > 0 ? '→' : '←'}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* POWER/EFFECT 조절 슬라이더 (하단) */}
      <div className="control-sliders">
        <div className="slider-group">
          <label>POWER</label>
          <input
            type="range"
            min="0"
            max="100"
            value={power}
            onChange={(e) => setPower(parseInt(e.target.value))}
            disabled={isRolling || gameState === 'rolling'}
            className="power-slider"
          />
          <span className="slider-value">{power}%</span>
        </div>
        <div className="slider-group">
          <label>EFFECT</label>
          <input
            type="range"
            min="-100"
            max="100"
            value={effect * 100}
            onChange={(e) => setEffect(parseInt(e.target.value) / 100)}
            disabled={isRolling || gameState === 'rolling'}
            className="effect-slider"
          />
          <span className="slider-value">
            {effect > 0 ? `→ ${Math.abs(effect * 100).toFixed(0)}%` : 
             effect < 0 ? `← ${Math.abs(effect * 100).toFixed(0)}%` : 
             '0%'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BowlingGame;
