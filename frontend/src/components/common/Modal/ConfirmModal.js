import React from 'react';
import Modal from './Modal';

/**
 * 확인 모달 컴포넌트
 *
 * @param {boolean} isOpen - 모달 표시 여부
 * @param {function} onClose - 모달 닫기 함수
 * @param {function} onConfirm - 확인 버튼 클릭 시 실행할 함수
 * @param {string} title - 모달 제목
 * @param {string|React.ReactNode} message - 확인 메시지
 * @param {string} confirmText - 확인 버튼 텍스트 - 기본값: '확인'
 * @param {string} cancelText - 취소 버튼 텍스트 - 기본값: '취소'
 * @param {string} confirmVariant - 확인 버튼 스타일 ('primary', 'danger') - 기본값: 'primary'
 * @param {boolean} isLoading - 확인 버튼 로딩 상태
 */
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = '확인',
  message,
  confirmText = '확인',
  cancelText = '취소',
  confirmVariant = 'primary',
  isLoading = false,
}) => {
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
  };

  const footer = (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={onClose}
        disabled={isLoading}
      >
        {cancelText}
      </button>
      <button
        type="button"
        className={`btn btn-${confirmVariant}`}
        onClick={handleConfirm}
        disabled={isLoading}
      >
        {isLoading ? '처리 중...' : confirmText}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={footer}
      size="sm"
      showCloseButton={false}
    >
      <div className="confirm-modal-message">
        {typeof message === 'string' ? <p>{message}</p> : message}
      </div>
    </Modal>
  );
};

export default ConfirmModal;
