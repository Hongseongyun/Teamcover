import axios from 'axios';

// 환경변수 또는 기본값 사용
const API_BASE_URL = process.env.REACT_APP_API_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // 타임아웃 설정 (OCR/AI 분석은 시간이 오래 걸릴 수 있음)
  timeout: 60000, // 60초
});

// 요청 인터셉터
api.interceptors.request.use(
  (config) => {
    // Base URL이 HTTP로 시작하면 HTTPS로 변환 (로컬 개발 환경 제외)
    if (
      config.baseURL &&
      config.baseURL.startsWith('http://') &&
      !config.baseURL.includes('localhost')
    ) {
      config.baseURL = config.baseURL.replace('http://', 'https://');
    }

    // URL이 HTTP로 시작하면 HTTPS로 변환 (로컬 개발 환경 제외)
    if (
      config.url &&
      config.url.startsWith('http://') &&
      !config.url.includes('localhost')
    ) {
      config.url = config.url.replace('http://', 'https://');
    }

    // JWT 토큰 추가 (비밀번호 재설정용 임시 토큰 우선)
    const tempResetToken = localStorage.getItem('temp_reset_token');
    const token = localStorage.getItem('token');

    if (tempResetToken) {
      config.headers.Authorization = `Bearer ${tempResetToken}`;
    } else if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 개인정보 접근 토큰 추가 (있는 경우)
    const privacyToken = localStorage.getItem('privacy_token');
    if (privacyToken) {
      config.headers['X-Privacy-Token'] = privacyToken;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 회원 관리 API
export const memberAPI = {
  getMembers: () => api.get('/api/members/'),
  addMember: (data) => api.post('/api/members/', data),
  updateMember: (id, data) => api.put(`/api/members/${id}`, data), // 마지막 슬래시 제거
  deleteMember: (id) => api.delete(`/api/members/${id}`), // 마지막 슬래시 제거
  getMemberAverage: (id) => api.get(`/api/members/${id}/average`), // 마지막 슬래시 제거
  getAllMembersAverages: () => api.get('/api/members/averages/'),
  verifyPrivacyAccess: (password) =>
    api.post('/api/members/privacy-verify/', { password }),
  checkPrivacyStatus: () => api.get('/api/members/privacy-status/'),
  importFromSheets: (data) => {
    const payload = {
      spreadsheet_url: data?.spreadsheetUrl || data?.spreadsheet_url || '',
      worksheet_name: data?.worksheetName || data?.worksheet_name || undefined,
    };
    return api.post('/api/members/import-from-sheets/', payload);
  },
};

// 스코어 관리 API
export const scoreAPI = {
  getScores: () => api.get('/api/scores/'),
  addScore: (data) => api.post('/api/scores/', data),
  updateScore: (id, data) => api.put(`/api/scores/${id}`, data), // 마지막 슬래시 제거
  deleteScore: (id) => api.delete(`/api/scores/${id}`), // 마지막 슬래시 제거
  importFromSheets: (data) => api.post('/api/scores/import-from-sheets', data),
};

// 포인트 관리 API
export const pointAPI = {
  getPoints: () => api.get('/api/points/'),
  addPoint: (data) => api.post('/api/points/', data),
  addPointsBatch: (data) => api.post('/api/points/batch', data),
  updatePoint: (id, data) => api.put(`/api/points/${id}`, data), // 마지막 슬래시 제거
  deletePoint: (id) => api.delete(`/api/points/${id}`), // 마지막 슬래시 제거
  importFromSheets: (data) => api.post('/api/points/import-from-sheets', data),
};

// 팀 배정 API
export const teamAPI = {
  addPlayer: (data) => api.post('/api/add-player', data),
  getPlayers: () => api.get('/api/get-players'),
  deletePlayer: (data) => api.post('/api/delete-player', data),
  clearPlayers: () => api.post('/api/clear-players'),
  makeTeams: (data) => api.post('/api/make-teams', data),
};

// OCR API
export const ocrAPI = {
  processImage: (formData) =>
    api.post('/api/ocr', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 120000, // OCR은 더 길게 (120초 = 2분)
    }),
};

// 인증 API
export const authAPI = {
  register: (data) => api.post('/api/auth/register', data),
  login: (data) => api.post('/api/auth/login', data),
  googleLogin: (data) => api.post('/api/auth/google', data),
  logout: () => api.post('/api/auth/logout'),
  getCurrentUser: () => api.get('/api/auth/me'),
  getUsers: () => api.get('/api/auth/users'),
  updateUserRole: (userId, data) =>
    api.put(`/api/auth/users/${userId}/role`, data),
  updateUserStatus: (userId, data) =>
    api.put(`/api/auth/users/${userId}/status`, data),
  deleteUser: (userId) => api.delete(`/api/auth/users/${userId}`),
  verifyEmail: (data) => api.post('/api/auth/verify-email', data),
  resendVerification: (data) => api.post('/api/auth/resend-verification', data),
  // 비밀번호 찾기 관련 API
  forgotPassword: (data) =>
    api.post('/api/auth/forgot-password', data, { timeout: 120000 }), // 2분 타임아웃
  verifyResetCode: (data) => api.post('/api/auth/verify-reset-code', data),
  resetPassword: (data) => api.post('/api/auth/reset-password', data),
};

// 구글시트 가져오기 API
export const sheetsAPI = {
  importMembers: (data) => {
    const payload = {
      spreadsheet_url: data?.spreadsheetUrl || data?.spreadsheet_url || '',
      worksheet_name: data?.worksheetName || data?.worksheet_name || undefined,
    };
    return api.post('/api/members/import-from-sheets', payload);
  },
  importScores: (data) => {
    const payload = {
      spreadsheet_url: data?.spreadsheetUrl || data?.spreadsheet_url || '',
      worksheet_name: data?.worksheetName || data?.worksheet_name || undefined,
      clear_existing: !!(data?.confirmDelete ?? data?.clear_existing),
    };
    return api.post('/api/scores/import-from-sheets', payload);
  },
  importPoints: (data) => {
    const payload = {
      spreadsheet_url: data?.spreadsheetUrl || data?.spreadsheet_url || '',
      worksheet_name: data?.worksheetName || data?.worksheet_name || undefined,
      clear_existing: !!(data?.confirmDelete ?? data?.clear_existing),
    };
    return api.post('/api/points/import-from-sheets', payload);
  },
};

export default api;
