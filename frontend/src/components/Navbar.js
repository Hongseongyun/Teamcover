import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasRole, isAuthenticated } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

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

    const pagePermissions = {
      '/members': hasRole('admin'),
      '/scores': hasRole('user'),
      '/points': hasRole('user'),
      '/payments': hasRole('admin'),
      '/team-assignment': hasRole('admin'),
      '/user-management': hasRole('super_admin'),
    };

    return pagePermissions[page] || false;
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
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
          Teamcover
        </Link>

        {isAuthenticated && (
          <ul className={`navbar-nav ${showMobileMenu ? 'mobile-active' : ''}`}>
            {canAccessPage('/members') && (
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
            {canAccessPage('/scores') && (
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
            {canAccessPage('/points') && (
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
            {canAccessPage('/payments') && (
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
            {canAccessPage('/team-assignment') && (
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
            {hasRole('super_admin') && (
              <li className="nav-item">
                <Link
                  to="/user-management"
                  className={`nav-link ${isActive('/user-management')}`}
                  onClick={() => setShowMobileMenu(false)}
                >
                  사용자 관리
                </Link>
              </li>
            )}
          </ul>
        )}

        <div className="navbar-actions">
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
