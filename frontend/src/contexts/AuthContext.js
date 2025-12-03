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

  // 로그인
  const login = async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });
      if (response.data.success) {
        const {
          user: userData,
          access_token,
          has_active_session,
        } = response.data;
        setUser(userData);
        setToken(access_token);
        localStorage.setItem('token', access_token);

        // 개인정보 접근 토큰 삭제 (새로운 로그인 시 이전 토큰 무효화)
        localStorage.removeItem('privacy_token');

        return {
          success: true,
          message: response.data.message,
          has_active_session: has_active_session || false,
        };
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
    role = 'user',
    club_id = null
  ) => {
    try {
      const response = await authAPI.register({
        email,
        name,
        password,
        password_confirm: passwordConfirm,
        role,
        club_id,  // 선택한 클럽 ID
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

  // 10분 이상 아무 동작이 없으면 자동 로그아웃
  useEffect(() => {
    // 로그인 상태가 아니면 타이머를 설정할 필요 없음
    if (!token) return;

    const INACTIVITY_LIMIT = 10 * 60 * 1000; // 10분
    let timeoutId = null;

    const handleLogoutByInactivity = async () => {
      // 이미 로그아웃 중이더라도 에러 없이 동작하도록 try/catch
      try {
        await logout();
      } finally {
        // 로그인 페이지로 이동
        window.location.href = '/login';
      }
    };

    const resetTimer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(handleLogoutByInactivity, INACTIVITY_LIMIT);
    };

    // 사용자 활동 이벤트들
    const activityEvents = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer);
    });

    // 초기 타이머 설정
    resetTimer();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });
    };
  }, [token]);

  // 다른 기기에서 로그아웃
  const logoutOtherDevices = async () => {
    try {
      const response = await authAPI.logoutOtherDevices();
      if (response.data.success) {
        return { success: true, message: response.data.message };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      return {
        success: false,
        message:
          error.response?.data?.message || '다른 기기 로그아웃에 실패했습니다.',
      };
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

  // 사용자 정보 업데이트 함수
  const updateUser = (updatedUserData) => {
    setUser((prevUser) => ({
      ...prevUser,
      ...updatedUserData,
    }));
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
    logoutOtherDevices,
    hasRole,
    canAccessPage,
    updateUser,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
