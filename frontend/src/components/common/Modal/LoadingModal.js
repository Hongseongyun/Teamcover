import React from 'react';
import Modal from './Modal';
import './LoadingModal.css';

/**
 * 로딩 모달 컴포넌트
 *
 * @param {boolean} isOpen - 모달 표시 여부
 * @param {string} message - 로딩 메시지 - 기본값: '처리 중...'
 */
const LoadingModal = ({ isOpen, message = '처리 중...' }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={null}
      showCloseButton={false}
      closeOnOverlayClick={false}
      size="sm"
      className="loading-modal"
    >
      <div className="loading-modal-content">
        <div className="loading-modal-spinner"></div>
        <p className="loading-modal-message">{message}</p>
      </div>
    </Modal>
  );
};

export default LoadingModal;
