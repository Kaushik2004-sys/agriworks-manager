// Phase 3: Farmer API helpers (uses token from api.js interceptor).
import api from './api';

export async function listFarmers(search = '') {
  const params = search ? { search } : {};
  const res = await api.get('/farmers/', { params });
  return res.data;
}

export async function createFarmer(data) {
  const res = await api.post('/farmers/', data);
  return res.data;
}

export async function updateFarmer(id, data) {
  const res = await api.put(`/farmers/${id}/`, data);
  return res.data;
}

export async function deleteFarmer(id) {
  await api.delete(`/farmers/${id}/`);
}
