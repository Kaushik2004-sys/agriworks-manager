// Phase 6: Payment API helpers (token attached by api.js interceptor).
import api from './api';

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];

export async function listPayments({ bill = '', search = '' } = {}) {
  const params = {};
  if (bill) params.bill = bill;
  if (search) params.search = search;
  const res = await api.get('/payments/', { params });
  return res.data;
}

export async function createPayment(data) {
  const res = await api.post('/payments/', data);
  return res.data;
}

export async function updatePayment(id, data) {
  const res = await api.put(`/payments/${id}/`, data);
  return res.data;
}

export async function deletePayment(id) {
  await api.delete(`/payments/${id}/`);
}
