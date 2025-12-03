import React, { createContext, useContext, useState, useEffect } from 'react';
import { clubAPI } from '../services/api';

const ClubContext = createContext();

export const useClub = () => {
  const context = useContext(ClubContext);
  if (!context) {
    throw new Error('useClub must be used within a ClubProvider');
  }
  return context;
};

export const ClubProvider = ({ children }) => {
  const [clubs, setClubs] = useState([]);
  const [currentClub, setCurrentClub] = useState(null);
  const [loading, setLoading] = useState(true);

  // 클럽 목록 로드
  const loadClubs = async () => {
    try {
      const response = await clubAPI.getUserClubs();
      if (response.data.success) {
        setClubs(response.data.clubs);

        // 저장된 클럽이 있으면 선택
        const savedClubId = localStorage.getItem('currentClubId');
        if (savedClubId) {
          const savedClub = response.data.clubs.find(
            (c) => c.id === parseInt(savedClubId)
          );
          if (savedClub) {
            setCurrentClub(savedClub);
          } else if (response.data.clubs.length > 0) {
            // 저장된 클럽이 없으면 첫 번째 클럽 선택
            selectClub(response.data.clubs[0].id);
          }
        } else if (response.data.clubs.length > 0) {
          // 첫 번째 클럽을 기본으로 선택
          selectClub(response.data.clubs[0].id);
        }
      }
    } catch (error) {
      console.error('클럽 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

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
    // 로그인 상태일 때만 클럽 목록 로드
    const token = localStorage.getItem('token');
    if (token) {
      loadClubs();
    } else {
      setLoading(false);
    }
  }, []);

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
