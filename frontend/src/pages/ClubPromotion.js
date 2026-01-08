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

  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    loadClubs();
  }, []);

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

  const handleClubClick = (clubId) => {
    navigate(`/clubs/promotion/${clubId}`);
  };

  const handleCreateClub = () => {
    navigate('/clubs/promotion/create');
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
        {isSuperAdmin && (
          <button
            className="btn-create-club"
            onClick={handleCreateClub}
          >
            클럽 추가
          </button>
        )}
      </div>

      <div className="club-list">
        {clubs.length === 0 ? (
          <div className="empty-message">등록된 클럽이 없습니다.</div>
        ) : (
          clubs.map((club) => (
            <div
              key={club.id}
              className="club-card"
              onClick={() => handleClubClick(club.id)}
            >
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
          ))
        )}
      </div>
    </div>
  );
};

export default ClubPromotion;

