-- User 모델에 FCM 토큰 필드 추가
  ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;


