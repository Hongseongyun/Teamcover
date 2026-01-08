import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clubAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import './ClubPromotion.css';

const ClubPromotion = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [favoriteClubIds, setFavoriteClubIds] = useState(new Set());
  const [isRegisteredUser, setIsRegisteredUser] = useState(false); // 회원가입된 유저 여부

  useEffect(() => {
    loadClubs();
    if (user) {
      // 회원가입된 유저인지 확인 (슈퍼관리자이거나 승인된 클럽에 가입된 유저)
      const hasApprovedClubs = user?.clubs && user.clubs.length > 0;
      const isSuperAdmin = user?.role === 'super_admin';
      setIsRegisteredUser(isSuperAdmin || hasApprovedClubs);
      
      if (isSuperAdmin || hasApprovedClubs) {
        loadFavoriteClubs();
      }
    } else {
      setIsRegisteredUser(false);
    }
  }, [user]);

  const loadClubs = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await clubAPI.getPromotionClubs();
      if (response.data.success) {
        setClubs(response.data.clubs);
      } else {
        setError('클럽 목록을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      console.error('클럽 목록 로드 실패:', err);
      setError('클럽 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadFavoriteClubs = async () => {
    try {
      const response = await clubAPI.getFavoriteClubs();
      if (response.data.success) {
        setFavoriteClubIds(new Set(response.data.favorite_club_ids || []));
      }
    } catch (err) {
      // 401 에러는 로그인하지 않은 상태이므로 무시
      if (err.response?.status !== 401) {
        console.error('즐겨찾기 목록 로드 실패:', err);
      }
    }
  };

  const handleToggleFavorite = async (e, clubId) => {
    e.stopPropagation(); // 카드 클릭 이벤트 방지
    
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    
    if (!isRegisteredUser) {
      alert('클럽에 가입된 회원만 즐겨찾기를 사용할 수 있습니다.');
      return;
    }

    try {
      const isFavorite = favoriteClubIds.has(clubId);
      
      if (isFavorite) {
        // 즐겨찾기 제거
        await clubAPI.removeClubFavorite(clubId);
        setFavoriteClubIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(clubId);
          return newSet;
        });
        // 클럽 목록 업데이트
        setClubs((prevClubs) =>
          prevClubs.map((club) =>
            club.id === clubId ? { ...club, is_favorite: false } : club
          )
        );
      } else {
        // 즐겨찾기 추가
        await clubAPI.toggleClubFavorite(clubId);
        setFavoriteClubIds((prev) => new Set([...prev, clubId]));
        // 클럽 목록 업데이트
        setClubs((prevClubs) =>
          prevClubs.map((club) =>
            club.id === clubId ? { ...club, is_favorite: true } : club
          )
        );
      }
    } catch (err) {
      console.error('즐겨찾기 처리 실패:', err);
      if (err.response?.status === 401) {
        alert('로그인이 필요합니다. 로그인 후 다시 시도해주세요.');
        // 로그인 페이지로 리다이렉트할 수도 있습니다
        // navigate('/login');
      } else {
        alert('즐겨찾기 처리에 실패했습니다.');
      }
    }
  };

  const handleClubClick = (clubId) => {
    navigate(`/clubs/promotion/${clubId}`);
  };

  if (loading) {
    return (
      <div className="club-promotion-container">
        <div className="loading-message">클럽 목록을 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="club-promotion-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="club-promotion-container" data-theme={theme}>
      <div className="club-promotion-header">
        <h1>클럽 홍보</h1>
        <p className="club-promotion-subtitle">
          다양한 볼링 클럽을 둘러보고 가입해보세요
        </p>
      </div>

      <div className="club-list">
        {clubs.length === 0 ? (
          <div className="empty-message">등록된 클럽이 없습니다.</div>
        ) : (
          [...clubs]
            .sort((a, b) => {
              // 즐겨찾기 우선 정렬
              const aIsFavorite = favoriteClubIds.has(a.id) || a.is_favorite;
              const bIsFavorite = favoriteClubIds.has(b.id) || b.is_favorite;
              if (aIsFavorite && !bIsFavorite) return -1;
              if (!aIsFavorite && bIsFavorite) return 1;
              return 0; // 같은 즐겨찾기 상태면 원래 순서 유지
            })
            .map((club) => {
              const isFavorite = favoriteClubIds.has(club.id) || club.is_favorite;
              return (
                <div
                  key={club.id}
                  className="club-card"
                  onClick={() => handleClubClick(club.id)}
                >
                  {/* 즐겨찾기 버튼 (회원가입된 유저만 표시) */}
                  {isRegisteredUser && (
                    <button
                      className={`club-favorite-btn ${isFavorite ? 'active' : ''}`}
                      onClick={(e) => handleToggleFavorite(e, club.id)}
                      title={isFavorite ? '즐겨찾기 제거' : '즐겨찾기 추가'}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill={isFavorite ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                  )}
                  {club.image_url ? (
                    <div
                      className="club-image"
                      style={{
                        backgroundImage: `url(${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${club.image_url})`,
                      }}
                    />
                  ) : (
                    <div className="club-image-placeholder">
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
                  <div className="club-info">
                <div className="club-name-wrapper">
                  <h3 className="club-name">{club.name}</h3>
                  <span className="club-member-count">{club.member_count}명</span>
                </div>
                <p className="club-description">
                  {club.description || '설명이 없습니다.'}
                </p>
                {club.hashtags && club.hashtags.length > 0 && (
                  <div className="club-hashtags">
                    {club.hashtags.map((tag, index) => (
                      <span key={index} className="club-hashtag-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
            })
        )}
      </div>
    </div>
  );
};

export default ClubPromotion;

