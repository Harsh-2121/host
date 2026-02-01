import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gizmochat_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('gizmochat_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  googleLogin: (token) => api.post('/auth/google', { token }),
  getMe: () => api.get('/users/me'),
};

export const roomAPI = {
  getRooms: () => api.get('/rooms'),
  createRoom: (data) => api.post('/rooms', data),
  getMessages: (roomId, limit = 50, before = null) => 
    api.get(`/rooms/${roomId}/messages`, { params: { limit, before } }),
};

export const userAPI = {
  search: (query) => api.get('/users/search', { params: { q: query } }),
};

export const dmAPI = {
  create: (userId) => api.post('/dm/create', { userId }),
};

export default api;
