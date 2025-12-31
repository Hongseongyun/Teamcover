import React from 'react';

/**
 * 회원별 잔여 포인트 현황 섹션 컴포넌트
 */
const MemberBalanceSection = ({ memberBalances, formatNumber }) => {
  return (
    <div className="member-balance-section">
      <div className="section-card">
        <h3 className="section-title">회원별 잔여 포인트 현황</h3>
        <div className="member-balance-grid">
          {memberBalances.map((member, index) => (
            <div key={member.member_name} className="member-balance-card">
              <div className="member-balance-rank">#{index + 1}</div>
              <div className="member-balance-info">
                <span className="member-balance-name">
                  {member.member_name}
                </span>
                <span
                  className={`member-balance-amount ${
                    member.balance >= 0 ? 'positive' : 'negative'
                  }`}
                >
                  {formatNumber(member.balance)}P
                </span>
              </div>
            </div>
          ))}
          {memberBalances.length === 0 && (
            <div className="no-data">잔여 포인트가 있는 회원이 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemberBalanceSection;

