import React, { useEffect } from 'react';

const modalStyle = {
  textAlign: 'center',
  padding: '30px',
  minWidth: '200px',
};

const spinnerStyle = {
  margin: '0 auto 20px',
};

const LoadingModal = ({ isOpen, message }) => {
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

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={modalStyle}
      >
        <div className="loading-spinner" style={spinnerStyle}></div>
        <h3 style={{ margin: 0 }}>{message || '처리 중...'}</h3>
      </div>
    </div>
  );
};

export default LoadingModal;

