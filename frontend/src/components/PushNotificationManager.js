import React, { useState, useCallback } from 'react';
import PushNotification from './PushNotification';
import './PushNotification.css';

const PushNotificationManager = () => {
  const [notifications, setNotifications] = useState([]);

  const showNotification = useCallback((notification) => {
    const id = Date.now() + Math.random();
    const newNotification = {
      id,
      ...notification,
    };
    setNotifications((prev) => [...prev, newNotification]);
    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // 전역 함수로 등록 (다른 컴포넌트에서 사용 가능)
  React.useEffect(() => {
    window.showPushNotification = showNotification;
    return () => {
      delete window.showPushNotification;
    };
  }, [showNotification]);

  return (
    <div className="push-notification-container">
      {notifications.map((notification) => (
        <PushNotification
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
          duration={notification.duration || 5000}
        />
      ))}
    </div>
  );
};

export default PushNotificationManager;

