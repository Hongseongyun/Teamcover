import React from 'react';
import './TierBadge.css';

/**
 * 티어 뱃지 컴포넌트
 *
 * @param {string} tier - 티어 이름 (한글)
 * @param {string} size - 뱃지 크기 ('normal' | 'small')
 */
const TierBadge = ({ tier, size = 'normal' }) => {
  const getTierClass = (tier) => {
    if (!tier) return 'tier-unranked';

    const tierMap = {
      배치: 'tier-unranked',
      아이언: 'tier-iron',
      브론즈: 'tier-bronze',
      실버: 'tier-silver',
      골드: 'tier-gold',
      플레티넘: 'tier-platinum',
      다이아: 'tier-diamond',
      마스터: 'tier-master',
      챌린저: 'tier-challenger',
    };

    return tierMap[tier] || 'tier-unranked';
  };

  const getDisplayTier = (tier) => {
    const tierMap = {
      배치: 'UNRANKED',
      아이언: 'IRON',
      브론즈: 'BRONZE',
      실버: 'SILVER',
      골드: 'GOLD',
      플레티넘: 'PLATINUM',
      다이아: 'DIAMOND',
      마스터: 'MASTER',
      챌린저: 'CHALLENGER',
    };
    return tierMap[tier] || 'UNRANKED';
  };

  const displayTier = getDisplayTier(tier);
  const tierClass = getTierClass(tier);
  const badgeClass =
    size === 'small' ? 'tier-badge tier-badge-sm' : 'tier-badge';

  return (
    <div className={`${badgeClass} ${tierClass}`}>
      <span>{displayTier}</span>
    </div>
  );
};

export default TierBadge;

