import React, { useState, useCallback, useRef } from 'react';
import PushNotification from './PushNotification';
import './PushNotification.css';

const PushNotificationManager = () => {
  const [notifications, setNotifications] = useState([]);
  const lastNotificationRef = useRef({}); // 마지막 알림 추적 (타입별)

  const showNotification = useCallback((notification) => {
    // 중복 방지: 같은 타입과 제목의 알림이 3초 이내에 다시 오면 무시
    const notificationKey = `${notification.type || 'info'}_${notification.title || ''}`;
    const now = Date.now();
    const lastNotification = lastNotificationRef.current[notificationKey];
    
    if (lastNotification && (now - lastNotification.time) < 3000) {
      // 3초 이내에 동일한 알림이 오면 무시
      console.log('중복 알림 무시:', notificationKey);
      return null;
    }
    
    // 마지막 알림 시간 업데이트
    lastNotificationRef.current[notificationKey] = { time: now };
    
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

