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
let hasShownConfigWarning = false; // 설정 경고를 한 번만 표시

// Firebase 필수 설정 값 확인
const isFirebaseConfigValid = () => {
  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'messagingSenderId', 'appId'];
  return requiredFields.every(field => {
    const value = firebaseConfig[field];
    return value && value.trim() !== '';
  });
};

try {
  // 필수 설정 값이 모두 있는 경우에만 초기화
  if (isFirebaseConfigValid()) {
    app = initializeApp(firebaseConfig);
    
    // 브라우저 환경에서만 messaging 초기화
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        messaging = getMessaging(app);
        console.log('Firebase Messaging 초기화 성공');
      } catch (messagingError) {
        console.warn('Firebase Messaging 초기화 실패:', messagingError);
        messaging = null;
      }
    }
  } else {
    // 설정 경고를 한 번만 표시
    if (!hasShownConfigWarning) {
      console.warn('⚠️ Firebase 설정이 완전하지 않습니다. 푸시 알림 기능이 작동하지 않습니다.');
      console.warn('📝 frontend/.env 파일에 다음 환경변수를 추가해주세요:');
      console.warn(`
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
REACT_APP_FIREBASE_VAPID_KEY=your-vapid-key
      `);
      console.warn('현재 설정 상태:', {
        REACT_APP_FIREBASE_API_KEY: !!firebaseConfig.apiKey,
        REACT_APP_FIREBASE_AUTH_DOMAIN: !!firebaseConfig.authDomain,
        REACT_APP_FIREBASE_PROJECT_ID: !!firebaseConfig.projectId,
        REACT_APP_FIREBASE_MESSAGING_SENDER_ID: !!firebaseConfig.messagingSenderId,
        REACT_APP_FIREBASE_APP_ID: !!firebaseConfig.appId,
        REACT_APP_FIREBASE_VAPID_KEY: !!process.env.REACT_APP_FIREBASE_VAPID_KEY,
      });
      hasShownConfigWarning = true;
    }
  }
} catch (error) {
  console.error('Firebase 초기화 실패:', error);
  console.error('Firebase 설정을 확인해주세요. 푸시 알림 기능이 작동하지 않을 수 있습니다.');
}

// FCM 토큰 가져오기
export const getFCMToken = async () => {
  if (!messaging) {
    // 조용히 실패 (이미 초기화 단계에서 경고 표시됨)
    return null;
  }

  try {
    // Service Worker 등록 (FCM 토큰을 가져오기 전에 필요)
    await registerServiceWorker();
    
    // VAPID 키는 환경변수에서 가져오기
    const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY;
    
    if (!vapidKey) {
      console.warn('⚠️ VAPID 키가 설정되지 않았습니다.');
      console.warn('📝 Firebase Console > 프로젝트 설정 > 클라우드 메시징 탭에서 VAPID 키를 확인하세요.');
      return null;
    }

    // VAPID 키 형식 검증 (Base64 URL-safe 형식이어야 함)
    const vapidKeyTrimmed = vapidKey.trim();
    if (!vapidKeyTrimmed || vapidKeyTrimmed.length < 20) {
      console.error('❌ VAPID 키 형식이 올바르지 않습니다.');
      console.error('VAPID 키는 Firebase Console에서 생성한 키를 그대로 사용해야 합니다.');
      return null;
    }

    // 알림 권한 확인
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('⚠️ 알림 권한이 허용되지 않았습니다.');
      console.warn('브라우저 설정에서 알림 권한을 허용해주세요.');
      return null;
    }

    // FCM 토큰 가져오기
    const token = await getToken(messaging, { vapidKey: vapidKeyTrimmed });
    
    if (token) {
      console.log('✅ FCM 토큰 가져오기 성공');
      return token;
    } else {
      console.warn('⚠️ FCM 토큰을 가져올 수 없습니다.');
      return null;
    }
  } catch (error) {
    // 더 명확한 에러 메시지 제공
    if (error.name === 'InvalidAccessError' || error.message?.includes('applicationServerKey')) {
      console.error('❌ VAPID 키가 유효하지 않습니다.');
      console.error('다음을 확인해주세요:');
      console.error('1. Firebase Console > 프로젝트 설정 > 클라우드 메시징 탭에서 VAPID 키 확인');
      console.error('2. .env 파일의 REACT_APP_FIREBASE_VAPID_KEY 값이 올바른지 확인');
      console.error('3. VAPID 키에 공백이나 줄바꿈이 없는지 확인');
      console.error('4. 개발 서버를 재시작했는지 확인');
    } else {
      console.error('❌ FCM 토큰 가져오기 실패:', error);
    }
    return null;
  }
};

// 포그라운드 메시지 수신 처리 (이벤트 리스너 등록)
export const setupMessageListener = (callback) => {
  if (!messaging) {
    // 조용히 실패 (이미 초기화 단계에서 경고 표시됨)
    return () => {}; // 빈 cleanup 함수 반환
  }

  // onMessage는 이벤트 리스너를 등록하므로 직접 사용
  const unsubscribe = onMessage(messaging, (payload) => {
    console.log('포그라운드 메시지 수신:', payload);
    if (callback) {
      callback(payload);
    }
  });

  // cleanup 함수 반환 (필요한 경우)
  return unsubscribe || (() => {});
};

// Service Worker 등록 및 Firebase 설정 주입
export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      // Service Worker에 Firebase 설정 전달
      if (app && isFirebaseConfigValid()) {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service Worker 등록 성공:', registration);
        
        // Service Worker에 Firebase 설정 전달
        if (registration.active) {
          registration.active.postMessage({
            type: 'FIREBASE_CONFIG',
            config: firebaseConfig,
          });
        }
        
        return registration;
      }
    } catch (error) {
      console.error('Service Worker 등록 실패:', error);
      return null;
    }
  }
  return null;
};

export { app, messaging };


