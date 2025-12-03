import React, { useState } from 'react';
import { useClub } from '../contexts/ClubContext';
import { useAuth } from '../contexts/AuthContext';
import './ClubSelector.css';

const ClubSelector = () => {
  const { clubs, currentClub, selectClub, loading, createClub, joinClub } = useClub();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [allClubs, setAllClubs] = useState([]);
  const [loadingAllClubs, setLoadingAllClubs] = useState(false);
  const [clubFormData, setClubFormData] = useState({
    name: '',
    is_points_enabled: true,
  });
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  
  const isSuperAdmin = user && user.role === 'super_admin';
  
  // 모든 클럽 목록 로드 (가입 모달용)
  const loadAllClubs = async () => {
    try {
      setLoadingAllClubs(true);
      const { clubAPI } = await import('../services/api');
      const response = await clubAPI.getAllClubs();
      if (response.data.success) {
        setAllClubs(response.data.clubs);
      }
    } catch (error) {
      console.error('클럽 목록 로드 실패:', error);
      setError('클럽 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoadingAllClubs(false);
    }
  };
  
  // 가입 모달 열기
  const handleOpenJoinModal = () => {
    setShowJoinModal(true);
    loadAllClubs();
    setIsOpen(false);
  };

  if (loading) {
    return <div className="club-selector-loading">로딩 중...</div>;
  }

  if (!currentClub) {
    return null;
  }

  return (
    <div className="club-selector">
      <button
        className="club-selector-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="클럽 선택"
      >
        <span className="club-name">{currentClub.name}</span>
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
              </div>
            ))}
            <div className="club-item-divider"></div>
            {isSuperAdmin ? (
              <div
                className="club-item create-club-item"
                onClick={() => {
                  setShowCreateModal(true);
                  setIsOpen(false);
                }}
              >
                + 새 클럽 만들기
              </div>
            ) : (
              <div
                className="club-item create-club-item"
                onClick={handleOpenJoinModal}
              >
                + 새 클럽 추가하기
              </div>
            )}
          </div>
        </>
      )}

      {/* 클럽 생성 모달 */}
      {showCreateModal && (
        <div
          className="club-create-modal-overlay"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="club-create-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="club-create-modal-header">
              <h2>새 클럽 만들기</h2>
              <button
                className="club-create-modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            <form
              className="club-create-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setError('');
                
                if (!clubFormData.name.trim()) {
                  setError('클럽 이름을 입력해주세요.');
                  return;
                }

                setCreating(true);
                const result = await createClub(clubFormData);
                setCreating(false);

                if (result.success) {
                  setShowCreateModal(false);
                  setClubFormData({
                    name: '',
                    is_points_enabled: true,
                  });
                } else {
                  setError(result.message || '클럽 생성에 실패했습니다.');
                }
              }}
            >
              <div className="club-create-form-group">
                <label htmlFor="club-name">클럽 이름 *</label>
                <input
                  id="club-name"
                  type="text"
                  value={clubFormData.name}
                  onChange={(e) =>
                    setClubFormData({ ...clubFormData, name: e.target.value })
                  }
                  placeholder="클럽명을 입력하세요"
                  maxLength={50}
                  disabled={creating}
                />
              </div>

              <div className="club-create-form-group">
                <label className="club-create-checkbox-label">
                  <input
                    type="checkbox"
                    checked={clubFormData.is_points_enabled}
                    onChange={(e) =>
                      setClubFormData({
                        ...clubFormData,
                        is_points_enabled: e.target.checked,
                      })
                    }
                    disabled={creating}
                  />
                  <span>포인트 시스템 활성화</span>
                </label>
                <p className="club-create-checkbox-description">
                  {clubFormData.is_points_enabled
                    ? '체크하면 포인트 페이지가 메뉴에 표시됩니다.'
                    : '체크하지 않으면 포인트 페이지가 메뉴에서 숨겨집니다.'}
                </p>
              </div>

              {error && <div className="club-create-error">{error}</div>}

              <div className="club-create-form-actions">
                <button
                  type="button"
                  className="club-create-cancel"
                  onClick={() => {
                    setShowCreateModal(false);
                    setError('');
                    setClubFormData({
                      name: '',
                      is_points_enabled: true,
                    });
                  }}
                  disabled={creating}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="club-create-submit"
                  disabled={creating || !clubFormData.name.trim()}
                >
                  {creating ? '생성 중...' : '생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 클럽 가입 모달 (일반 회원용) */}
      {showJoinModal && (
        <div
          className="club-create-modal-overlay"
          onClick={() => setShowJoinModal(false)}
        >
          <div
            className="club-create-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="club-create-modal-header">
              <h2>클럽 추가하기</h2>
              <button
                className="club-create-modal-close"
                onClick={() => {
                  setShowJoinModal(false);
                  setError('');
                }}
              >
                ✕
              </button>
            </div>

            <div className="club-join-content">
              {loadingAllClubs ? (
                <div className="club-join-loading">클럽 목록을 불러오는 중...</div>
              ) : (
                <>
                  {allClubs.length === 0 ? (
                    <div className="club-join-empty">가입 가능한 클럽이 없습니다.</div>
                  ) : (
                    <div className="club-join-list">
                      {allClubs.map((club) => {
                        const isMember = clubs.some((c) => c.id === club.id);
                        return (
                          <div
                            key={club.id}
                            className={`club-join-item ${isMember ? 'joined' : ''}`}
                          >
                            <div className="club-join-item-info">
                              <div className="club-join-item-name">{club.name}</div>
                              {club.description && (
                                <div className="club-join-item-description">
                                  {club.description}
                                </div>
                              )}
                              <div className="club-join-item-meta">
                                {club.is_points_enabled && (
                                  <span className="club-join-item-badge">포인트 시스템 활성화</span>
                                )}
                              </div>
                            </div>
                            {isMember ? (
                              <div className="club-join-item-status">가입됨</div>
                            ) : (
                              <button
                                className="club-join-item-button"
                                onClick={async () => {
                                  setJoining(true);
                                  setError('');
                                  const result = await joinClub(club.id);
                                  setJoining(false);
                                  
                                  if (result.success) {
                                    // 가입 성공 후 해당 클럽 선택
                                    await selectClub(club.id);
                                    setShowJoinModal(false);
                                  } else {
                                    setError(result.message || '클럽 가입에 실패했습니다.');
                                  }
                                }}
                                disabled={joining}
                              >
                                {joining ? '가입 중...' : '가입하기'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {error && <div className="club-create-error">{error}</div>}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClubSelector;
