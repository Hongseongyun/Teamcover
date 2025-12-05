import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useClub } from '../contexts/ClubContext';
import { clubAPI, messageAPI } from '../services/api';
import ClubSelector from './ClubSelector';
import './Navbar.css';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasRole, isAuthenticated } = useAuth();
  const { currentClub, isAdmin: isClubAdmin } = useClub();
  const { theme, toggleTheme } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [joinRequestsCount, setJoinRequestsCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  useEffect(() => {
    if (user?.role === 'super_admin' && isAuthenticated) {
      loadJoinRequestsCount();
      // 30초마다 승인 요청 개수 갱신
      const interval = setInterval(() => {
        loadJoinRequestsCount();
      }, 30000);

      // 승인/거부 이벤트 리스너 추가
      const handleJoinRequestUpdate = () => {
        loadJoinRequestsCount();
      };

      window.addEventListener('joinRequestUpdated', handleJoinRequestUpdate);

      return () => {
        clearInterval(interval);
        window.removeEventListener(
          'joinRequestUpdated',
          handleJoinRequestUpdate
        );
      };
    }
  }, [user, isAuthenticated]);

  // 메세지 안 읽은 개수 로드 & 폴링
  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadMessagesCount(0);
      return;
    }

    const loadUnread = async () => {
      try {
        const res = await messageAPI.getUnreadCount();
        if (res.data.success) {
          setUnreadMessagesCount(res.data.count || 0);
        }
      } catch (e) {
        console.error('메세지 안 읽은 개수 로드 실패:', e);
      }
    };

    loadUnread();
    const interval = setInterval(loadUnread, 15000);

    const handleMessagesUpdated = () => {
      loadUnread();
    };

    window.addEventListener('messagesUpdated', handleMessagesUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('messagesUpdated', handleMessagesUpdated);
    };
  }, [isAuthenticated]);

  const loadJoinRequestsCount = async () => {
    try {
      const response = await clubAPI.getJoinRequestsCount();
      if (response.data.success) {
        setJoinRequestsCount(response.data.count || 0);
      }
    } catch (error) {
      console.error('승인 요청 개수 로드 실패:', error);
    }
  };

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setShowUserMenu(false);
  };

  const canAccessPage = (page) => {
    if (!isAuthenticated) return false;

    const isSuperAdmin = user?.role === 'super_admin';
    const isAdminForCurrentClub = isSuperAdmin || isClubAdmin;

    const pagePermissions = {
      // 클럽별 운영/관리 페이지는 "해당 클럽의 운영진 or 슈퍼관리자"만
      '/members': isAdminForCurrentClub,
      '/scores': hasRole('user'),
      '/points': hasRole('user'),
      '/payments': isAdminForCurrentClub,
      '/team-assignment': isAdminForCurrentClub,
      '/user-management': hasRole('super_admin'),
      '/board': hasRole('user'),
      '/messages': hasRole('user'),
    };

    return pagePermissions[page] || false;
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-left">
          {/* 햄버거 메뉴 버튼 (모바일) */}
          {isAuthenticated && (
            <button
              className="mobile-menu-button"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              aria-label="메뉴"
            >
              <span className={`hamburger ${showMobileMenu ? 'active' : ''}`}>
                <span></span>
                <span></span>
                <span></span>
              </span>
            </button>
          )}

          <Link to="/" className="navbar-brand">
            Bowlib
          </Link>

          {isAuthenticated && (
            <div className="navbar-club-selector">
              <ClubSelector />
            </div>
          )}
        </div>

        {/* 상단 메뉴는 로그인 + 클럽 선택 후에만 표시 (슈퍼관리자는 클럽 선택 없이도 사용자 관리 접근 가능) */}
        {isAuthenticated && (currentClub || hasRole('super_admin')) && (
          <ul className={`navbar-nav ${showMobileMenu ? 'mobile-active' : ''}`}>
            {canAccessPage('/members') && currentClub && (
              <li className="nav-item">
                <Link
                  to="/members"
                  className={`nav-link ${isActive('/members')}`}
                  onClick={() => setShowMobileMenu(false)}
                >
                  회원
                </Link>
              </li>
            )}
            {canAccessPage('/scores') && currentClub && (
              <li className="nav-item">
                <Link
                  to="/scores"
                  className={`nav-link ${isActive('/scores')}`}
                  onClick={() => setShowMobileMenu(false)}
                >
                  스코어
                </Link>
              </li>
            )}
            {canAccessPage('/points') &&
              currentClub &&
              currentClub?.is_points_enabled && (
                <li className="nav-item">
                  <Link
                    to="/points"
                    className={`nav-link ${isActive('/points')}`}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    포인트
                  </Link>
                </li>
              )}
            {canAccessPage('/board') && currentClub && (
              <li className="nav-item">
                <Link
                  to="/board"
                  className={`nav-link ${isActive('/board')}`}
                  onClick={() => setShowMobileMenu(false)}
                >
                  게시판
                </Link>
              </li>
            )}
            {canAccessPage('/messages') && (
              <li className="nav-item">
                <Link
                  to="/messages"
                  className={`nav-link ${isActive('/messages')} ${
                    unreadMessagesCount > 0 ? 'has-notification' : ''
                  }`}
                  onClick={() => setShowMobileMenu(false)}
                >
                  메세지
                  {unreadMessagesCount > 0 && (
                    <span className="notification-badge">
                      {unreadMessagesCount}
                    </span>
                  )}
                </Link>
              </li>
            )}
            {canAccessPage('/payments') && currentClub && (
              <li className="nav-item">
                <Link
                  to="/payments"
                  className={`nav-link ${isActive('/payments')}`}
                  onClick={() => setShowMobileMenu(false)}
                >
                  회비관리
                </Link>
              </li>
            )}
            {canAccessPage('/team-assignment') && currentClub && (
              <li className="nav-item">
                <Link
                  to="/team-assignment"
                  className={`nav-link ${isActive('/team-assignment')}`}
                  onClick={() => setShowMobileMenu(false)}
                >
                  팀 배정
                </Link>
              </li>
            )}
            {/* 슈퍼관리자는 클럽 선택 없이도 사용자 관리 접근 가능 */}
            {hasRole('super_admin') && (
              <li className="nav-item">
                <Link
                  to="/user-management"
                  className={`nav-link ${isActive('/user-management')} ${
                    joinRequestsCount > 0 ? 'has-notification' : ''
                  }`}
                  onClick={() => setShowMobileMenu(false)}
                >
                  사용자 관리
                  {joinRequestsCount > 0 && (
                    <span className="notification-badge">
                      {joinRequestsCount}
                    </span>
                  )}
                </Link>
              </li>
            )}
          </ul>
        )}

        <div className="navbar-actions">
          <button
            type="button"
            className="theme-toggle-button"
            onClick={toggleTheme}
            aria-label={
              theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'
            }
            title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>
          {isAuthenticated ? (
            <div className="user-menu">
              <button
                className="user-button"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <div className="user-avatar">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span className="user-name">{user?.name}</span>
                <span className="user-role">({user?.role})</span>
                <span
                  className={`dropdown-arrow ${showUserMenu ? 'rotated' : ''}`}
                >
                  ▲
                </span>
              </button>

              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="user-dropdown-header">
                    <div className="user-dropdown-avatar">
                      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className="user-dropdown-info">
                      <div className="user-dropdown-name">{user?.name}</div>
                      <div className="user-dropdown-email">{user?.email}</div>
                    </div>
                  </div>
                  <div className="user-dropdown-role">
                    <span className="role-icon">
                      {user?.role === 'super_admin'
                        ? '👑'
                        : user?.role === 'admin'
                        ? '⭐'
                        : '👤'}
                    </span>
                    <span className="role-text">
                      {user?.role === 'super_admin'
                        ? '슈퍼관리자'
                        : user?.role === 'admin'
                        ? '관리자'
                        : '사용자'}
                    </span>
                  </div>
                  <div className="dropdown-divider"></div>
                  <Link
                    to="/mypage"
                    className="dropdown-item"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <span className="mypage-icon">👤</span>
                    <span>마이페이지</span>
                  </Link>
                  <Link
                    to="/messages"
                    className="dropdown-item"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <span className="mypage-icon">💬</span>
                    <span>메세지</span>
                    {unreadMessagesCount > 0 && (
                      <span className="dropdown-badge">
                        {unreadMessagesCount}
                      </span>
                    )}
                  </Link>
                  <button
                    className="dropdown-item logout-item"
                    onClick={handleLogout}
                  >
                    <span className="logout-icon">🚪</span>
                    <span>로그아웃</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="auth-button login">
                로그인
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
