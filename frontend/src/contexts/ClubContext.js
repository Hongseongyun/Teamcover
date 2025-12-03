import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { clubAPI } from '../services/api';
import { useAuth } from './AuthContext';

const ClubContext = createContext();

export const useClub = () => {
  const context = useContext(ClubContext);
  if (!context) {
    throw new Error('useClub must be used within a ClubProvider');
  }
  return context;
};

export const ClubProvider = ({ children }) => {
  const { user } = useAuth();
  const [clubs, setClubs] = useState([]);
  const [currentClub, setCurrentClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const lastTokenRef = useRef(null);
  const isSuperAdmin = user && user.role === 'super_admin';

  // 클럽 목록 로드
  const loadClubs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await clubAPI.getUserClubs();
      if (response.data.success) {
        const clubsData = response.data.clubs || [];
        setClubs(clubsData);

        // 저장된 클럽이 있으면 그 클럽을 우선 선택
        const savedClubId = localStorage.getItem('currentClubId');
        if (savedClubId) {
          const savedClub = clubsData.find(
            (c) => c.id === parseInt(savedClubId, 10)
          );
          if (savedClub) {
            setCurrentClub(savedClub);
            return;
          }
        }

        // 저장된 클럽이 없거나 유효하지 않으면 기본 클럽(Teamcover 우선) 자동 선택
        if (clubsData.length > 0) {
          selectDefaultClub(clubsData);
        } else {
          setCurrentClub(null);
        }
      }
    } catch (error) {
      console.error('클럽 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 기본 클럽 선택 (Teamcover 우선)
  const selectDefaultClub = useCallback(async (clubs) => {
    if (clubs.length === 0) return;

    // Teamcover 클럽을 우선적으로 찾기
    const teamcoverClub = clubs.find((c) => c.name === 'Teamcover');
    const clubToSelect = teamcoverClub || clubs[0];

    if (clubToSelect) {
      // 클럽 선택 API 호출하여 서버에 알림
      try {
        await clubAPI.selectClub(clubToSelect.id);
        setCurrentClub(clubToSelect);
        localStorage.setItem('currentClubId', clubToSelect.id.toString());
      } catch (error) {
        console.error('기본 클럽 선택 실패:', error);
        // API 호출 실패해도 로컬에 저장하여 헤더에 포함되도록 함
        setCurrentClub(clubToSelect);
        localStorage.setItem('currentClubId', clubToSelect.id.toString());
      }
    }
  }, []);

  // 클럽 선택
  const selectClub = async (clubId) => {
    try {
      const response = await clubAPI.selectClub(clubId);
      if (response.data.success) {
        setCurrentClub(response.data.club);
        localStorage.setItem('currentClubId', clubId.toString());

        // 페이지 새로고침하여 클럽별 데이터 로드
        window.location.reload();
      }
    } catch (error) {
      console.error('클럽 선택 실패:', error);
      alert('클럽 선택에 실패했습니다.');
    }
  };

  // 클럽 생성
  const createClub = async (clubData) => {
    try {
      const response = await clubAPI.createClub(clubData);
      if (response.data.success) {
        await loadClubs();
        await selectClub(response.data.club.id);
        return { success: true, message: response.data.message };
      }
      return { success: false, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || '클럽 생성에 실패했습니다.',
      };
    }
  };

  // 클럽 가입
  const joinClub = async (clubId) => {
    try {
      const response = await clubAPI.joinClub(clubId);
      if (response.data.success) {
        await loadClubs();
        return { success: true, message: response.data.message };
      }
      return { success: false, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || '클럽 가입에 실패했습니다.',
      };
    }
  };

  // 클럽 탈퇴
  const leaveClub = async (clubId) => {
    try {
      const response = await clubAPI.leaveClub(clubId);
      if (response.data.success) {
        await loadClubs();
        // 현재 클럽에서 탈퇴한 경우 다른 클럽 선택
        if (currentClub && currentClub.id === clubId) {
          const remainingClubs = clubs.filter((c) => c.id !== clubId);
          if (remainingClubs.length > 0) {
            await selectClub(remainingClubs[0].id);
          } else {
            setCurrentClub(null);
            localStorage.removeItem('currentClubId');
          }
        }
        return { success: true, message: response.data.message };
      }
      return { success: false, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || '클럽 탈퇴에 실패했습니다.',
      };
    }
  };

  useEffect(() => {
    // 토큰 확인 및 클럽 목록 로드
    const token = localStorage.getItem('token');
    lastTokenRef.current = token;

    if (token) {
      loadClubs();
    } else {
      setLoading(false);
      setCurrentClub(null);
      setClubs([]);
      localStorage.removeItem('currentClubId');
    }

    // 토큰 변경 감지 (다른 탭에서 로그인/로그아웃 시)
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        const newToken = e.newValue;
        if (newToken && newToken !== lastTokenRef.current) {
          // 로그인: 클럽 목록 다시 로드
          lastTokenRef.current = newToken;
          loadClubs();
        } else if (!newToken && lastTokenRef.current) {
          // 로그아웃: 클럽 정보 초기화
          lastTokenRef.current = null;
          setCurrentClub(null);
          setClubs([]);
          localStorage.removeItem('currentClubId');
          setLoading(false);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // 같은 탭에서도 감지하기 위해 polling
    const checkToken = setInterval(() => {
      const currentToken = localStorage.getItem('token');

      if (currentToken !== lastTokenRef.current) {
        if (currentToken && !lastTokenRef.current) {
          // 로그인
          lastTokenRef.current = currentToken;
          loadClubs();
        } else if (!currentToken && lastTokenRef.current) {
          // 로그아웃
          lastTokenRef.current = null;
          setCurrentClub(null);
          setClubs([]);
          localStorage.removeItem('currentClubId');
          setLoading(false);
        }
      }
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkToken);
    };
  }, [loadClubs]);

  const value = {
    clubs,
    currentClub,
    loading,
    selectClub,
    createClub,
    joinClub,
    leaveClub,
    loadClubs,
    isAdmin: currentClub?.role === 'admin' || currentClub?.role === 'owner',
    isOwner: currentClub?.role === 'owner',
  };

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
};
