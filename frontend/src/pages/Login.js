import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'user',
  });
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }

    // URL 파라미터에서 에러 메시지 확인
    const urlParams = new URLSearchParams(window.location.search);
    const errorMessage = urlParams.get('error');
    if (errorMessage) {
      setError(decodeURIComponent(errorMessage));
    }
  }, [isAuthenticated, navigate, from]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let result;
      if (isLogin) {
        result = await login(formData.email, formData.password);
      } else {
        result = await register(
          formData.email,
          formData.name,
          formData.password,
          formData.role
        );
        if (result.success) {
          // 회원가입 성공 시 자동 로그인
          result = await login(formData.email, formData.password);
        }
      }

      if (result.success) {
        navigate(from, { replace: true });
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      // Google OAuth URL 생성
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${
        process.env.REACT_APP_GOOGLE_CLIENT_ID || 'your-google-client-id'
      }&redirect_uri=${encodeURIComponent(
        `${window.location.origin}/google-callback`
      )}&response_type=code&scope=openid%20email%20profile&state=${encodeURIComponent(
        from
      )}`;

      // 현재 창에서 Google OAuth 페이지로 리디렉션
      window.location.href = googleAuthUrl;
    } catch (error) {
      setError('구글 로그인에 실패했습니다.');
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Teamcover</h1>
          <p>볼링 팀 관리 시스템</p>
        </div>

        <div className="login-tabs">
          <button
            className={`tab-button ${isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(true)}
          >
            로그인
          </button>
          <button
            className={`tab-button ${!isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(false)}
          >
            회원가입
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="name">이름</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required={!isLogin}
                placeholder="이름을 입력하세요"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">이메일</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              placeholder="이메일을 입력하세요"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">비밀번호</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              placeholder="비밀번호를 입력하세요"
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="role">역할</label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleInputChange}
              >
                <option value="user">일반 사용자</option>
                <option value="admin">운영진</option>
              </select>
            </div>
          )}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? '처리 중...' : isLogin ? '로그인' : '회원가입'}
          </button>
        </form>

        <div className="divider">
          <span>또는</span>
        </div>

        <button
          className="google-login-button"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <svg className="google-icon" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          구글로 로그인
        </button>

        <div className="login-footer">
          <p>
            {isLogin ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
            <button
              type="button"
              className="link-button"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? '회원가입' : '로그인'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
