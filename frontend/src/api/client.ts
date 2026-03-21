import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// On init: attach token from localStorage if it exists
const storedToken = localStorage.getItem('auth_token');
if (storedToken) {
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
}

// Response interceptor for error handling and 401 auto-logout
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        // Clear token and redirect to login on unauthorized
        localStorage.removeItem('auth_token');
        delete apiClient.defaults.headers.common['Authorization'];
        // Avoid redirect loops — only redirect if not already on /login
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      } else {
        console.error('API Error:', error.response.data);
      }
    } else if (error.request) {
      console.error('Network Error:', error.request);
    } else {
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);
