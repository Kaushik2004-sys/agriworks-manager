// Phase 4: Work API helpers (token attached by api.js interceptor).
import api from './api';

export const WORK_TYPES = ['Ploughing', 'Rotavator', 'Cultivation', 'Harvesting', 'Irrigation'];

export async function listWorks({ search = '', farmer = '', work_type = '' } = {}) {
  const params = {};
  if (search) params.search = search;
  if (farmer) params.farmer = farmer;
  if (work_type) params.work_type = work_type;
  const res = await api.get('/works/', { params });
  return res.data;
}

export async function createWork(data) {
  const res = await api.post('/works/', data);
  return res.data;
}

export async function updateWork(id, data) {
  const res = await api.put(`/works/${id}/`, data);
  return res.data;
}

export async function deleteWork(id) {
  await api.delete(`/works/${id}/`);
}
