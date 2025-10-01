import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// 전역 변수로 처리 상태 관리 (컴포넌트 재렌더링과 무관)
let isProcessing = false;

const GoogleAuthCallback = () => {
  const navigate = useNavigate();
  const { setUser, setToken } = useAuth();
  const [status, setStatus] = useState('처리 중...');

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

        // URL에서 authorization code와 state 추출
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');

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
          `${
            process.env.REACT_APP_API_URL || 'https://api.hsyun.store'
          }/api/auth/google/callback`,
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
          const { user: userData, access_token } = data;

          // 사용자 정보와 토큰을 직접 설정
          setUser(userData);
          setToken(access_token);
          localStorage.setItem('token', access_token);

          console.log('User logged in successfully:', userData);
          setStatus('리디렉션 중...');

          // state에 저장된 원래 페이지로 리디렉션
          const redirectTo = state ? decodeURIComponent(state) : '/';
          console.log('Redirecting to:', redirectTo);
          navigate(redirectTo, { replace: true });
        } else {
          throw new Error(data.message || 'Google authentication failed');
        }
      } catch (error) {
        console.error('Google authentication error:', error);
        setStatus('오류 발생: ' + error.message);
        // 에러 페이지로 리디렉션
        setTimeout(() => {
          navigate('/login?error=' + encodeURIComponent(error.message), {
            replace: true,
          });
        }, 2000);
      }
    };

    handleGoogleCallback();
  }, [navigate, setUser, setToken]); // 의존성 배열에 필요한 값들 추가

  return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>{status}</p>
    </div>
  );
};

export default GoogleAuthCallback;
