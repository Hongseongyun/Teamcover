import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clubAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import './ClubDetail.css';
import './Members.css'; // action-menu 스타일 사용

const ClubDetail = () => {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  // 편집용 상태
  const [promotionDescription, setPromotionDescription] = useState('');
  const [hashtags, setHashtags] = useState([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [userClubRole, setUserClubRole] = useState(null);
  
  // 섹션별 편집 상태
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [showHashtagAddForm, setShowHashtagAddForm] = useState(false);
  const [isHashtagDeleteMode, setIsHashtagDeleteMode] = useState(false);
  const [openDescriptionMenu, setOpenDescriptionMenu] = useState(false);
  const [openHashtagMenu, setOpenHashtagMenu] = useState(false);
  const [joinRequestStatus, setJoinRequestStatus] = useState(null); // 'pending', 'approved', null
  const [joining, setJoining] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = isSuperAdmin || (userClubRole && ['admin', 'owner'].includes(userClubRole));
  const isMember = !!userClubRole; // 이미 가입한 사용자
  const canJoin = !isSuperAdmin && !isMember; // 가입 가능한 사용자 (로그인 여부와 무관)

  useEffect(() => {
    if (clubId) {
      loadClubDetail();
      if (user) {
        loadUserClubRole();
      }
    }
  }, [clubId, user]);

  const loadClubDetail = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await clubAPI.getPromotionClubDetail(clubId);
      if (response.data.success) {
        const clubData = response.data.club;
        setClub(clubData);
        setPromotionDescription(clubData.promotion_description || '');
        setHashtags(clubData.hashtags || []);
        
        // 사용자 가입 상태 설정
        if (clubData.user_membership_status) {
          setJoinRequestStatus(clubData.user_membership_status);
        }
        if (clubData.user_membership_role) {
          setUserClubRole(clubData.user_membership_role);
        }
      } else {
        setError('클럽 정보를 불러오는데 실패했습니다.');
      }
    } catch (err) {
      console.error('클럽 상세 정보 로드 실패:', err);
      setError('클럽 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadUserClubRole = async () => {
    if (!user) return;
    try {
      const response = await clubAPI.getUserClubs();
      if (response.data.success) {
        const clubs = response.data.clubs || [];
        const userClub = clubs.find((c) => c.id === parseInt(clubId));
        if (userClub) {
          setUserClubRole(userClub.role);
          setJoinRequestStatus(userClub.status || 'approved'); // 'approved', 'pending', 'rejected'
        } else {
          // 가입하지 않은 경우, 가입 요청 상태 확인
          // 백엔드에서 클럽 상세 정보를 가져올 때 현재 사용자의 가입 상태도 함께 반환하도록 수정 필요
          // 일단 null로 설정
          setJoinRequestStatus(null);
        }
      }
    } catch (err) {
      console.error('사용자 클럽 역할 로드 실패:', err);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('이미지 크기는 5MB 이하여야 합니다.');
      return;
    }

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('image', file);

      const response = await clubAPI.uploadClubImage(clubId, formData);
      if (response.data.success) {
        await loadClubDetail(); // 클럽 정보 다시 로드
        alert('이미지가 업로드되었습니다.');
      } else {
        alert(response.data.message || '이미지 업로드에 실패했습니다.');
      }
    } catch (err) {
      console.error('이미지 업로드 실패:', err);
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddHashtag = () => {
    // 입력값에서 앞뒤 공백 제거 및 # 제거 (이미 #이 있어도 제거 후 다시 붙임)
    const tag = hashtagInput.trim().replace(/^#+/, '').trim();
    if (tag) {
      const hashtag = `#${tag}`;
      // 중복 체크 (대소문자 구분 없이)
      const isDuplicate = hashtags.some(
        (existingTag) => existingTag.toLowerCase() === hashtag.toLowerCase()
      );
      if (!isDuplicate) {
        setHashtags([...hashtags, hashtag]);
        setHashtagInput('');
      } else {
        alert('이미 추가된 해시태그입니다.');
      }
    }
  };

  const handleRemoveHashtag = (tagToRemove) => {
    setHashtags(hashtags.filter((tag) => tag !== tagToRemove));
  };

  const handleSaveDescription = async () => {
    try {
      setSaving(true);
      const response = await clubAPI.updatePromotionClubDetail(clubId, {
        promotion_description: promotionDescription,
        hashtags: club.hashtags || [], // 해시태그는 그대로 유지
      });

      if (response.data.success) {
        await loadClubDetail();
        setIsEditingDescription(false);
        alert('클럽 설명이 업데이트되었습니다.');
      } else {
        alert(response.data.message || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('저장 실패:', err);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelDescription = () => {
    if (club) {
      setPromotionDescription(club.promotion_description || '');
    }
    setIsEditingDescription(false);
  };

  const handleSaveHashtags = async () => {
    try {
      setSaving(true);
      const response = await clubAPI.updatePromotionClubDetail(clubId, {
        promotion_description: club.promotion_description || '', // 설명은 그대로 유지
        hashtags: hashtags,
      });

      if (response.data.success) {
        await loadClubDetail();
        setShowHashtagAddForm(false);
        setIsHashtagDeleteMode(false);
        setOpenHashtagMenu(false);
        alert('해시태그가 업데이트되었습니다.');
      } else {
        alert(response.data.message || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('저장 실패:', err);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelHashtags = () => {
    if (club) {
      setHashtags(club.hashtags || []);
    }
    setShowHashtagAddForm(false);
    setIsHashtagDeleteMode(false);
    setOpenHashtagMenu(false);
  };

  const handleJoinClub = async () => {
    // 로그인하지 않은 경우 회원가입 페이지로 이동
    if (!user) {
      navigate(`/login?club_id=${clubId}&mode=signup`);
      return;
    }
    
    // 이미 가입했거나 슈퍼관리자인 경우
    if (isSuperAdmin || isMember) return;
    
    try {
      setJoining(true);
      const response = await clubAPI.joinClub(clubId);
      if (response.data.success) {
        setJoinRequestStatus('pending');
        alert('클럽 가입 요청이 제출되었습니다. 슈퍼관리자의 승인을 기다려주세요.');
        // 가입 요청 후 사용자 클럽 역할 다시 로드
        await loadUserClubRole();
      } else {
        alert(response.data.message || '가입 신청에 실패했습니다.');
      }
    } catch (err) {
      console.error('가입 신청 실패:', err);
      alert('가입 신청에 실패했습니다.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="club-detail-container">
        <div className="loading-message">클럽 정보를 불러오는 중...</div>
      </div>
    );
  }

  if (error || !club) {
    return (
      <div className="club-detail-container">
        <div className="error-message">{error || '클럽 정보를 찾을 수 없습니다.'}</div>
        <button
          className="btn-back"
          onClick={() => navigate('/clubs/promotion')}
        >
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="club-detail-container" data-theme={theme}>
      <button
        className="btn-back"
        onClick={() => navigate('/clubs/promotion')}
      >
        ← 목록으로
      </button>

      <div className="club-detail-header">
        <div className="club-detail-image-section">
          {club.image_url ? (
            <div
              className="club-detail-image"
              style={{
                backgroundImage: `url(${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${club.image_url})`,
              }}
            />
          ) : (
            <div className="club-detail-image-placeholder">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="12" cy="12" r="10" fill="#e3f2fd" />
                <path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  stroke="#2196f3"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
          {isAdmin && (
            <div className="club-image-upload-section">
              <label className="btn-upload-image">
                {uploadingImage ? '업로드 중...' : '사진 변경'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                  disabled={uploadingImage}
                />
              </label>
            </div>
          )}
        </div>

        <div className="club-detail-info">
          <h1 className="club-detail-name">{club.name}</h1>
          <p className="club-detail-description">{club.description || '설명이 없습니다.'}</p>
          <div className="club-detail-meta">
            <span className="club-meta-item">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {club.member_count}명
            </span>
          </div>
        </div>
      </div>

      <div className="club-detail-content">
        <div className="club-detail-section">
          <div className="section-header">
            <h2>클럽 설명</h2>
            {isAdmin && !isEditingDescription && (
              <div className={`action-menu-container ${openDescriptionMenu ? 'menu-active' : ''}`}>
                <button
                  type="button"
                  className="btn btn-sm btn-menu-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenDescriptionMenu(!openDescriptionMenu);
                  }}
                  title="설정"
                >
                  <span className="menu-dots">
                    <span className="menu-dot"></span>
                    <span className="menu-dot"></span>
                    <span className="menu-dot"></span>
                  </span>
                </button>
                {openDescriptionMenu && (
                  <div className="action-menu-dropdown">
                    <button
                      type="button"
                      className="action-menu-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditingDescription(true);
                        setOpenDescriptionMenu(false);
                      }}
                    >
                      편집
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {isEditingDescription && isAdmin ? (
            <div className="section-editor">
              <textarea
                className="club-description-textarea"
                value={promotionDescription}
                onChange={(e) => setPromotionDescription(e.target.value)}
                placeholder="클럽에 대한 상세한 설명을 작성해주세요..."
                rows={8}
              />
              <div className="section-editor-actions">
                <button
                  className="btn-save"
                  onClick={handleSaveDescription}
                  disabled={saving}
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
                <button
                  className="btn-cancel"
                  onClick={handleCancelDescription}
                  disabled={saving}
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="club-description-display">
              {club.promotion_description || (
                <p className="empty-text">설명이 없습니다.</p>
              )}
            </div>
          )}
          
          {/* 클럽 가입 신청 버튼 (슈퍼관리자 제외, 이미 가입한 사용자 제외) */}
          {canJoin && (
            <div className="club-join-section">
              <button
                className="btn-join-club"
                onClick={handleJoinClub}
                disabled={joining || joinRequestStatus === 'pending'}
              >
                {joining
                  ? '신청 중...'
                  : joinRequestStatus === 'pending'
                  ? '가입 신청 완료 (승인 대기 중)'
                  : '클럽 가입 신청하기'}
              </button>
            </div>
          )}
        </div>

        {/* 해시태그 섹션 (운영자/슈퍼관리자만 볼 수 있음) */}
        {isAdmin && (
          <div className="club-detail-section">
            <div className="section-header">
              <h2>해시태그</h2>
            {isAdmin && !showHashtagAddForm && !isHashtagDeleteMode && (
              <div className={`action-menu-container ${openHashtagMenu ? 'menu-active' : ''}`}>
                <button
                  type="button"
                  className="btn btn-sm btn-menu-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenHashtagMenu(!openHashtagMenu);
                  }}
                  title="설정"
                >
                  <span className="menu-dots">
                    <span className="menu-dot"></span>
                    <span className="menu-dot"></span>
                    <span className="menu-dot"></span>
                  </span>
                </button>
                {openHashtagMenu && (
                  <div className="action-menu-dropdown">
                    <button
                      type="button"
                      className="action-menu-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowHashtagAddForm(true);
                        setOpenHashtagMenu(false);
                      }}
                    >
                      추가
                    </button>
                    <button
                      type="button"
                      className="action-menu-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsHashtagDeleteMode(true);
                        setOpenHashtagMenu(false);
                      }}
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {showHashtagAddForm && isAdmin ? (
            <div className="hashtag-editor">
              <div className="hashtag-input-group">
                <input
                  type="text"
                  className="hashtag-input"
                  value={hashtagInput}
                  onChange={(e) => {
                    const value = e.target.value.replace(/#/g, '');
                    setHashtagInput(value);
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddHashtag();
                    }
                  }}
                  placeholder="지역이름 또는 상주볼링장 입력 (자동으로 # 추가)"
                />
                <button
                  className="btn-add-hashtag"
                  onClick={handleAddHashtag}
                >
                  추가
                </button>
              </div>
              <div className="hashtag-list">
                {hashtags.map((tag, index) => (
                  <span key={index} className="hashtag-tag">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="section-editor-actions">
                <button
                  className="btn-save"
                  onClick={handleSaveHashtags}
                  disabled={saving}
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
                <button
                  className="btn-cancel"
                  onClick={handleCancelHashtags}
                  disabled={saving}
                >
                  취소
                </button>
              </div>
            </div>
          ) : isHashtagDeleteMode && isAdmin ? (
            <div className="hashtag-delete-mode">
              <div className="hashtag-list">
                {hashtags.map((tag, index) => (
                  <span key={index} className="hashtag-tag hashtag-tag-deletable">
                    {tag}
                    <button
                      className="hashtag-remove"
                      onClick={() => handleRemoveHashtag(tag)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="section-editor-actions">
                <button
                  className="btn-save"
                  onClick={handleSaveHashtags}
                  disabled={saving}
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
                <button
                  className="btn-cancel"
                  onClick={handleCancelHashtags}
                  disabled={saving}
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="hashtag-display">
              {club.hashtags && club.hashtags.length > 0 ? (
                club.hashtags.map((tag, index) => (
                  <span key={index} className="hashtag-tag">
                    {tag}
                  </span>
                ))
              ) : (
                <p className="empty-text">해시태그가 없습니다.</p>
              )}
            </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClubDetail;

