import React from 'react';
import { Modal } from '../../../components/common/Modal';

/**
 * 개인정보 보호 비밀번호 입력 모달
 */
const PasswordModal = ({
  isOpen,
  onClose,
  password,
  onPasswordChange,
  onVerify,
  error,
}) => {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      onVerify();
    }
  };

  const footer = (
    <>
      <button className="btn btn-primary" onClick={onVerify}>
        확인
      </button>
      <button className="btn btn-secondary" onClick={onClose}>
        취소
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🔒 개인정보 보호"
      footer={footer}
      size="sm"
      closeOnOverlayClick={false}
    >
      <p>전화번호와 이메일을 보려면 비밀번호를 입력하세요.</p>

      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <label>비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="비밀번호 입력"
          autoFocus
        />
      </div>
    </Modal>
  );
};

export default PasswordModal;

