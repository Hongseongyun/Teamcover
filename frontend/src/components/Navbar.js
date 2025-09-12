import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasRole, isAuthenticated } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

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
      '/team-assignment': hasRole('admin'),
    };

    return pagePermissions[page] || false;
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          Teamcover
        </Link>

        {isAuthenticated && (
          <ul className="navbar-nav">
            {canAccessPage('/members') && (
              <li className="nav-item">
                <Link
                  to="/members"
                  className={`nav-link ${isActive('/members')}`}
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
                >
                  포인트
                </Link>
              </li>
            )}
            {canAccessPage('/team-assignment') && (
              <li className="nav-item">
                <Link
                  to="/team-assignment"
                  className={`nav-link ${isActive('/team-assignment')}`}
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
                <span className="dropdown-arrow">▼</span>
              </button>

              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="user-info">
                    <div className="user-email">{user?.email}</div>
                    <div className="user-role-badge">{user?.role}</div>
                  </div>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item" onClick={handleLogout}>
                    로그아웃
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
