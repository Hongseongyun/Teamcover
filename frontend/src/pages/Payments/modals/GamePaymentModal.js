import React from 'react';
import { Modal } from '../../../components/common/Modal';

/**
 * 게임비 납입 관리 모달
 */
const GamePaymentModal = ({
  isOpen,
  onClose,
  gamePaymentDate,
  onDateChange,
  gameType,
  onGameTypeChange,
  gameAmount,
  onGameAmountChange,
  memberSearchQuery,
  onSearchMembers,
  availableMembers,
  gamePaymentMembers,
  onAddMember,
  onRemoveMember,
  onTogglePaymentStatus,
  onSave,
  submitting,
}) => {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && availableMembers.length > 0) {
      e.preventDefault();
      const firstMember = availableMembers[0];
      const isAdded = gamePaymentMembers.find(
        (m) => m.member_id === firstMember.id
      );
      if (!isAdded) {
        onAddMember(firstMember);
      }
    }
  };

  const footer = (
    <button className="btn btn-primary" onClick={onSave} disabled={submitting}>
      {submitting ? '저장 중...' : '저장'}
    </button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="게임비 납입 관리"
      footer={footer}
      size="lg"
      className="game-payment-modal"
    >
      {/* 날짜 선택 */}
      <div className="form-group">
        <label>게임 날짜</label>
        <input
          type="date"
          value={gamePaymentDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="form-control"
        />
      </div>

      {/* 게임 종류 선택 */}
      <div className="form-group">
        <label>게임 종류</label>
        <select
          value={gameType}
          onChange={(e) => onGameTypeChange(e.target.value)}
          className="form-control"
          disabled={submitting}
        >
          <option value="regular">정기전</option>
          <option value="event">이벤트전</option>
        </select>
      </div>

      {/* 게임비 입력 */}
      <div className="form-group">
        <label>게임비 (원)</label>
        <input
          type="number"
          value={gameAmount}
          onChange={(e) => onGameAmountChange(parseInt(e.target.value) || 0)}
          className="form-control game-amount-input"
          min="0"
          disabled={submitting}
        />
      </div>

      {/* 회원 검색 및 추가 */}
      <div className="form-group">
        <label>회원 검색</label>
        <div className="search-member-wrapper">
          <input
            type="text"
            value={memberSearchQuery}
            onChange={(e) => onSearchMembers(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="회원 이름을 입력하세요"
            className="form-control"
          />
          {memberSearchQuery && availableMembers.length > 0 && (
            <div className="search-results">
              <ul className="member-list">
                {availableMembers.map((member) => {
                  const isAdded = gamePaymentMembers.find(
                    (m) => m.member_id === member.id
                  );
                  return (
                    <li
                      key={member.id}
                      className={`member-item ${isAdded ? 'added' : ''}`}
                      onClick={() => !isAdded && onAddMember(member)}
                    >
                      <span>{member.name}</span>
                      {isAdded && <span className="badge">추가됨</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* 추가된 회원 목록 */}
      {gamePaymentMembers.length > 0 && (
        <div className="added-members-list">
          <h4>참가 회원 ({gamePaymentMembers.length}명)</h4>
          <table className="game-payment-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>납입 여부</th>
                <th>설정</th>
              </tr>
            </thead>
            <tbody>
              {gamePaymentMembers.map((memberPayment) => (
                <tr key={memberPayment.member_id}>
                  <td>{memberPayment.member_name}</td>
                  <td>
                    <button
                      className={`btn btn-sm ${
                        memberPayment.paid_with_points
                          ? 'btn-info'
                          : memberPayment.is_paid
                          ? 'btn-success'
                          : 'btn-outline-danger'
                      }`}
                      onClick={() =>
                        onTogglePaymentStatus(memberPayment.member_id)
                      }
                      disabled={submitting}
                    >
                      {memberPayment.paid_with_points
                        ? 'P 포인트납부'
                        : memberPayment.is_paid
                        ? '✓ 납입완료'
                        : '✗ 미납'}
                    </button>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-delete"
                      onClick={() => onRemoveMember(memberPayment.member_id)}
                      disabled={submitting}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
};

export default GamePaymentModal;
