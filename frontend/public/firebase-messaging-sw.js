// Firebase Cloud Messaging Service Worker
// 이 파일은 404 오류를 방지하기 위한 더미 파일입니다.

console.log('Firebase Messaging Service Worker 로드됨');

// 기본 서비스 워커 등록
self.addEventListener('install', (event) => {
  console.log('Service Worker 설치됨');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker 활성화됨');
  event.waitUntil(self.clients.claim());
});
