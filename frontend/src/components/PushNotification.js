import React, { useState, useEffect } from 'react';
import './PushNotification.css';

const PushNotification = ({ notification, onClose, duration = 5000 }) => {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300); // 애니메이션 시간과 맞춤
  };

  const handleClick = () => {
    if (notification.onClick) {
      notification.onClick();
    }
    handleClose();
  };

  if (!notification) return null;

  const type = notification.type || 'info';
  const title = notification.title || '알림';
  const body = notification.body || '';

  return (
    <div
      className={`push-notification ${type} ${isClosing ? 'closing' : ''}`}
      onClick={handleClick}
    >
      <div className="push-notification-icon">
        {notification.icon || (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {type === 'success' && (
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            )}
            {type === 'error' && (
              <>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </>
            )}
            {type === 'warning' && (
              <>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </>
            )}
            {type === 'info' && (
              <>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </>
            )}
          </svg>
        )}
      </div>
      <div className="push-notification-content">
        <div className="push-notification-title">{title}</div>
        {body && <div className="push-notification-body">{body}</div>}
      </div>
      <div
        className="push-notification-close"
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>
    </div>
  );
};

export default PushNotification;

