import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // 토큰이 있으면 사용자 정보 가져오기
  useEffect(() => {
    const getCurrentUser = async () => {
      if (token) {
        try {
          const response = await authAPI.getCurrentUser();
          if (response.data.success) {
            setUser(response.data.user);
          } else {
            // 토큰이 유효하지 않으면 제거
            localStorage.removeItem('token');
            setToken(null);
          }
        } catch (error) {
          console.error('사용자 정보 조회 실패:', error);
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      setLoading(false);
    };

    getCurrentUser();
  }, [token]);

  // 로그인
  const login = async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });
      if (response.data.success) {
        const { user: userData, access_token } = response.data;
        setUser(userData);
        setToken(access_token);
        localStorage.setItem('token', access_token);

        // 개인정보 접근 토큰 삭제 (새로운 로그인 시 이전 토큰 무효화)
        localStorage.removeItem('privacy_token');

        return { success: true, message: response.data.message };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || '로그인에 실패했습니다.',
      };
    }
  };

  // 구글 로그인 (JWT 토큰을 직접 처리)
  const googleLogin = async (jwtToken) => {
    try {
      // JWT 토큰을 사용하여 사용자 정보 가져오기
      const response = await authAPI.getCurrentUser();

      if (response.data.success) {
        const userData = response.data.user;
        setUser(userData);
        setToken(jwtToken);
        localStorage.setItem('token', jwtToken);
        return { success: true, message: '구글 로그인이 완료되었습니다.' };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || '구글 로그인에 실패했습니다.',
      };
    }
  };

  // 회원가입
  const register = async (
    email,
    name,
    password,
    passwordConfirm,
    role = 'user'
  ) => {
    try {
      const response = await authAPI.register({
        email,
        name,
        password,
        password_confirm: passwordConfirm,
        role,
      });
      if (response.data.success) {
        return {
          success: true,
          message: response.data.message,
          data: response.data.data, // data 객체 전달
        };
      } else {
        return {
          success: false,
          message: response.data.message,
          data: response.data.data, // data 객체 전달
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || '회원가입에 실패했습니다.',
      };
    }
  };

  // 로그아웃
  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('로그아웃 실패:', error);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('token');
    }
  };

  // 권한 확인
  const hasRole = (requiredRole) => {
    if (!user) return false;

    const roleHierarchy = {
      user: 1,
      admin: 2,
      super_admin: 3,
    };

    return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
  };

  // 페이지 접근 권한 확인
  const canAccessPage = (page) => {
    if (!user) return false;

    const pagePermissions = {
      '/': true, // 랜딩 페이지는 모든 사용자 접근 가능
      '/members': hasRole('admin'), // 운영진만 접근 가능
      '/scores': hasRole('user'), // 일반 사용자 이상 접근 가능
      '/points': hasRole('user'), // 일반 사용자 이상 접근 가능
      '/team-assignment': hasRole('admin'), // 운영진만 접근 가능
    };

    return pagePermissions[page] || false;
  };

  const value = {
    user,
    loading,
    setUser,
    setToken,
    login,
    googleLogin,
    register,
    logout,
    hasRole,
    canAccessPage,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
