import React from 'react';
import { Modal } from '../../../components/common/Modal';

/**
 * 선입 납입 추가 모달
 */
const PrepayModal = ({
  isOpen,
  onClose,
  prepayTarget,
  members,
  prepayMonths,
  onPrepayMonthsChange,
  prepayStatus,
  onPrepayStatusChange,
  monthlyFeeAmount,
  onSubmit,
  submitting,
}) => {
  if (!prepayTarget) return null;

  // 선택한 월부터 12월까지의 남은 개월 수 계산
  const monthStr = prepayTarget.month; // YYYY-MM 형식
  const monthNum = parseInt(monthStr.split('-')[1], 10); // MM 추출
  const maxMonths = 13 - monthNum; // 선택한 월 포함해서 12월까지
  const maxMonthsLimited = Math.max(1, Math.min(maxMonths, 12)); // 최소 1개월, 최대 12개월

  // 현재 선택된 개월 수가 최대값을 초과하면 최대값으로 조정
  const validPrepayMonths = Math.min(prepayMonths, maxMonthsLimited);
  if (prepayMonths > maxMonthsLimited) {
    onPrepayMonthsChange(maxMonthsLimited);
  }

  const selectedMember = members.find((m) => m.id === prepayTarget.memberId);

  const handleSubmit = () => {
    if (prepayTarget) {
      onSubmit(
        prepayTarget.memberId,
        prepayTarget.month,
        validPrepayMonths,
        monthlyFeeAmount,
        prepayStatus
      );
    }
  };

  const footer = (
    <>
      <button
        className="btn btn-secondary"
        onClick={onClose}
        disabled={submitting}
      >
        취소
      </button>
      <button
        className="btn btn-primary"
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting ? '추가 중...' : '추가'}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="선입 납입 추가"
      footer={footer}
      size="sm"
      className="prepay-modal"
    >
      <div className="form-group">
        <label>회원</label>
        <input
          type="text"
          value={selectedMember?.name || ''}
          className="form-control"
          disabled
        />
      </div>
      <div className="form-group">
        <label>시작 월</label>
        <input
          type="text"
          value={prepayTarget.month}
          className="form-control"
          disabled
        />
      </div>
      <div className="form-group">
        <label>선입 개월 수</label>
        <select
          className="form-control"
          value={validPrepayMonths}
          onChange={(e) => onPrepayMonthsChange(parseInt(e.target.value, 10))}
          disabled={submitting}
        >
          {Array.from({ length: maxMonthsLimited }, (_, i) => i + 1).map(
            (m) => (
              <option key={m} value={m}>
                {`${m}개월`}
              </option>
            )
          )}
        </select>
      </div>
      <div className="form-group">
        <label>상태 선택</label>
        <select
          className="form-control"
          value={prepayStatus}
          onChange={(e) => onPrepayStatusChange(e.target.value)}
          disabled={submitting}
        >
          <option value="paid">납입</option>
          <option value="point">포인트</option>
          <option value="exempt">면제</option>
          <option value="unpaid">미납</option>
        </select>
      </div>
    </Modal>
  );
};

export default PrepayModal;
