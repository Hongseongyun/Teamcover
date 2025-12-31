import React, { useState } from 'react';
import { Modal } from '../../../components/common/Modal';

/**
 * 월회비 설정 모달
 */
const MonthlyFeeSettingsModal = ({
  isOpen,
  onClose,
  monthlyFeeAmount,
  onSave,
  submitting,
}) => {
  const [feeInput, setFeeInput] = useState(monthlyFeeAmount.toString());

  const handleSave = async () => {
    const amount = parseInt(feeInput);
    if (isNaN(amount) || amount <= 0) {
      alert('올바른 금액을 입력해주세요.');
      return;
    }
    await onSave(amount);
  };

  // 모달이 열릴 때 현재 값으로 초기화
  React.useEffect(() => {
    if (isOpen) {
      setFeeInput(monthlyFeeAmount.toString());
    }
  }, [isOpen, monthlyFeeAmount]);

  const footer = (
    <button
      className="btn btn-secondary"
      onClick={handleSave}
      disabled={submitting}
    >
      {submitting ? '저장 중...' : '저장'}
    </button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="월회비 설정"
      footer={footer}
      size="sm"
    >
      <div className="form-group">
        <label style={{ textAlign: 'left', display: 'block' }}>
          월회비 금액 (원)
        </label>
        <input
          type="number"
          value={feeInput}
          onChange={(e) => setFeeInput(e.target.value)}
          className="form-control"
          min="1"
          placeholder={monthlyFeeAmount.toString()}
          style={{
            WebkitAppearance: 'none',
            MozAppearance: 'textfield',
          }}
        />
      </div>
    </Modal>
  );
};

export default MonthlyFeeSettingsModal;

