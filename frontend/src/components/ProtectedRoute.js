import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';

const ProtectedRoute = ({ children, requiredRole = 'user' }) => {
  const { isAuthenticated, hasRole, user, loading } = useAuth();
  const { isAdmin: isClubAdmin, loading: clubLoading } = useClub();
  const location = useLocation();

  if (loading || clubLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>로딩 중...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // 로그인하지 않은 사용자는 로그인 페이지로 리다이렉트
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 슈퍼관리자는 모든 페이지 접근 가능
  const isSuperAdmin = user && user.role === 'super_admin';

  // requiredRole이 'admin'인 경우, 시스템 admin 또는 클럽 admin 모두 허용
  if (requiredRole === 'admin') {
    const hasSystemAdminRole = hasRole('admin');
    const hasClubAdminRole = isClubAdmin;

    console.log('ProtectedRoute: Admin check', {
      path: location.pathname,
      userRole: user?.role,
      isSuperAdmin,
      hasSystemAdminRole,
      hasClubAdminRole,
      shouldAllow: hasSystemAdminRole || hasClubAdminRole || isSuperAdmin,
    });

    if (!hasSystemAdminRole && !hasClubAdminRole && !isSuperAdmin) {
      // 권한이 없는 사용자는 Landing 페이지로 리다이렉트
      console.log('ProtectedRoute: Redirecting to landing - no admin access');
      return <Navigate to="/" replace />;
    }
  } else {
    // 'user' 역할 체크는 기존 로직 유지
    if (!hasRole(requiredRole) && !isSuperAdmin) {
      // 권한이 없는 사용자는 Landing 페이지로 리다이렉트
      return <Navigate to="/" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
