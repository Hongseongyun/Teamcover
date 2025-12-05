// Firebase Cloud Messaging Service Worker
importScripts(
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js'
);
importScripts(
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js'
);

// Firebase 초기화
// 환경변수는 빌드 시점에 주입되거나, fetch를 통해 가져올 수 있습니다
// 여기서는 self.location을 통해 현재 도메인에서 설정을 가져옵니다
const firebaseConfig = {
  apiKey: self.firebaseConfig?.apiKey || '',
  authDomain: self.firebaseConfig?.authDomain || '',
  projectId: self.firebaseConfig?.projectId || '',
  storageBucket: self.firebaseConfig?.storageBucket || '',
  messagingSenderId: self.firebaseConfig?.messagingSenderId || '',
  appId: self.firebaseConfig?.appId || '',
};

// 설정이 있는 경우에만 초기화
let messaging = null;
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    firebase.initializeApp(firebaseConfig);
    messaging = firebase.messaging();
  } catch (error) {
    console.error('Firebase 초기화 실패:', error);
  }
}

// 메시지로 Firebase 설정 받기
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    const config = event.data.config;
    if (config && config.apiKey && config.projectId && !messaging) {
      try {
        firebase.initializeApp(config);
        messaging = firebase.messaging();
        console.log('Service Worker에서 Firebase 초기화 완료');
      } catch (error) {
        console.error('Service Worker에서 Firebase 초기화 실패:', error);
      }
    }
  }
});

// 백그라운드 메시지 수신 처리
if (messaging) {
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
}

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  console.log('알림 클릭:', event);

  event.notification.close();

  // 알림 데이터에 따라 적절한 페이지로 이동
  const data = event.notification.data;
  if (data?.type === 'inquiry' && data?.inquiry_id) {
    event.waitUntil(clients.openWindow(`/inquiry`));
  } else if (data?.type === 'inquiry_reply' && data?.inquiry_id) {
    event.waitUntil(clients.openWindow(`/inquiry`));
  } else if (data?.type === 'message') {
    event.waitUntil(clients.openWindow(`/`));
  } else {
    event.waitUntil(clients.openWindow('/'));
  }
});
