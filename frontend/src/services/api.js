import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터
api.interceptors.request.use(
  (config) => {
    console.log('API 요청:', config.method?.toUpperCase(), config.url);

    // JWT 토큰 추가
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
    console.error('API 오류:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// 회원 관리 API
export const memberAPI = {
  getMembers: () => api.get('/api/members/'),
  addMember: (data) => api.post('/api/members/', data),
  updateMember: (id, data) => api.put(`/api/members/${id}/`, data),
  deleteMember: (id) => api.delete(`/api/members/${id}/`),
  getMemberAverage: (id) => api.get(`/api/members/${id}/average/`),
  getAllMembersAverages: () => api.get('/api/members/averages/'),
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
  updateScore: (id, data) => api.put(`/api/scores/${id}`, data),
  deleteScore: (id) => api.delete(`/api/scores/${id}`),
  importFromSheets: (data) => api.post('/api/scores/import-from-sheets', data),
};

// 포인트 관리 API
export const pointAPI = {
  getPoints: () => api.get('/api/points'),
  addPoint: (data) => api.post('/api/points', data),
  updatePoint: (id, data) => api.put(`/api/points/${id}/`, data),
  deletePoint: (id) => api.delete(`/api/points/${id}/`),
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
  verifyEmail: (data) => api.post('/api/auth/verify-email', data),
  resendVerification: (data) => api.post('/api/auth/resend-verification', data),
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
