import React from 'react';
import Modal from './Modal';
import './DeleteModal.css';

/**
 * 삭제 확인 모달 컴포넌트
 *
 * @param {boolean} isOpen - 모달 표시 여부
 * @param {function} onClose - 모달 닫기 함수
 * @param {function} onConfirm - 삭제 확인 시 실행할 함수
 * @param {string} title - 모달 제목 - 기본값: '삭제 확인'
 * @param {string} itemName - 삭제할 항목 이름
 * @param {string} itemType - 삭제할 항목 유형 (예: '회원', '납입 내역')
 * @param {string|React.ReactNode} message - 추가 메시지 (선택)
 * @param {boolean} isLoading - 삭제 버튼 로딩 상태
 */
const DeleteModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = '삭제 확인',
  itemName,
  itemType = '항목',
  message,
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
        취소
      </button>
      <button
        type="button"
        className="btn btn-danger"
        onClick={handleConfirm}
        disabled={isLoading}
      >
        {isLoading ? '삭제 중...' : '삭제'}
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
      <div className="delete-modal-content">
        <div className="delete-modal-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <p className="delete-modal-message">
          {itemName ? (
            <>
              <strong>{itemName}</strong> {itemType}을(를) 삭제하시겠습니까?
            </>
          ) : (
            `이 ${itemType}을(를) 삭제하시겠습니까?`
          )}
        </p>
        {message && (
          <p className="delete-modal-submessage">
            {typeof message === 'string' ? message : message}
          </p>
        )}
        <p className="delete-modal-warning">이 작업은 되돌릴 수 없습니다.</p>
      </div>
    </Modal>
  );
};

export default DeleteModal;
