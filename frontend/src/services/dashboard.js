// Phase 8: Dashboard API helper (uses real DB data, no duplicates).
import api from './api';

export async function getDashboard() {
  const res = await api.get('/dashboard/');
  return res.data;
}

// Admin Dashboard statistics across all users (superuser only).
export async function getAdminOverview() {
  const res = await api.get('/admin/overview/');
  return res.data;
}

// Admin Login History, newest first (superuser only).
export async function getLoginHistory() {
  const res = await api.get('/admin/login-history/');
  return res.data;
}
