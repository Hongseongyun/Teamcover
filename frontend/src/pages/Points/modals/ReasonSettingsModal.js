import React from 'react';
import { Modal } from '../../../components/common/Modal';

/**
 * 포인트 사유 설정 모달
 */
const ReasonSettingsModal = ({
  isOpen,
  onClose,
  editingReasons,
  onUpdateReason,
  onSave,
}) => {
  const handleAmountChange = (index, value) => {
    // 입력 중 상태 허용: '', '-'
    if (value === '' || value === '-') {
      onUpdateReason(index, 'amount', value);
      return;
    }
    const numValue = Number(value);
    if (!Number.isNaN(numValue)) {
      onUpdateReason(index, 'amount', numValue);
    }
  };

  const handleKeyDown = (e, index, reason) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const currentAmount =
        typeof reason.amount === 'number' ? reason.amount : 0;
      onUpdateReason(index, 'amount', currentAmount + 500);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const currentAmount =
        typeof reason.amount === 'number' ? reason.amount : 0;
      onUpdateReason(index, 'amount', currentAmount - 500);
    } else if (e.key === '-') {
      // 전체 선택 상태에서 '-' 입력 허용
      const input = e.target;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      if (start !== end) {
        e.preventDefault();
        onUpdateReason(index, 'amount', '-');
      }
    }
  };

  const handleMouseDown = (e, index, reason) => {
    // 스피너 버튼 클릭 감지 및 기본 동작 차단
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;

    if (x > width - 20 && x < width && y >= 0 && y <= height) {
      e.preventDefault();
      e.stopPropagation();

      const currentAmount =
        typeof reason.amount === 'number' ? reason.amount : 0;
      if (y < height / 2) {
        onUpdateReason(index, 'amount', currentAmount + 500);
      } else {
        onUpdateReason(index, 'amount', currentAmount - 500);
      }
    }
  };

  const footer = (
    <div className="modal-actions">
      <button type="button" className="btn btn-primary" onClick={onSave}>
        저장
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="포인트 설정"
      footer={footer}
      size="md"
    >
      <div className="reason-settings-grid">
        {editingReasons
          .filter((reason) => reason.name !== '기타')
          .map((reason, index) => (
            <div key={reason.name} className="reason-setting-item">
              <label className="reason-name">{reason.name}</label>
              <div className="reason-amount-input">
                <input
                  type="number"
                  value={
                    typeof reason.amount === 'string'
                      ? reason.amount
                      : Number.isFinite(reason.amount)
                      ? String(reason.amount)
                      : ''
                  }
                  onChange={(e) => handleAmountChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index, reason)}
                  onMouseDown={(e) => handleMouseDown(e, index, reason)}
                  step="1"
                  min="-999999"
                  max="999999"
                />
                <span className="amount-unit">P</span>
              </div>
            </div>
          ))}
        <div className="reason-setting-item">
          <label className="reason-name">기타</label>
          <div className="reason-amount-input">
            <span className="readonly-note">
              기타 항목은 각 행에서 직접 입력하세요
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ReasonSettingsModal;

