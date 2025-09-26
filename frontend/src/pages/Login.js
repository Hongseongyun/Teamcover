import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    name: '',
    role: 'user',
  });
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [passwordErrors, setPasswordErrors] = useState([]);
  const [isFormValid, setIsFormValid] = useState(false);

  // 초기 폼 유효성 검사 (디바운스 적용)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsFormValid(validateForm());
    }, 100); // 100ms 디바운스

    return () => clearTimeout(timeoutId);
  }, [formData, isLogin]);

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

    // 교차-탭: 이메일 인증 완료 신호를 수신하면 로그인 탭으로 전환
    const handleStorage = (e) => {
      if (e.key === 'emailVerified' && e.newValue === '1') {
        // 같은 탭에서 새로고침 없이도 반영되도록 즉시 처리
        setIsLogin(true);
        setSuccessMessage(
          '이메일 인증이 완료되었습니다. 이제 로그인할 수 있습니다.'
        );
        try {
          localStorage.removeItem('emailVerified');
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // 혹시 동일 탭에서 이미 설정된 경우도 대비
    try {
      if (localStorage.getItem('emailVerified') === '1') {
        setIsLogin(true);
        setSuccessMessage(
          '이메일 인증이 완료되었습니다. 이제 로그인할 수 있습니다.'
        );
        localStorage.removeItem('emailVerified');
      }
    } catch (err) {}

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [isAuthenticated, navigate, from]);

  const validatePassword = (password) => {
    const errors = [];

    if (password.length < 6) {
      errors.push('6글자 이상이어야 합니다');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('소문자를 포함해야 합니다');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('대문자를 포함해야 합니다');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('특수문자를 포함해야 합니다');
    }

    return errors;
  };

  const validateForm = () => {
    if (isLogin) {
      return formData.email && formData.password;
    } else {
      const passwordErrors = validatePassword(formData.password);
      const passwordsMatch = formData.password === formData.passwordConfirm;

      // 기본 필드 검증 (공백이 아닌지 확인)
      const hasEmail = formData.email.trim() !== '';
      const hasName = formData.name.trim() !== '';
      const hasPassword = formData.password.trim() !== '';
      const hasPasswordConfirm = formData.passwordConfirm.trim() !== '';

      const isValid =
        hasEmail &&
        hasName &&
        hasPassword &&
        hasPasswordConfirm &&
        passwordErrors.length === 0 &&
        passwordsMatch;

      // 디버깅용 로그 (개발 시에만 활성화)
      // console.log('Form validation:', {
      //   hasEmail,
      //   hasName,
      //   hasPassword,
      //   hasPasswordConfirm,
      //   passwordErrors: passwordErrors.length,
      //   passwordsMatch,
      //   isValid,
      // });

      return isValid;
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
    setSuccessMessage('');

    // 비밀번호 검증
    if (name === 'password' && !isLogin) {
      const errors = validatePassword(value);
      setPasswordErrors(errors);
    }

    // 폼 유효성 검사는 useEffect에서 디바운스로 처리
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setSuccessMessage('');
    setPasswordErrors([]);
    setIsFormValid(false);
    setFormData({
      email: '',
      password: '',
      passwordConfirm: '',
      name: '',
      role: 'user',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      let result;
      if (isLogin) {
        result = await login(formData.email, formData.password);
      } else {
        result = await register(
          formData.email,
          formData.name,
          formData.password,
          formData.passwordConfirm,
          formData.role
        );
        console.log('회원가입 결과:', result);
        if (result.success) {
          // 이메일 인증이 필요한 경우 자동 로그인하지 않음
          if (result.data?.email_sent) {
            console.log('이메일 발송 성공 - 성공 메시지 표시');
            setError(''); // 오류 메시지 초기화
            setSuccessMessage('이메일을 확인하여 인증을 완료해주세요.');
            setLoading(false); // 로딩 상태 해제
            return; // 자동 로그인하지 않음
          } else if (result.data?.email_sent === false) {
            setError(
              '회원가입이 완료되었지만 이메일 발송에 실패했습니다. 나중에 다시 시도해주세요.'
            );
            return;
          } else {
            // 이메일 인증이 비활성화된 경우에만 자동 로그인
            result = await login(formData.email, formData.password);
            if (result.success) {
              navigate(from, { replace: true });
            } else {
              setError(result.message);
            }
            return;
          }
        } else {
          // 회원가입 실패 시
          setError(result.message);
          return;
        }
      }

      // 로그인 성공 시에만 여기 도달
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
            onClick={() => {
              if (!isLogin) toggleMode();
            }}
          >
            로그인
          </button>
          <button
            className={`tab-button ${!isLogin ? 'active' : ''}`}
            onClick={() => {
              if (isLogin) toggleMode();
            }}
          >
            회원가입
          </button>
        </div>

        {error && !successMessage && (
          <div className="error-message">{error}</div>
        )}
        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}

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
            <div className="password-requirements">
              <small>소문자, 대문자, 특수문자 포함 6글자 이상</small>
              {!isLogin && passwordErrors.length > 0 && (
                <div className="password-errors">
                  {passwordErrors.map((error, index) => (
                    <small key={index} className="error-text">
                      • {error}
                    </small>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="passwordConfirm">비밀번호 확인</label>
              <input
                type="password"
                id="passwordConfirm"
                name="passwordConfirm"
                value={formData.passwordConfirm}
                onChange={handleInputChange}
                required={!isLogin}
                placeholder="비밀번호를 다시 입력하세요"
                className={
                  formData.passwordConfirm &&
                  formData.password !== formData.passwordConfirm
                    ? 'error'
                    : formData.passwordConfirm &&
                      formData.password === formData.passwordConfirm
                    ? 'success'
                    : ''
                }
              />
              {formData.passwordConfirm &&
                formData.password !== formData.passwordConfirm && (
                  <small className="error-text">
                    비밀번호가 일치하지 않습니다
                  </small>
                )}
              {formData.passwordConfirm &&
                formData.password === formData.passwordConfirm && (
                  <small className="success-text">비밀번호가 일치합니다</small>
                )}
            </div>
          )}

          <button
            type="submit"
            className={`login-button ${
              !isFormValid && !isLogin ? 'disabled' : ''
            }`}
            disabled={loading || (!isFormValid && !isLogin)}
            title={
              !isLogin ? `폼 유효성: ${isFormValid ? '유효' : '무효'}` : ''
            }
          >
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
            <button type="button" className="link-button" onClick={toggleMode}>
              {isLogin ? '회원가입' : '로그인'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
