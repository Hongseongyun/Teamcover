import React, { useState } from 'react';
import { useClub } from '../contexts/ClubContext';
import './ClubSelector.css';

const ClubSelector = () => {
  const { clubs, currentClub, selectClub, loading } = useClub();
  const [isOpen, setIsOpen] = useState(false);

  if (loading) {
    return <div className="club-selector-loading">로딩 중...</div>;
  }

  if (!currentClub) {
    return null;
  }

  const getRoleText = (role) => {
    switch (role) {
      case 'owner':
        return '소유자';
      case 'admin':
        return '운영진';
      default:
        return '회원';
    }
  };

  return (
    <div className="club-selector">
      <button
        className="club-selector-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="클럽 선택"
      >
        <span className="club-name">{currentClub.name}</span>
        <span className="club-role">{getRoleText(currentClub.role)}</span>
        <span className={`dropdown-arrow ${isOpen ? 'rotated' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <>
          <div
            className="club-dropdown-overlay"
            onClick={() => setIsOpen(false)}
          />
          <div className="club-dropdown">
            {clubs.map((club) => (
              <div
                key={club.id}
                className={`club-item ${
                  club.id === currentClub.id ? 'active' : ''
                }`}
                onClick={() => {
                  if (club.id !== currentClub.id) {
                    selectClub(club.id);
                  }
                  setIsOpen(false);
                }}
              >
                <div className="club-item-name">{club.name}</div>
                <div className="club-item-role">{getRoleText(club.role)}</div>
              </div>
            ))}
            <div className="club-item-divider"></div>
            <div
              className="club-item create-club-item"
              onClick={() => {
                // 클럽 생성 모달은 별도로 구현 필요
                alert('클럽 생성 기능은 준비 중입니다.');
                setIsOpen(false);
              }}
            >
              + 새 클럽 만들기
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ClubSelector;
