// Central API client for AgriWorks Manager (Phase 1 + Phase 2 auth).
// All phases reuse this file to call Django backend.
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
  timeout: 10000,
});

// Attach saved token to every request (for protected pages/routes)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('agriworks_token');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

export async function getBackendHealth() {
  const res = await api.get('/health/');
  return res.data;
}

// Phase 2 auth helpers (login accepts Email OR Username - preserved).
export async function loginUser(identifier, password) {
  const res = await api.post('/login/', { username: identifier, email: identifier, password });
  return res.data; // { token, username, email, message }
}

export async function logoutUser() {
  const res = await api.post('/logout/');
  return res.data;
}

export async function getCurrentUser() {
  const res = await api.get('/me/');
  return res.data; // { username, email, is_staff, is_superuser, profile: { full_name, company_name, mobile } }
}

// Auth update: registration + password reset (backend-driven, not frontend-only).
export async function registerUser(data) {
  const res = await api.post('/register/', data);
  return res.data; // { token, username, email, profile, message }
}

export async function requestPasswordReset(email) {
  const res = await api.post('/password-reset/request/', { email });
  return res.data;
}

export async function confirmPasswordReset(payload) {
  const res = await api.post('/password-reset/confirm/', payload);
  return res.data;
}

// Profile Management: own profile only (backend uses request.user).
export async function getProfile() {
  const res = await api.get('/profile/');
  return res.data; // { username, email, profile: { full_name, company_name, mobile } }
}

export async function updateProfile(data) {
  const res = await api.put('/profile/', data);
  return res.data;
}

export async function changePassword(data) {
  const res = await api.post('/change-password/', data);
  return res.data; // { token, message } - token is rotated, store the new one
}

export default api;
