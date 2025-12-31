import React from 'react';
import { Modal } from '../../../components/common/Modal';

/**
 * 개인정보 보호 비밀번호 설정 모달
 */
const PasswordSettingModal = ({
  isOpen,
  onClose,
  password,
  onPasswordChange,
  onSave,
  isPasswordSet,
}) => {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      onSave();
    }
  };

  const footer = (
    <>
      <button className="btn btn-primary" onClick={onSave}>
        저장
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
      title="🔒 개인정보 보호 비밀번호 설정"
      footer={footer}
      size="sm"
      closeOnOverlayClick={false}
    >
      <p>
        {isPasswordSet
          ? '비밀번호를 변경하려면 새 비밀번호를 입력하세요.'
          : '개인정보(전화번호, 이메일) 열람 시 필요한 비밀번호를 설정하세요.'}
      </p>

      <div className="form-group">
        <label>비밀번호 (4자리 이상)</label>
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

export default PasswordSettingModal;

