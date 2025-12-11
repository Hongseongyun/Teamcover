import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI, clubAPI } from '../services/api';
import ForgotPassword from '../components/ForgotPassword';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    name: '',
    role: 'user',
    club_id: '', // 선택한 클럽 ID
  });
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [passwordErrors, setPasswordErrors] = useState([]);
  const [isFormValid, setIsFormValid] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showActiveSessionModal, setShowActiveSessionModal] = useState(false);
  const [showLoginConfirmModal, setShowLoginConfirmModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [pendingLoginData, setPendingLoginData] = useState(null);
  const [availableClubs, setAvailableClubs] = useState([]);
  const [loadingClubs, setLoadingClubs] = useState(false);

  const { login, register, isAuthenticated, logoutOtherDevices } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

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

  const validateForm = useCallback(() => {
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

      return isValid;
    }
  }, [formData, isLogin]);

  // 초기 폼 유효성 검사 (디바운스 적용)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsFormValid(validateForm());
    }, 100); // 100ms 디바운스

    return () => clearTimeout(timeoutId);
  }, [formData, isLogin, validateForm]);

  useEffect(() => {
    // (중요) 기존에는 isAuthenticated이면 무조건 from으로 리다이렉트했지만,
    // 여러 클럽 가입 시 로그인 직후 클럽 선택 모달을 띄워야 하므로
    // 여기서는 자동 리다이렉트를 하지 않는다.

    // URL 파라미터에서 에러 메시지 확인 (안전한 디코딩)
    const urlParams = new URLSearchParams(window.location.search);
    const errorMessage = urlParams.get('error');
    if (errorMessage) {
      try {
        setError(decodeURIComponent(errorMessage));
      } catch (error) {
        setError('Authentication failed');
      }
    }

    // URL 파라미터에서 활성 세션 확인 (구글 로그인 콜백에서 리디렉션된 경우)
    const hasActiveSession = urlParams.get('has_active_session');
    const fromParam = urlParams.get('from');
    if (hasActiveSession === 'true' && isAuthenticated) {
      const redirectTo = fromParam ? decodeURIComponent(fromParam) : from;
      setPendingNavigation(redirectTo);
      setShowActiveSessionModal(true);
      // URL 파라미터 정리
      window.history.replaceState({}, '', '/login');
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

  // 클럽 목록 로드 (회원가입 모드일 때만)
  useEffect(() => {
    const loadClubs = async () => {
      if (!isLogin) {
        setLoadingClubs(true);
        try {
          const response = await clubAPI.getAllClubs();
          console.log('클럽 목록 API 응답:', response);

          if (response.data.success) {
            const clubs = response.data.clubs || [];
            console.log('로드된 클럽 목록:', clubs);
            setAvailableClubs(clubs);

            // 기본 선택 없음 (사용자가 직접 선택하도록)
            if (clubs.length === 0) {
              console.warn('클럽 목록이 비어있습니다.');
              setError(
                '가입할 수 있는 클럽이 없습니다. 관리자에게 문의해주세요.'
              );
            }
          } else {
            console.error('클럽 목록 조회 실패:', response.data.message);
            setError(
              response.data.message || '클럽 목록을 불러올 수 없습니다.'
            );
          }
        } catch (error) {
          console.error('클럽 목록 로드 실패:', error);
          console.error('에러 상세:', error.response?.data || error.message);
          setError(
            '클럽 목록을 불러오는 중 오류가 발생했습니다. 페이지를 새로고침해주세요.'
          );
        } finally {
          setLoadingClubs(false);
        }
      }
    };

    loadClubs();
  }, [isLogin]);

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
      club_id: '', // 기본 선택 없음
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 회원가입 모드에서 클럽이 선택되지 않았으면 클럽 선택 필드로 스크롤
    if (!isLogin && !formData.club_id) {
      const clubSelect = document.getElementById('club_id');
      if (clubSelect) {
        clubSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
        clubSelect.focus();
        setError('가입할 클럽을 선택해주세요.');
      }
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      let result;
      if (isLogin) {
        // 로그인 전 활성 세션 확인
        try {
          const sessionCheck = await authAPI.checkActiveSession({
            email: formData.email,
          });
          if (
            sessionCheck.data.success &&
            sessionCheck.data.has_active_session
          ) {
            // 활성 세션이 있으면 확인 모달 표시
            setPendingLoginData({
              email: formData.email,
              password: formData.password,
            });
            setPendingNavigation(from);
            setShowLoginConfirmModal(true);
            setLoading(false);
            return;
          }
        } catch (error) {
          // 활성 세션 확인 실패해도 로그인은 진행
          console.error('활성 세션 확인 실패:', error);
        }

        // 활성 세션이 없거나 확인 실패 시 바로 로그인
        result = await login(formData.email, formData.password);
      } else {
        result = await register(
          formData.email,
          formData.name,
          formData.password,
          formData.passwordConfirm,
          formData.role,
          formData.club_id ? parseInt(formData.club_id) : null
        );
        if (result.success) {
          // 이메일 인증이 필요한 경우 자동 로그인하지 않음
          if (result.data?.email_sent) {
            setError(''); // 오류 메시지 초기화
            setSuccessMessage('이메일을 확인하여 인증을 완료해주세요.');
            setLoading(false); // 로딩 상태 해제
            return; // 자동 로그인하지 않음
          } else if (result.data?.email_sent === false) {
            setError(
              `회원가입이 완료되었지만 이메일 발송에 실패했습니다. 
              ${result.data?.debug_info?.error?.message || ''} 
              나중에 다시 시도해주세요.`
            );
            return;
          } else {
            // 이메일 인증이 비활성화된 경우에만 자동 로그인
            // 회원가입 직후이므로 활성 세션은 없을 것이지만, 확인 모달은 표시하지 않음
            result = await login(formData.email, formData.password);
            if (result.success) {
              navigate('/', { replace: true }); // 항상 랜딩 페이지로 이동
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
        // 다른 기기에서 로그인되어 있는지 확인
        if (result.has_active_session) {
          setPendingNavigation(from);
          setShowActiveSessionModal(true);
        } else {
          // 로그인 성공 시 항상 랜딩 페이지로 이동
          navigate('/', { replace: true });
        }
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
    // 회원가입 모드이고 클럽이 선택되지 않은 경우
    if (!isLogin && !formData.club_id) {
      const clubSelect = document.getElementById('club_id');
      if (clubSelect) {
        clubSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
        clubSelect.focus();
        setError('가입할 클럽을 선택해주세요.');
      }
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Google OAuth URL 생성 (안전한 인코딩)
      let redirectUri, stateParam;
      try {
        redirectUri = encodeURIComponent(
          `${window.location.origin}/google-callback`
        );
        // state에 클럽 ID 포함 (회원가입 모드인 경우)
        const stateData = {
          from: from || '/',
          club_id: !isLogin ? formData.club_id : null,
        };
        stateParam = encodeURIComponent(JSON.stringify(stateData));
      } catch (error) {
        redirectUri = encodeURIComponent('/google-callback');
        stateParam = encodeURIComponent('/');
      }

      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${
        process.env.REACT_APP_GOOGLE_CLIENT_ID || 'your-google-client-id'
      }&redirect_uri=${redirectUri}&response_type=code&scope=openid%20email%20profile&state=${stateParam}`;

      // 선택한 클럽 ID를 sessionStorage에 저장 (구글 콜백에서 사용)
      if (!isLogin && formData.club_id) {
        sessionStorage.setItem('pending_club_id', formData.club_id);
      }

      // 현재 창에서 Google OAuth 페이지로 리디렉션
      window.location.href = googleAuthUrl;
    } catch (error) {
      setError('구글 로그인에 실패했습니다.');
      setLoading(false);
    }
  };

  return (
    <>
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
                <label htmlFor="club_id">가입할 클럽</label>
                {loadingClubs ? (
                  <div className="loading-text">클럽 목록을 불러오는 중...</div>
                ) : availableClubs.length === 0 ? (
                  <div className="error-text">
                    클럽 목록을 불러올 수 없습니다. 페이지를 새로고침해주세요.
                  </div>
                ) : (
                  <select
                    id="club_id"
                    name="club_id"
                    value={formData.club_id || ''}
                    onChange={handleInputChange}
                    required={!isLogin}
                    className="club-select"
                  >
                    <option value="">클럽을 선택해주세요</option>
                    {availableClubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name}
                      </option>
                    ))}
                  </select>
                )}
                <small className="form-hint">
                  가입할 볼링 클럽을 선택해주세요
                </small>
              </div>
            )}

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
                    <small className="success-text">
                      비밀번호가 일치합니다
                    </small>
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
                !isLogin && !isFormValid
                  ? !formData.club_id
                    ? '가입할 클럽을 선택하세요'
                    : '모든 필수 항목을 입력해주세요'
                  : ''
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
            disabled={loading || (!isLogin && !formData.club_id)}
            title={
              !isLogin && !formData.club_id ? '가입할 클럽을 선택하세요' : ''
            }
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
            {isLogin ? '구글로 로그인' : '구글로 회원가입'}
          </button>

          <div className="login-footer">
            <div className="footer-links">
              {isLogin && (
                <button
                  type="button"
                  className="footer-link"
                  onClick={() => setShowForgotPassword(true)}
                >
                  비밀번호 찾기
                </button>
              )}
              <button
                type="button"
                className="footer-link"
                onClick={toggleMode}
              >
                {isLogin ? '회원가입' : '로그인'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showForgotPassword && (
        <ForgotPassword
          onClose={() => setShowForgotPassword(false)}
          onLogin={() => setShowForgotPassword(false)}
        />
      )}

      {/* 로그인 전 확인 모달 */}
      {showLoginConfirmModal && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowLoginConfirmModal(false);
            setPendingLoginData(null);
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
                onClick={async () => {
                  setShowLoginConfirmModal(false);
                  setLoading(true);
                  try {
                    const result = await login(
                      pendingLoginData.email,
                      pendingLoginData.password
                    );
                    if (result.success) {
                      // 항상 랜딩 페이지로 이동
                      navigate('/', { replace: true });
                    } else {
                      setError(result.message);
                    }
                  } catch (error) {
                    setError('로그인 중 오류가 발생했습니다.');
                  } finally {
                    setLoading(false);
                    setPendingLoginData(null);
                  }
                }}
                disabled={loading}
              >
                {loading ? '로그인 중...' : '로그인하기'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowLoginConfirmModal(false);
                  setPendingLoginData(null);
                }}
                disabled={loading}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 다른 기기 로그인 알림 모달 (로그인 후) */}
      {showActiveSessionModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowActiveSessionModal(false)}
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
                보안을 위해 다른 기기에서 로그아웃하는 것을 권장합니다.
                <br />
                다른 기기에서 로그아웃하면 해당 기기의 접속이 즉시 종료됩니다.
              </p>
            </div>
            <div className="modal-buttons">
              <button
                className="btn-primary"
                onClick={async () => {
                  setLoading(true);
                  try {
                    const result = await logoutOtherDevices();
                    if (result.success) {
                      setShowActiveSessionModal(false);
                      setSuccessMessage('다른 기기에서 로그아웃되었습니다.');
                      // 항상 랜딩 페이지로 이동
                      navigate('/', { replace: true });
                    } else {
                      setError(
                        result.message || '다른 기기 로그아웃에 실패했습니다.'
                      );
                    }
                  } catch (error) {
                    setError('오류가 발생했습니다. 다시 시도해주세요.');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
              >
                {loading ? '처리 중...' : '다른 기기에서 로그아웃'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowActiveSessionModal(false);
                  // 항상 랜딩 페이지로 이동
                  navigate('/', { replace: true });
                }}
                disabled={loading}
              >
                이 기기에서만 계속하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Login;
