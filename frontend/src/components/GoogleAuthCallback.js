import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import '../pages/Login.css';

// 전역 변수로 처리 상태 관리 (컴포넌트 재렌더링과 무관)
let isProcessing = false;

const GoogleAuthCallback = () => {
  const navigate = useNavigate();
  const { setUser, setToken } = useAuth();
  const [status, setStatus] = useState('처리 중...');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingData, setPendingData] = useState(null);

  useEffect(() => {
    const handleGoogleCallback = async () => {
      // 이미 처리 중이면 무시
      if (isProcessing) {
        console.log('Already processing, skipping...');
        return;
      }

      isProcessing = true;
      setStatus('Google 로그인 처리 중...');

      try {
        console.log('Starting Google callback processing...');

        // URL에서 authorization code와 state 추출 (안전한 처리)
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');

        console.log('URL params - code:', code ? 'present' : 'missing');
        console.log(
          'URL params - state:',
          state ? state.substring(0, 20) + '...' : 'missing'
        );

        if (!code) {
          throw new Error('Authorization code not found');
        }

        console.log('Processing code:', code.substring(0, 10) + '...');
        setStatus('토큰 교환 중...');

        // 현재 origin 가져오기
        const currentOrigin = window.location.origin;
        console.log('Current origin:', currentOrigin);

        // 백엔드로 코드를 전송하여 토큰 교환 (origin도 함께 전송)
        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/api/auth/google/callback`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code,
              origin: currentOrigin, // origin 정보 추가
            }),
          }
        );

        const data = await response.json();
        console.log('Backend response:', data);

        if (data.success) {
          setStatus('로그인 처리 중...');
          // JWT 토큰을 직접 사용하여 로그인 처리
          console.log('Setting JWT token and user data directly');
          const { user: userData, access_token, has_active_session } = data;

          // 사용자 정보와 토큰을 직접 설정
          setUser(userData);
          setToken(access_token);
          localStorage.setItem('token', access_token);

          console.log('User logged in successfully:', userData);
          setStatus('리디렉션 중...');

          // 다른 기기에서 로그인되어 있으면 로그인 페이지로 리디렉션하여 모달 표시
          if (has_active_session) {
            // state에 저장된 원래 페이지 정보를 함께 전달
            let redirectTo = '/';
            if (state) {
              try {
                redirectTo = decodeURIComponent(state);
              } catch (error) {
                console.warn('Failed to decode state, using default:', error);
                redirectTo = '/';
              }
            }
            // 로그인 페이지로 이동하되, 원래 가려던 페이지 정보를 전달
            navigate(
              `/login?from=${encodeURIComponent(
                redirectTo
              )}&has_active_session=true`,
              { replace: true }
            );
          } else {
            // state에 저장된 원래 페이지로 리디렉션 (안전한 디코딩)
            let redirectTo = '/';
            if (state) {
              try {
                redirectTo = decodeURIComponent(state);
              } catch (error) {
                console.warn('Failed to decode state, using default:', error);
                redirectTo = '/';
              }
            }
            console.log('Redirecting to:', redirectTo);
            navigate(redirectTo, { replace: true });
          }
        } else {
          throw new Error(data.message || 'Google authentication failed');
        }
      } catch (error) {
        console.error('Google authentication error:', error);
        setStatus('오류 발생: ' + error.message);
        // 에러 페이지로 리디렉션 (안전한 인코딩)
        setTimeout(() => {
          try {
            const errorMessage = error.message || 'Unknown error';
            navigate('/login?error=' + encodeURIComponent(errorMessage), {
              replace: true,
            });
          } catch (encodeError) {
            console.error('Failed to encode error message:', encodeError);
            navigate('/login?error=Authentication failed', {
              replace: true,
            });
          }
        }, 2000);
      }
    };

    handleGoogleCallback();
  }, [navigate, setUser, setToken]); // 의존성 배열에 필요한 값들 추가

  return (
    <>
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>{status}</p>
      </div>

      {/* 구글 로그인 확인 모달 */}
      {showConfirmModal && pendingData && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowConfirmModal(false);
            navigate('/login', { replace: true });
          }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="12" cy="12" r="10" fill="#fff3cd" />
                <path
                  d="M12 8v4M12 16h.01"
                  stroke="#ff9800"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2>다른 기기에서 접속 중</h2>
            <div className="modal-message">
              <p className="modal-message-main">
                해당 계정이{' '}
                <strong>다른 기기에서 이미 로그인되어 있습니다.</strong>
              </p>
              <p className="modal-message-sub">
                이 기기에서 로그인하면{' '}
                <strong>다른 기기에서 자동으로 로그아웃</strong>됩니다.
                <br />
                계속하시겠습니까?
              </p>
            </div>
            <div className="modal-buttons">
              <button
                className="btn-primary"
                onClick={() => {
                  setUser(pendingData.userData);
                  setToken(pendingData.access_token);
                  localStorage.setItem('token', pendingData.access_token);
                  setShowConfirmModal(false);
                  navigate(pendingData.redirectTo, { replace: true });
                }}
              >
                로그인하기
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowConfirmModal(false);
                  navigate('/login', { replace: true });
                }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GoogleAuthCallback;
