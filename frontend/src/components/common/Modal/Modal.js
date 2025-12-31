import React, { useEffect, useCallback } from 'react';
import './Modal.css';

/**
 * 공통 Modal 컴포넌트
 *
 * @param {boolean} isOpen - 모달 표시 여부
 * @param {function} onClose - 모달 닫기 함수
 * @param {string} title - 모달 제목
 * @param {string} subtitle - 모달 부제목 (선택)
 * @param {React.ReactNode} children - 모달 본문 내용
 * @param {React.ReactNode} footer - 모달 하단 버튼 영역 (선택)
 * @param {string} size - 모달 크기 ('sm', 'md', 'lg') - 기본값: 'md'
 * @param {string} className - 추가 CSS 클래스
 * @param {boolean} closeOnOverlayClick - 오버레이 클릭 시 닫기 여부 - 기본값: true
 * @param {boolean} showCloseButton - 닫기 버튼 표시 여부 - 기본값: true
 * @param {boolean} preventScroll - 배경 스크롤 방지 여부 - 기본값: true
 */
const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  className = '',
  closeOnOverlayClick = true,
  showCloseButton = true,
  preventScroll = true,
}) => {
  // ESC 키로 모달 닫기
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    },
    [onClose]
  );

  // 배경 스크롤 방지
  useEffect(() => {
    if (isOpen && preventScroll) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen, preventScroll]);

  // ESC 키 이벤트 리스너
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  const sizeClass =
    {
      sm: 'common-modal--sm',
      md: 'common-modal--md',
      lg: 'common-modal--lg',
    }[size] || 'common-modal--md';

  return (
    <div className="common-modal-overlay" onClick={handleOverlayClick}>
      <div
        className={`common-modal ${sizeClass} ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {/* 헤더 */}
        {(title || showCloseButton) && (
          <div className="common-modal__header">
            <div className="common-modal__header-content">
              {title && (
                <h3 id="modal-title" className="common-modal__title">
                  {title}
                </h3>
              )}
              {subtitle && <p className="common-modal__subtitle">{subtitle}</p>}
            </div>
            {showCloseButton && onClose && (
              <button
                type="button"
                className="common-modal__close-btn"
                onClick={onClose}
                aria-label="닫기"
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* 본문 */}
        <div className="common-modal__body">{children}</div>

        {/* 하단 버튼 영역 */}
        {footer && <div className="common-modal__footer">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
