import React from 'react';
import { Modal } from '../../../components/common/Modal';

/**
 * 게스트 추가 모달
 */
const GuestModal = ({
  isOpen,
  onClose,
  guestData,
  guestErrors,
  onDataChange,
  onSubmit,
}) => {
  const isSubmitDisabled =
    !guestData.name.trim() ||
    !guestData.average ||
    !guestData.gender ||
    guestErrors.name ||
    guestErrors.average;

  const footer = (
    <button
      className="btn btn-primary"
      onClick={onSubmit}
      disabled={isSubmitDisabled}
    >
      추가하기
    </button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="게스트 추가"
      footer={footer}
      size="md"
      className="guest-modal"
    >
      <div className="form-group">
        <label>이름</label>
        <input
          type="text"
          placeholder="게스트 이름을 입력하세요"
          value={guestData.name}
          onChange={(e) => onDataChange('name', e.target.value)}
          className={`form-input ${guestErrors.name ? 'error' : ''}`}
        />
        {guestErrors.name && (
          <div className="error-message">{guestErrors.name}</div>
        )}
      </div>
      <div className="form-group">
        <label>평균 점수</label>
        <input
          type="number"
          min="0"
          max="300"
          placeholder="평균 점수를 입력하세요"
          value={guestData.average}
          onChange={(e) => onDataChange('average', e.target.value)}
          className={`form-input ${guestErrors.average ? 'error' : ''}`}
        />
        {guestErrors.average && (
          <div className="error-message">{guestErrors.average}</div>
        )}
      </div>
      <div className="form-group">
        <label>성별</label>
        <div className="gender-options">
          <button
            type="button"
            className={`gender-option ${guestData.gender === '남' ? 'active' : ''}`}
            onClick={() => onDataChange('gender', '남')}
          >
            남
          </button>
          <button
            type="button"
            className={`gender-option ${guestData.gender === '여' ? 'active' : ''}`}
            onClick={() => onDataChange('gender', '여')}
          >
            여
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default GuestModal;

