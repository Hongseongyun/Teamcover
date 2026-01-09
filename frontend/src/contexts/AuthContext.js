import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { authAPI, messageAPI, inquiryAPI } from '../services/api';
import { getFCMToken, setupMessageListener } from '../config/firebase';

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
  // sessionStorage 사용 (창을 닫으면 자동으로 삭제됨)
  const [token, setToken] = useState(sessionStorage.getItem('token'));
  const lastUnreadCountRef = useRef(0);
  const lastUnreadInquiryCountRef = useRef(0);

  // 창을 닫을 때 토큰 제거 (추가 안전장치)
  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.removeItem('token');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // FCM 토큰 등록 함수
  const registerFCMToken = async () => {
    try {
      const fcmToken = await getFCMToken();
      if (fcmToken) {
        await authAPI.registerFcmToken({ fcm_token: fcmToken });
      }
    } catch (error) {
      console.error('FCM 토큰 등록 실패:', error);
    }
  };

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
        sessionStorage.setItem('token', access_token);

        // 개인정보 접근 토큰 삭제 (새로운 로그인 시 이전 토큰 무효화)
        localStorage.removeItem('privacy_token');

        // FCM 토큰 등록
        registerFCMToken();

        return {
          success: true,
          message: response.data.message,
          has_active_session: has_active_session || false,
          pending_approval: response.data.pending_approval || false,
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
        sessionStorage.setItem('token', jwtToken);
        
        // FCM 토큰 등록
        registerFCMToken();
        
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
      sessionStorage.removeItem('token');
    }
  };

  // 토큰이 있으면 사용자 정보 가져오기
  useEffect(() => {
    const getCurrentUser = async () => {
      if (token) {
        try {
          const response = await authAPI.getCurrentUser();
          if (response.data.success) {
            const userData = response.data.user;
            setUser(userData);
            
            // 슈퍼관리자가 아니고, 승인된 클럽이 없는 경우 승인 대기 상태 확인
            // alert는 제거하고 조용히 로그아웃 처리 (구글 로그인 콜백에서 모달로 처리)
            if (userData.role !== 'super_admin' && (!userData.clubs || userData.clubs.length === 0)) {
              // 승인 대기 중인 사용자는 로그아웃 처리
              await logout();
              return;
            }
            
            // FCM 토큰 등록
            registerFCMToken();
          } else {
            // 토큰이 유효하지 않으면 제거
            sessionStorage.removeItem('token');
            setToken(null);
          }
        } catch (error) {
          console.error('사용자 정보 조회 실패:', error);
          sessionStorage.removeItem('token');
          setToken(null);
        }
      }
      setLoading(false);
    };

    getCurrentUser();
  }, [token]);

  // 포그라운드 메시지 수신 처리
  useEffect(() => {
    if (!token || !user) return;

    const cleanup = setupMessageListener((payload) => {
      if (payload) {
        // 푸시 알림 표시
        if (window.showPushNotification) {
          const notification = payload.notification || {};
          const data = payload.data || {};
          
          let onClick = null;
          let notificationType = 'info';
          
          // 메시지 타입인 경우 메시지 모달 열기 (FloatingMessageButton)
          if (data.type === 'message') {
            notificationType = 'info';
            onClick = () => {
              // FloatingMessageButton의 메시지 모달을 열기 위한 이벤트 발생
              window.dispatchEvent(new CustomEvent('openMessageModal'));
            };
          }
          // 문의 타입인 경우 문의 페이지로 이동
          else if (data.type === 'inquiry') {
            notificationType = 'warning';
            onClick = () => {
              window.location.href = '/inquiry';
            };
          }
          
          window.showPushNotification({
            type: notificationType,
            title: notification.title || '알림',
            body: notification.body || '',
            onClick,
            duration: 5000,
          });
        }
      }
    });

    return cleanup;
  }, [token, user]);

  // 주기적으로 읽지 않은 메시지 확인 및 알림 표시
  useEffect(() => {
    if (!token || !user) return;

    let intervalId = null;
    let timeoutId = null;
    let isFirstCheck = true; // 첫 번째 확인인지 여부
    let hasShownInitialNotification = false; // 초기 알림 표시 여부

    const checkUnreadMessages = async () => {
      try {
        const response = await messageAPI.getUnreadCount();
        if (response.data.success) {
          const currentCount = response.data.count || 0;
          const previousCount = lastUnreadCountRef.current;

          // 첫 번째 확인이 아니고, 새로운 메시지가 있는 경우 알림 표시
          if (!isFirstCheck && currentCount > previousCount && previousCount >= 0) {
            const newMessagesCount = currentCount - previousCount;
            if (window.showPushNotification && newMessagesCount > 0) {
              window.showPushNotification({
                type: 'info',
                title: '새로운 메시지',
                body: `읽지 않은 메시지 ${newMessagesCount}개가 있습니다.`,
                onClick: () => {
                  // FloatingMessageButton의 메시지 모달을 열기 위한 이벤트 발생
                  window.dispatchEvent(new CustomEvent('openMessageModal'));
                },
                duration: 5000,
              });
            }
          }
          // 첫 번째 확인이고 읽지 않은 메시지가 있는 경우 알림 표시 (한 번만)
          else if (isFirstCheck && currentCount > 0 && !hasShownInitialNotification) {
            if (window.showPushNotification) {
              window.showPushNotification({
                type: 'info',
                title: '읽지 않은 메시지',
                body: `읽지 않은 메시지 ${currentCount}개가 있습니다.`,
                onClick: () => {
                  // FloatingMessageButton의 메시지 모달을 열기 위한 이벤트 발생
                  window.dispatchEvent(new CustomEvent('openMessageModal'));
                },
                duration: 5000,
              });
              hasShownInitialNotification = true;
            }
            isFirstCheck = false;
          }
          else if (isFirstCheck) {
            isFirstCheck = false;
          }

          lastUnreadCountRef.current = currentCount;
        }
      } catch (error) {
        console.error('읽지 않은 메시지 확인 실패:', error);
      }
    };

    // 초기 확인 (약간의 지연을 두어 FCM 토큰 등록 후 실행)
    timeoutId = setTimeout(() => {
      checkUnreadMessages();
    }, 2000);

    // 30초마다 확인
    intervalId = setInterval(checkUnreadMessages, 30000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [token, user]);

  // 주기적으로 읽지 않은 문의 확인 및 알림 표시 (운영진/슈퍼관리자용)
  useEffect(() => {
    if (!token || !user) return;
    
    // 모든 사용자에 대해 확인 (백엔드 API가 권한을 체크)
    // 슈퍼관리자, 시스템 admin, 클럽 운영진 모두 확인
    // 백엔드에서 권한이 없는 사용자는 0을 반환하므로 안전합니다.

    let intervalId = null;
    let timeoutId = null;
    let isFirstCheck = true;
    let hasShownInitialNotification = false; // 초기 알림 표시 여부

    const checkUnreadInquiries = async () => {
      try {
        const response = await inquiryAPI.getUnreadCount();
        if (response.data.success) {
          const currentCount = response.data.unread_count || 0;
          const previousCount = lastUnreadInquiryCountRef.current;

          // 첫 번째 확인이 아니고, 새로운 문의가 있는 경우 알림 표시
          if (!isFirstCheck && currentCount > previousCount && previousCount >= 0) {
            const newInquiriesCount = currentCount - previousCount;
            if (window.showPushNotification && newInquiriesCount > 0) {
              window.showPushNotification({
                type: 'warning',
                title: '새로운 문의',
                body: `답변이 필요한 문의 ${newInquiriesCount}개가 있습니다.`,
                onClick: () => {
                  window.location.href = '/inquiry';
                },
                duration: 5000,
              });
            }
          }
          // 첫 번째 확인이고 읽지 않은 문의가 있는 경우 알림 표시 (한 번만)
          else if (isFirstCheck && currentCount > 0 && !hasShownInitialNotification) {
            if (window.showPushNotification) {
              window.showPushNotification({
                type: 'warning',
                title: '답변이 필요한 문의',
                body: `답변이 필요한 문의 ${currentCount}개가 있습니다.`,
                onClick: () => {
                  window.location.href = '/inquiry';
                },
                duration: 5000,
              });
              hasShownInitialNotification = true;
            }
            isFirstCheck = false;
          }
          else if (isFirstCheck) {
            isFirstCheck = false;
          }

          lastUnreadInquiryCountRef.current = currentCount;
        }
      } catch (error) {
        console.error('읽지 않은 문의 확인 실패:', error);
      }
    };

    // 초기 확인 (약간의 지연을 두어 FCM 토큰 등록 후 실행)
    timeoutId = setTimeout(() => {
      checkUnreadInquiries();
    }, 2500);

    // 30초마다 확인
    intervalId = setInterval(checkUnreadInquiries, 30000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [token, user]);

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
