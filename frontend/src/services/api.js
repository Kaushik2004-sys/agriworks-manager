// Central API client for AgriWorks Manager (Phase 1 + Phase 2 auth).
// All phases reuse this file to call Django backend.
// M16.5: the API base URL MUST come from VITE_API_URL. Local development
// uses the existing localhost default; a production build (no dev server)
// without VITE_API_URL fails loudly at boot instead of silently calling
// localhost, which could never work for real users.
import axios from 'axios';

const DEV_FALLBACK_API_URL = 'http://127.0.0.1:8000/api';

function resolveApiBaseUrl() {
  const configured = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
  if (configured) {
    // Project architecture: the base URL always includes the /api prefix
    // (service endpoints are relative like /login/). Accept both
    // https://host and https://host/api so a missing suffix can never
    // produce a bare https://host/login/ 404 in production.
    return configured.endsWith('/api') ? configured : `${configured}/api`;
  }
  if (import.meta.env.DEV) return DEV_FALLBACK_API_URL;
  throw new Error(
    'AgriWorks configuration error: VITE_API_URL is not set. '
    + 'Supply it at build time (e.g. https://your-backend.example/api). '
    + 'Refusing to fall back to localhost in a production build.'
  );
}

const API_BASE_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
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

// Single active session: the server rotates the token on each login, so a
// 401 means this browser's session is no longer the active one (e.g. the
// user logged in on another device). Drop the dead token and go to Login
// instead of showing stale protected content. Only 401 (bad token) triggers
// this — never 403 (a valid session denied by permissions) or network
// errors — and auth-endpoint calls manage their own errors.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const url = err?.config?.url || '';
    const isAuthCall =
      url.includes('/login/') ||
      url.includes('/logout/') ||
      url.includes('/register/') ||
      url.includes('/password-reset/');
    if (status === 401 && !isAuthCall) {
      // Ignore a stale in-flight request if a newer token is already stored
      // (e.g. password change rotated the token mid-flight).
      const sent = err?.config?.headers?.Authorization || '';
      const sentToken = String(sent).replace(/^Token /, '');
      const current = localStorage.getItem('agriworks_token');
      if (!current || !sentToken || sentToken === current) {
        localStorage.removeItem('agriworks_token');
        if (!window.location.pathname.startsWith('/login')) {
          // replace (not href): drops the stale protected entry instead of
          // stacking /login on top of it, so Back cannot repaint the
          // previous-session document from history/bfcache.
          window.location.replace('/login');
        }
      }
    }
    return Promise.reject(err);
  }
);

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
  return res.data; // { username, email, is_staff, is_superuser, profile: { full_name, last_name, company_name, mobile } }
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
  return res.data; // { username, email, profile: { full_name, last_name, company_name, mobile } }
}

export async function updateProfile(data) {
  const res = await api.put('/profile/', data);
  return res.data;
}

export async function changePassword(data) {
  const res = await api.post('/change-password/', data);
  return res.data; // { token, message } - token is rotated, store the new one
}

export { API_BASE_URL };

export default api;
