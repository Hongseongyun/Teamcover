import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './VerifyCode.css';

const VerifyCode = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { setUser, setAccessToken } = useAuth();

  useEffect(() => {
    // URL에서 사용자 정보 가져오기
    const params = new URLSearchParams(location.search);
    const email = params.get('email');
    const name = params.get('name');

    if (email && name) {
      setUserInfo({ email, name });
    } else {
      setError('사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
    }
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!code || code.length !== 6) {
      setError('6자리 인증 코드를 입력해주세요.');
      setLoading(false);
      return;
    }

    if (!userInfo || !userInfo.email) {
      setError('사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/verify-code', {
        email: userInfo.email,
        code: code,
      });

      if (response.data.success) {
        // 인증 성공 - 로그인 처리
        setUser(response.data.user);
        setAccessToken(response.data.access_token);
        localStorage.setItem('access_token', response.data.access_token);
        localStorage.setItem('user', JSON.stringify(response.data.user));

        // 홈으로 리디렉션
        navigate('/', { replace: true });
      } else {
        setError(response.data.message || '인증에 실패했습니다.');
      }
    } catch (error) {
      setError(
        error.response?.data?.message ||
          '인증 중 오류가 발생했습니다. 다시 시도해주세요.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, ''); // 숫자만 입력
    if (value.length <= 6) {
      setCode(value);
      setError('');
      setSuccessMessage('');
    }
  };

  const handleResendCode = async () => {
    if (!userInfo || !userInfo.email) {
      setError('사용자 정보를 찾을 수 없습니다.');
      return;
    }

    setResendLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await api.post('/auth/resend-verification-code', {
        email: userInfo.email,
      });

      if (response.data.success) {
        setSuccessMessage(
          '새로운 인증 코드를 발송했습니다. 이메일을 확인해주세요.'
        );
        setCode(''); // 입력된 코드 초기화
      } else {
        setError(response.data.message || '인증 코드 재발송에 실패했습니다.');
      }
    } catch (error) {
      setError(
        error.response?.data?.message ||
          '인증 코드 재발송 중 오류가 발생했습니다.'
      );
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="verify-code-container">
      <div className="verify-code-card">
        <div className="verify-code-header">
          <h1>🔐 인증 코드 입력</h1>
          {userInfo && (
            <div className="user-info">
              <p className="user-name">{userInfo.name}님</p>
              <p className="user-email">{userInfo.email}</p>
            </div>
          )}
        </div>

        <div className="verify-code-description">
          <p>
            📧 <strong>{userInfo?.email}</strong> 로<br />
            인증 코드를 발송했습니다.
          </p>
          <p>
            이메일에서 <strong>6자리 인증 코드</strong>를 확인하여 입력해주세요.
          </p>
          <p className="small-text">
            인증 코드는 24시간 동안 유효합니다.
            <br />
            이메일이 보이지 않으면 스팸 메일함을 확인하세요.
          </p>
        </div>

        {error && <div className="error-message">{error}</div>}
        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}

        <form onSubmit={handleSubmit} className="verify-code-form">
          <div className="form-group">
            <label htmlFor="code">인증 코드</label>
            <input
              type="text"
              id="code"
              name="code"
              value={code}
              onChange={handleCodeChange}
              placeholder="000000"
              maxLength={6}
              autoComplete="off"
              className="code-input"
              disabled={loading}
              autoFocus
            />
            <small className="input-hint">{code.length}/6 자리 입력됨</small>
          </div>

          <button
            type="submit"
            className="verify-button"
            disabled={loading || code.length !== 6}
          >
            {loading ? '인증 중...' : '인증하기'}
          </button>

          <button
            type="button"
            className="resend-button"
            onClick={handleResendCode}
            disabled={resendLoading || loading}
          >
            {resendLoading ? '재발송 중...' : '📧 인증 코드 다시 받기'}
          </button>
        </form>

        <div className="verify-code-footer">
          <p>
            이메일을 받지 못하셨나요?
            <br />
            스팸 메일함을 확인하거나 관리자에게 문의하세요.
          </p>
          <button
            type="button"
            className="back-button"
            onClick={() => navigate('/login')}
            disabled={loading}
          >
            로그인 페이지로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyCode;
