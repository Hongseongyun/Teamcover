import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import './EmailVerification.css';

const EmailVerification = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('이메일 인증을 처리하는 중입니다...');
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      verifyEmail(token);
    }
  }, [searchParams]);

  const verifyEmail = async (token) => {
    try {
      setLoading(true);
      const response = await authAPI.verifyEmail({ token });

      if (response.data.success) {
        setMessage(
          response.data.message ||
            '🎉 이메일 인증이 완료되었습니다! 3초 후 로그인 페이지로 이동합니다.'
        );
        setSuccess(true);
        // 회원가입 탭에 인증 완료를 알리기 위한 플래그 저장
        try {
          localStorage.setItem('emailVerified', '1');
        } catch (e) {}
        // 3초 후 로그인 페이지로 이동
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setMessage(response.data.message);
        setSuccess(false);
      }
    } catch (error) {
      setMessage('이메일 인증 중 오류가 발생했습니다.');
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!email.trim()) {
      setMessage('이메일을 입력해주세요.');
      return;
    }

    try {
      setResendLoading(true);
      const response = await authAPI.resendVerification({ email });

      if (response.data.success) {
        setMessage('인증 이메일이 재발송되었습니다.');
        setSuccess(true);
      } else {
        setMessage(response.data.message);
        setSuccess(false);
      }
    } catch (error) {
      setMessage('이메일 재발송 중 오류가 발생했습니다.');
      setSuccess(false);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="email-verification-container">
      <div className="verification-card">
        <div className="verification-header">
          <h1>🎳 Teamcover</h1>
          <h2>이메일 인증</h2>
        </div>

        {loading ? (
          <div className="loading-section">
            <div className="loading-spinner"></div>
            <p>이메일 인증 중...</p>
          </div>
        ) : (
          <div className="verification-content">
            {success ? (
              <div className="success-section">
                <div className="success-icon">✅</div>
                <p className="success-message">{message}</p>
                <p className="redirect-message">
                  잠시 후 로그인 페이지로 이동합니다...
                </p>
              </div>
            ) : (
              <div className="error-section">
                <div className="error-icon">❌</div>
                <p className="error-message">{message}</p>

                <div className="resend-section">
                  <h3>인증 이메일을 받지 못하셨나요?</h3>
                  <p>이메일 주소를 입력하여 인증 이메일을 재발송해주세요.</p>

                  <div className="resend-form">
                    <input
                      type="email"
                      placeholder="이메일 주소를 입력하세요"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="email-input"
                    />
                    <button
                      onClick={handleResendEmail}
                      disabled={resendLoading}
                      className="resend-button"
                    >
                      {resendLoading ? '발송 중...' : '인증 이메일 재발송'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="verification-footer">
          <button onClick={() => navigate('/login')} className="back-to-login">
            로그인 페이지로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;
