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

    // 현재 선택된 클럽 ID 추가
    const currentClubId = localStorage.getItem('currentClubId');
    if (currentClubId) {
      config.headers['X-Club-Id'] = currentClubId;
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
  getMemberAverage: (id) => api.get(`/api/members/${id}/average/`), // 슬래시 추가
  getAllMembersAverages: () => api.get('/api/members/averages/'),
  updateAllMemberAverages: () => api.post('/api/members/update-averages/'),
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
  getMemberAverages: () => api.get('/api/scores/averages'), // 회원별 평균 순위 조회
  refreshMemberAverages: () => api.post('/api/scores/averages/refresh'), // 에버 새로고침
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
  checkActiveSession: (data) =>
    api.post('/api/auth/check-active-session', data),
  googleConfirmLogin: (data) =>
    api.post('/api/auth/google/confirm-login', data),
  login: (data) => api.post('/api/auth/login', data),
  googleLogin: (data) => api.post('/api/auth/google', data),
  selectClubAfterSignup: (data) =>
    api.post('/api/clubs/select-after-signup', data),
  logout: () => api.post('/api/auth/logout'),
  logoutOtherDevices: () => api.post('/api/auth/logout-other-devices'),
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
    api.post('/api/auth/forgot-password', data, { timeout: 30000 }), // 30초 타임아웃
  verifyResetCode: (data) => api.post('/api/auth/verify-reset-code', data),
  resetPassword: (data) => api.post('/api/auth/reset-password', data),
  // 마이페이지 관련 API
  updateName: (data) => api.post('/api/auth/update-name', data),
  changePassword: (data) => api.post('/api/auth/change-password', data),
  deleteAccount: (data) => api.post('/api/auth/delete-account', data),
  registerFcmToken: (data) => api.post('/api/auth/register-fcm-token', data),
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

// 납입 관리 API
export const paymentAPI = {
  getPayments: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/api/payments/?${queryString}`);
  },
  addPayment: (data) => api.post('/api/payments/', data),
  updatePayment: (id, data) => api.put(`/api/payments/${id}`, data),
  deletePayment: (id) => api.delete(`/api/payments/${id}`),
  getPaymentStats: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/api/payments/stats?${queryString}`);
  },
  getBalance: () => api.get('/api/payments/balance'),
  updateBalance: (data) => api.put('/api/payments/balance', data),
  getFundLedger: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/api/payments/fund/ledger?${queryString}`);
  },
  addFundLedger: (data) => api.post('/api/payments/fund/ledger', data),
  updateFundLedger: (id, data) =>
    api.put(`/api/payments/fund/ledger/${id}`, data),
  deleteFundLedger: (id) => api.delete(`/api/payments/fund/ledger/${id}`),
};

// 메시지 / 채팅 API
export const messageAPI = {
  getUnreadCount: () => api.get('/api/messages/unread-count'),
  getConversations: () => api.get('/api/messages/conversations'),
  getMessagesWithUser: (userId, markRead = true) => {
    const url = `/api/messages/with/${userId}`;
    return api.get(url);
  },
  sendMessage: (userId, content) =>
    api.post(`/api/messages/with/${userId}`, { content }),
  markAsRead: (userId) => api.post(`/api/messages/with/${userId}/read`),
  deleteMessage: (messageId) => api.delete(`/api/messages/${messageId}`),
};

// 클럽 관리 API
export const clubAPI = {
  getAllClubs: () => api.get('/api/clubs/public'), // 회원가입용 (인증 불필요)
  getAvailableClubs: () => api.get('/api/clubs/available'), // 구글 로그인 후 클럽 선택용
  getUserClubs: () => api.get('/api/clubs/'), // 슬래시 추가하여 308 리다이렉트 방지
  createClub: (data) => api.post('/api/clubs', data),
  getClub: (clubId) => api.get(`/api/clubs/${clubId}`),
  getClubUsers: (clubId) => api.get(`/api/clubs/${clubId}/users`),
  joinClub: (clubId) => api.post(`/api/clubs/${clubId}/join`),
  leaveClub: (clubId) => api.post(`/api/clubs/${clubId}/leave`),
  removeMemberFromClub: (clubId, userId) =>
    api.post(`/api/clubs/${clubId}/members/${userId}/remove`),
  selectClub: (clubId) => api.post(`/api/clubs/${clubId}/select`),
  updateClubDescription: (clubId, data) =>
    api.put(`/api/clubs/${clubId}/description`, data),
  deleteClub: (clubId) => api.delete(`/api/clubs/${clubId}`),
  // 클럽 멤버 역할 변경 (슈퍼관리자 전용)
  updateMemberRole: (clubId, userId, data) =>
    api.put(`/api/clubs/${clubId}/members/${userId}/role`, data),
  // 클럽 가입 요청 관리 (슈퍼관리자 전용)
  getJoinRequests: () => api.get('/api/clubs/join-requests'),
  getJoinRequestsCount: () => api.get('/api/clubs/join-requests/count'),
  approveJoinRequest: (requestId) =>
    api.post(`/api/clubs/join-requests/${requestId}/approve`),
  rejectJoinRequest: (requestId) =>
    api.post(`/api/clubs/join-requests/${requestId}/reject`),
};

// 게시판 API
export const postAPI = {
  getPosts: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/api/posts?${queryString}`);
  },
  getPost: (id) => api.get(`/api/posts/${id}`),
  createPost: (data) => api.post('/api/posts', data),
  updatePost: (id, data) => api.put(`/api/posts/${id}`, data),
  deletePost: (id) => api.delete(`/api/posts/${id}`),
  getComments: (postId) => api.get(`/api/posts/${postId}/comments`),
  createComment: (postId, data) =>
    api.post(`/api/posts/${postId}/comments`, data),
  updateComment: (commentId, data) =>
    api.put(`/api/posts/comments/${commentId}`, data),
  deleteComment: (commentId) => api.delete(`/api/posts/comments/${commentId}`),
  toggleCommentLike: (commentId) =>
    api.post(`/api/posts/comments/${commentId}/like`),
  toggleLike: (postId) => api.post(`/api/posts/${postId}/like`),
  uploadImage: (formData) =>
    api.post('/api/posts/upload-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
};

export const inquiryAPI = {
  getInquiries: () => api.get('/api/inquiries'),
  getInquiry: (inquiryId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(
      `/api/inquiries/${inquiryId}${queryString ? '?' + queryString : ''}`
    );
  },
  getRepliedCount: () => api.get('/api/inquiries/replied-count'),
  createInquiry: (data) => api.post('/api/inquiries', data),
  updateInquiry: (inquiryId, data) =>
    api.put(`/api/inquiries/${inquiryId}`, data),
  deleteInquiry: (inquiryId) => api.delete(`/api/inquiries/${inquiryId}`),
  replyInquiry: (inquiryId, data) =>
    api.post(`/api/inquiries/${inquiryId}/reply`, data),
  updateInquiryReply: (inquiryId, data) =>
    api.put(`/api/inquiries/${inquiryId}/reply`, data),
  deleteInquiryReply: (inquiryId) =>
    api.delete(`/api/inquiries/${inquiryId}/reply`),
  getReplyComments: (inquiryId) =>
    api.get(`/api/inquiries/${inquiryId}/reply/comments`),
  createReplyComment: (inquiryId, data) =>
    api.post(`/api/inquiries/${inquiryId}/reply/comments`, data),
  updateReplyComment: (inquiryId, commentId, data) =>
    api.put(`/api/inquiries/${inquiryId}/reply/comments/${commentId}`, data),
  deleteReplyComment: (inquiryId, commentId) =>
    api.delete(`/api/inquiries/${inquiryId}/reply/comments/${commentId}`),
  // Unread inquiry count (for admins and super admins)
  getUnreadCount: () => api.get('/api/inquiries/unread-count'),
};

export default api;
