import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requiredRole = 'user' }) => {
  const { isAuthenticated, hasRole, loading } = useAuth();
  const location = useLocation();

  if (loading) {
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

  if (!hasRole(requiredRole)) {
    // 권한이 없는 사용자는 홈으로 리다이렉트
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
