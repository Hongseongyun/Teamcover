import React from 'react';
import { Modal } from '../../../components/common/Modal';

/**
 * 점수 입력 모달
 */
const ScoreInputModal = ({
  isOpen,
  onClose,
  pendingMembers,
  memberScores,
  onScoreInput,
  onCancel,
  onComplete,
}) => {
  const isSubmitDisabled = pendingMembers.some(
    (member) => !memberScores[member.name] || memberScores[member.name] <= 0
  );

  const footer = (
    <>
      <button className="btn btn-secondary" onClick={onCancel}>
        취소
      </button>
      <button
        className="btn btn-primary"
        onClick={onComplete}
        disabled={isSubmitDisabled}
      >
        추가하기
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="점수 입력"
      subtitle="다음 회원들의 평균 점수를 입력해주세요."
      footer={footer}
      size="md"
      className="score-input-modal"
    >
      {pendingMembers.map((member) => (
        <div key={member.id} className="score-input-row">
          <div className="member-info">
            <span className="member-name">{member.name}</span>
            <span className="member-gender">({member.gender || '미지정'})</span>
          </div>
          <div className="score-input-group">
            <input
              type="number"
              min="0"
              max="300"
              placeholder="평균 점수"
              value={memberScores[member.name] || ''}
              onChange={(e) => onScoreInput(member.name, e.target.value)}
              className="score-input"
            />
            <span className="score-unit">점</span>
          </div>
        </div>
      ))}
    </Modal>
  );
};

export default ScoreInputModal;

