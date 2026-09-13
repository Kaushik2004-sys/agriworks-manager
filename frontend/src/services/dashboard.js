// Phase 8: Dashboard API helper (uses real DB data, no duplicates).
import api from './api';

export async function getDashboard() {
  const res = await api.get('/dashboard/');
  return res.data;
}
