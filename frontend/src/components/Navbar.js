import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useClub } from '../contexts/ClubContext';
import { clubAPI, inquiryAPI } from '../services/api';
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
  const [unreadInquiryCount, setUnreadInquiryCount] = useState(0);
  const [openDropdown, setOpenDropdown] = useState(null); // 'club', 'board', null

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

  // 새로운 문의 확인 (운영진 및 슈퍼관리자)
  useEffect(() => {
    const shouldCheckInquiries = () => {
      if (!isAuthenticated || !user) return false;
      // 슈퍼관리자 또는 클럽 운영진인 경우
      return user.role === 'super_admin' || isClubAdmin;
    };

    if (shouldCheckInquiries()) {
      loadUnreadInquiryCount();
      // 30초마다 새로운 문의 확인
      const interval = setInterval(() => {
        loadUnreadInquiryCount();
      }, 30000);

      // 문의 페이지에서 문의를 확인했을 때 갱신
      const handleInquiryUpdate = () => {
        loadUnreadInquiryCount();
      };

      window.addEventListener('inquiryUpdated', handleInquiryUpdate);

      return () => {
        clearInterval(interval);
        window.removeEventListener('inquiryUpdated', handleInquiryUpdate);
      };
    } else {
      setUnreadInquiryCount(0);
    }
  }, [user, isAuthenticated, isClubAdmin, currentClub]);

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

  const loadUnreadInquiryCount = async () => {
    try {
      const response = await inquiryAPI.getUnreadCount();
      if (response.data.success) {
        setUnreadInquiryCount(response.data.unread_count || 0);
      }
    } catch (error) {
      console.error('새로운 문의 개수 로드 실패:', error);
    }
  };

  const isActive = (path) => {
    // 정확한 경로 매칭
    if (location.pathname === path) return 'active';
    // 클럽 홍보 관리 페이지는 동적 경로이므로 포함 여부로 확인
    if (
      path.includes('/clubs/promotion/') &&
      location.pathname.startsWith('/clubs/promotion/')
    ) {
      return 'active';
    }
    return '';
  };

  const isParentActive = (paths) => {
    return paths.some((path) => {
      if (location.pathname === path) return true;
      if (
        path.includes('/clubs/promotion/') &&
        location.pathname.startsWith('/clubs/promotion/')
      ) {
        return true;
      }
      return false;
    });
  };

  const handleDropdownToggle = (menu) => {
    setOpenDropdown(openDropdown === menu ? null : menu);
  };

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.nav-item-dropdown')) {
        setOpenDropdown(null);
      }
    };

    if (openDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openDropdown]);

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
      '/inquiry': hasRole('user') || hasRole('admin'), // 일반 사용자 및 운영진
      '/schedules': hasRole('user'), // 일반 사용자
      '/club-promotion': isAdminForCurrentClub, // 클럽 홍보 관리 (운영진만)
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
            {/* 클럽관리 드롭다운 */}
            {currentClub && (
              <li className="nav-item nav-item-dropdown">
                <button
                  className={`nav-link nav-link-dropdown ${
                    isParentActive([
                      '/scores',
                      '/points',
                      '/schedules',
                      '/payments',
                      `/clubs/promotion/${currentClub.id}`,
                    ])
                      ? 'active'
                      : ''
                  }`}
                  onClick={() => handleDropdownToggle('club')}
                >
                  클럽관리
                  <span className={`dropdown-arrow ${openDropdown === 'club' ? 'rotated' : ''}`}>
                    ▼
                  </span>
                </button>
                {openDropdown === 'club' && (
                  <ul className="nav-dropdown-menu">
                    {canAccessPage('/scores') && (
                      <li>
                        <Link
                          to="/scores"
                          className={`nav-dropdown-link ${isActive('/scores')}`}
                          onClick={() => {
                            setShowMobileMenu(false);
                            setOpenDropdown(null);
                          }}
                        >
                          스코어
                        </Link>
                      </li>
                    )}
                    {canAccessPage('/points') &&
                      currentClub?.is_points_enabled && (
                        <li>
                          <Link
                            to="/points"
                            className={`nav-dropdown-link ${isActive('/points')}`}
                            onClick={() => {
                              setShowMobileMenu(false);
                              setOpenDropdown(null);
                            }}
                          >
                            포인트
                          </Link>
                        </li>
                      )}
                    {canAccessPage('/schedules') && (
                      <li>
                        <Link
                          to="/schedules"
                          className={`nav-dropdown-link ${isActive('/schedules')}`}
                          onClick={() => {
                            setShowMobileMenu(false);
                            setOpenDropdown(null);
                          }}
                        >
                          캘린더
                        </Link>
                      </li>
                    )}
                    {canAccessPage('/payments') && (
                      <li>
                        <Link
                          to="/payments"
                          className={`nav-dropdown-link ${isActive('/payments')}`}
                          onClick={() => {
                            setShowMobileMenu(false);
                            setOpenDropdown(null);
                          }}
                        >
                          회비관리
                        </Link>
                      </li>
                    )}
                    {canAccessPage('/club-promotion') && (
                      <li>
                        <Link
                          to={`/clubs/promotion/${currentClub.id}`}
                          className={`nav-dropdown-link ${isActive(
                            `/clubs/promotion/${currentClub.id}`
                          )}`}
                          onClick={() => {
                            setShowMobileMenu(false);
                            setOpenDropdown(null);
                          }}
                        >
                          클럽 홍보 관리
                        </Link>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            )}

            {/* 게시판 드롭다운 */}
            {(currentClub || hasRole('super_admin')) && (
              <li className="nav-item nav-item-dropdown">
                <button
                  className={`nav-link nav-link-dropdown ${
                    isParentActive(['/board', '/inquiry']) ? 'active' : ''
                  }`}
                  onClick={() => handleDropdownToggle('board')}
                >
                  게시판
                  <span className={`dropdown-arrow ${openDropdown === 'board' ? 'rotated' : ''}`}>
                    ▼
                  </span>
                </button>
                {openDropdown === 'board' && (
                  <ul className="nav-dropdown-menu">
                    {canAccessPage('/board') && (
                      <li>
                        <Link
                          to="/board"
                          className={`nav-dropdown-link ${isActive('/board')}`}
                          onClick={() => {
                            setShowMobileMenu(false);
                            setOpenDropdown(null);
                          }}
                        >
                          공지
                        </Link>
                      </li>
                    )}
                    {canAccessPage('/inquiry') && (
                      <li>
                        <Link
                          to="/inquiry"
                          className={`nav-dropdown-link ${isActive('/inquiry')} ${
                            unreadInquiryCount > 0 ? 'has-notification' : ''
                          }`}
                          onClick={() => {
                            setShowMobileMenu(false);
                            setOpenDropdown(null);
                          }}
                        >
                          문의하기
                          {unreadInquiryCount > 0 && (
                            <span className="notification-badge">
                              {unreadInquiryCount}
                            </span>
                          )}
                        </Link>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            )}

            {/* 팀 배정 (드롭다운 없음) */}
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
                <span className="user-role">
                  (
                  {user?.role === 'super_admin'
                    ? 'super_admin'
                    : isClubAdmin
                    ? 'admin'
                    : user?.role}
                  )
                </span>
                <span
                  className={`dropdown-arrow ${showUserMenu ? 'rotated' : ''}`}
                >
                  ▲
                </span>
              </button>

              {showUserMenu && (
                <div className="user-dropdown">
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
