import React, { useState } from 'react';
import { authAPI } from '../services/api';
import './ForgotPassword.css';

const ForgotPassword = ({ onClose, onLogin }) => {
  const [step, setStep] = useState(1); // 1: 이메일 입력, 2: 인증 코드 입력, 3: 새 비밀번호 설정
  const [formData, setFormData] = useState({
    email: '',
    code: '',
    newPassword: '',
    newPasswordConfirm: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [passwordErrors, setPasswordErrors] = useState([]);

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
    setSuccessMessage('');

    // 비밀번호 검증
    if (name === 'newPassword') {
      const errors = validatePassword(value);
      setPasswordErrors(errors);
    }
  };

  const handleStep1 = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('비밀번호 찾기 요청 시작:', formData.email);
      const result = await authAPI.forgotPassword({ email: formData.email });
      console.log('비밀번호 찾기 응답:', result.data);

      if (result.data.success) {
        setSuccessMessage(result.data.message);
        setStep(2);
      } else {
        setError(result.data.message);
      }
    } catch (error) {
      console.error('비밀번호 찾기 오류:', error);
      console.error('오류 응답:', error.response);

      let errorMessage = '비밀번호 찾기 요청 중 오류가 발생했습니다.';

      if (error.response) {
        // 서버에서 응답을 받았지만 오류 상태
        errorMessage =
          error.response.data?.message ||
          `서버 오류 (${error.response.status})`;
      } else if (error.request) {
        // 요청이 전송되었지만 응답을 받지 못함
        errorMessage =
          '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.';
      } else {
        // 요청 설정 중 오류 발생
        errorMessage = error.message || '요청 설정 중 오류가 발생했습니다.';
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await authAPI.verifyResetCode({
        email: formData.email,
        code: formData.code,
      });

      if (result.data.success) {
        setResetToken(result.data.reset_token);
        setSuccessMessage(result.data.message);
        setStep(3);
      } else {
        setError(result.data.message);
      }
    } catch (error) {
      setError(
        error.response?.data?.message ||
          '인증 코드 확인 중 오류가 발생했습니다.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStep3 = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // 비밀번호 검증
    const passwordErrors = validatePassword(formData.newPassword);
    if (passwordErrors.length > 0) {
      setPasswordErrors(passwordErrors);
      setLoading(false);
      return;
    }

    if (formData.newPassword !== formData.newPasswordConfirm) {
      setError('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      setLoading(false);
      return;
    }

    try {
      // 임시로 토큰을 localStorage에 저장하여 API 호출 시 사용
      localStorage.setItem('temp_reset_token', resetToken);

      const result = await authAPI.resetPassword({
        new_password: formData.newPassword,
        new_password_confirm: formData.newPasswordConfirm,
      });

      if (result.data.success) {
        setSuccessMessage(result.data.message);
        // 토큰 정리
        localStorage.removeItem('temp_reset_token');
        // 3초 후 로그인 페이지로 이동
        setTimeout(() => {
          onLogin();
        }, 3000);
      } else {
        setError(result.data.message);
      }
    } catch (error) {
      setError(
        error.response?.data?.message ||
          '비밀번호 재설정 중 오류가 발생했습니다.'
      );
    } finally {
      setLoading(false);
      localStorage.removeItem('temp_reset_token');
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setError('');
      setSuccessMessage('');
    }
  };

  const renderStep1 = () => (
    <div className="forgot-password-step">
      <h2>비밀번호 찾기</h2>
      <p>
        가입하신 이메일 주소를 입력해주세요. 비밀번호 재설정을 위한 인증 코드를
        발송해드립니다.
      </p>

      <form onSubmit={handleStep1}>
        <div className="form-group">
          <label htmlFor="email">이메일 주소</label>
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

        <div className="form-actions">
          <button type="button" className="back-button" onClick={onClose}>
            취소
          </button>
          <button
            type="submit"
            className="submit-button"
            disabled={loading || !formData.email}
          >
            {loading ? '처리 중...' : '인증 코드 발송'}
          </button>
        </div>
      </form>
    </div>
  );

  const renderStep2 = () => (
    <div className="forgot-password-step">
      <h2>인증 코드 확인</h2>
      <p>
        <strong>{formData.email}</strong>로 발송된 6자리 인증 코드를
        입력해주세요.
      </p>

      <form onSubmit={handleStep2}>
        <div className="form-group">
          <label htmlFor="code">인증 코드</label>
          <input
            type="text"
            id="code"
            name="code"
            value={formData.code}
            onChange={handleInputChange}
            required
            placeholder="6자리 인증 코드를 입력하세요"
            maxLength="6"
            style={{
              textAlign: 'center',
              fontSize: '18px',
              letterSpacing: '2px',
            }}
          />
        </div>

        <div className="form-actions">
          <button type="button" className="back-button" onClick={handleBack}>
            이전
          </button>
          <button
            type="submit"
            className="submit-button"
            disabled={loading || formData.code.length !== 6}
          >
            {loading ? '확인 중...' : '인증 코드 확인'}
          </button>
        </div>
      </form>
    </div>
  );

  const renderStep3 = () => (
    <div className="forgot-password-step">
      <h2>새 비밀번호 설정</h2>
      <p>새로운 비밀번호를 입력해주세요.</p>

      <form onSubmit={handleStep3}>
        <div className="form-group">
          <label htmlFor="newPassword">새 비밀번호</label>
          <input
            type="password"
            id="newPassword"
            name="newPassword"
            value={formData.newPassword}
            onChange={handleInputChange}
            required
            placeholder="새 비밀번호를 입력하세요"
          />
          <div className="password-requirements">
            <small>소문자, 대문자, 특수문자 포함 6글자 이상</small>
            {passwordErrors.length > 0 && (
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

        <div className="form-group">
          <label htmlFor="newPasswordConfirm">새 비밀번호 확인</label>
          <input
            type="password"
            id="newPasswordConfirm"
            name="newPasswordConfirm"
            value={formData.newPasswordConfirm}
            onChange={handleInputChange}
            required
            placeholder="새 비밀번호를 다시 입력하세요"
            className={
              formData.newPasswordConfirm &&
              formData.newPassword !== formData.newPasswordConfirm
                ? 'error'
                : formData.newPasswordConfirm &&
                  formData.newPassword === formData.newPasswordConfirm
                ? 'success'
                : ''
            }
          />
          {formData.newPasswordConfirm &&
            formData.newPassword !== formData.newPasswordConfirm && (
              <small className="error-text">비밀번호가 일치하지 않습니다</small>
            )}
          {formData.newPasswordConfirm &&
            formData.newPassword === formData.newPasswordConfirm && (
              <small className="success-text">비밀번호가 일치합니다</small>
            )}
        </div>

        <div className="form-actions">
          <button type="button" className="back-button" onClick={handleBack}>
            이전
          </button>
          <button
            type="submit"
            className="submit-button"
            disabled={
              loading ||
              !formData.newPassword ||
              !formData.newPasswordConfirm ||
              passwordErrors.length > 0
            }
          >
            {loading ? '설정 중...' : '비밀번호 재설정'}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="forgot-password-modal">
      <div className="forgot-password-content">
        <div className="close-button" onClick={onClose}>
          ×
        </div>

        {error && <div className="error-message">{error}</div>}
        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        <div className="forgot-password-footer">
          <p>
            계정이 있으신가요?
            <button type="button" className="link-button" onClick={onLogin}>
              로그인
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
