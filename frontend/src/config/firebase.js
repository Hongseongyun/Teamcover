// Firebase 초기화 설정
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Firebase 설정 (환경변수에서 가져오기)
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Firebase 앱 초기화
let app = null;
let messaging = null;

try {
  app = initializeApp(firebaseConfig);
  
  // 브라우저 환경에서만 messaging 초기화
  if (typeof window !== 'undefined' && 'Notification' in window) {
    messaging = getMessaging(app);
  }
} catch (error) {
  console.error('Firebase 초기화 실패:', error);
}

// FCM 토큰 가져오기
export const getFCMToken = async () => {
  if (!messaging) {
    console.warn('Firebase Messaging이 초기화되지 않았습니다.');
    return null;
  }

  try {
    // VAPID 키는 환경변수에서 가져오기
    const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY;
    
    if (!vapidKey) {
      console.warn('VAPID 키가 설정되지 않았습니다.');
      return null;
    }

    // 알림 권한 확인
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('알림 권한이 허용되지 않았습니다.');
      return null;
    }

    // FCM 토큰 가져오기
    const token = await getToken(messaging, { vapidKey });
    
    if (token) {
      console.log('FCM 토큰 가져오기 성공');
      return token;
    } else {
      console.warn('FCM 토큰을 가져올 수 없습니다.');
      return null;
    }
  } catch (error) {
    console.error('FCM 토큰 가져오기 실패:', error);
    return null;
  }
};

// 포그라운드 메시지 수신 처리
export const onMessageListener = () => {
  return new Promise((resolve) => {
    if (!messaging) {
      resolve(null);
      return;
    }

    onMessage(messaging, (payload) => {
      console.log('포그라운드 메시지 수신:', payload);
      resolve(payload);
    });
  });
};

export { app, messaging };


