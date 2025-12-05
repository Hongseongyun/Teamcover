import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { messageAPI } from '../services/api';
import Messages from '../pages/Messages';
import './FloatingMessageButton.css';

const FloatingMessageButton = () => {
  const { isAuthenticated, hasRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // 모달이 열릴 때 배경 스크롤 막기
  useEffect(() => {
    if (isOpen) {
      // 현재 스크롤 위치 저장
      const scrollY = window.scrollY;
      // body 스타일 적용
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      
      return () => {
        // 모달이 닫힐 때 스크롤 복원
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isAuthenticated || !hasRole('user')) {
      return;
    }

    const loadUnread = async () => {
      try {
        const res = await messageAPI.getUnreadCount();
        if (res.data.success) {
          setUnreadCount(res.data.count || 0);
        }
      } catch (e) {
        console.error('메시지 안 읽은 개수 로드 실패:', e);
      }
    };

    loadUnread();
    const interval = setInterval(loadUnread, 15000);

    const handleMessagesUpdated = () => {
      loadUnread();
    };

    window.addEventListener('messagesUpdated', handleMessagesUpdated);

    // 외부에서 메시지 모달을 열기 위한 이벤트 리스너
    const handleOpenMessageModal = () => {
      setIsOpen(true);
    };
    window.addEventListener('openMessageModal', handleOpenMessageModal);

    // 외부에서 메시지 모달을 닫기 위한 이벤트 리스너
    const handleCloseMessageModal = () => {
      setIsOpen(false);
    };
    window.addEventListener('closeMessageModal', handleCloseMessageModal);

    return () => {
      clearInterval(interval);
      window.removeEventListener('messagesUpdated', handleMessagesUpdated);
      window.removeEventListener('openMessageModal', handleOpenMessageModal);
      window.removeEventListener('closeMessageModal', handleCloseMessageModal);
    };
  }, [isAuthenticated, hasRole]);

  if (!isAuthenticated || !hasRole('user')) {
    return null;
  }

  return (
    <>
      <button
        className="floating-message-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="메시지"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="floating-message-badge">{unreadCount}</span>
        )}
      </button>
      {isOpen && (
        <div className="floating-message-overlay" onClick={() => setIsOpen(false)}>
          <div
            className="floating-message-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="floating-message-header">
              <h2>메시지</h2>
              <button
                className="floating-message-close"
                onClick={() => setIsOpen(false)}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <div className="floating-message-content">
              <Messages />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingMessageButton;

