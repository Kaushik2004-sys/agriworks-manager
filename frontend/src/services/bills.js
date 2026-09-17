// Phase 5: Bill API helpers (token attached by api.js interceptor).
import api from './api';

export async function listBills({ search = '', status = '', farmer = '' } = {}) {
  const params = {};
  if (search) params.search = search;
  if (status) params.status = status;
  if (farmer) params.farmer = farmer;
  const res = await api.get('/bills/', { params });
  return res.data;
}

export async function createBill(data) {
  const res = await api.post('/bills/', data);
  return res.data;
}

// NOTE: bills are immutable once generated (backend rejects PUT/PATCH
// with 405). Corrections use a new bill record, so no update helper exists.

export async function deleteBill(id) {
  await api.delete(`/bills/${id}/`);
}

export async function listUnbilledWorks() {
  const res = await api.get('/works/', { params: { unbilled: 'true' } });
  return res.data;
}
