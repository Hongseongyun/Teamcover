// Firebase Cloud Messaging Service Worker
importScripts(
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js'
);
importScripts(
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js'
);

// Firebase 초기화
firebase.initializeApp({
  apiKey: '%REACT_APP_FIREBASE_API_KEY%',
  authDomain: '%REACT_APP_FIREBASE_AUTH_DOMAIN%',
  projectId: '%REACT_APP_FIREBASE_PROJECT_ID%',
  storageBucket: '%REACT_APP_FIREBASE_STORAGE_BUCKET%',
  messagingSenderId: '%REACT_APP_FIREBASE_MESSAGING_SENDER_ID%',
  appId: '%REACT_APP_FIREBASE_APP_ID%',
});

const messaging = firebase.messaging();

// 백그라운드 메시지 수신 처리
messaging.onBackgroundMessage((payload) => {
  console.log('백그라운드 메시지 수신:', payload);

  const notificationTitle = payload.notification?.title || '새 알림';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/favicon.ico',
    tag: payload.data?.type || 'notification',
    data: payload.data,
  };

  return self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  console.log('알림 클릭:', event);

  event.notification.close();

  // 알림 데이터에 따라 적절한 페이지로 이동
  const data = event.notification.data;
  if (data?.type === 'inquiry' && data?.inquiry_id) {
    event.waitUntil(clients.openWindow(`/inquiry`));
  } else {
    event.waitUntil(clients.openWindow('/'));
  }
});
