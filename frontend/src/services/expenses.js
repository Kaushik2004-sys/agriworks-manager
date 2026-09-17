// Phase 7: Expense API helpers (token attached by api.js interceptor).
import api from './api';

export const EXPENSE_TYPES = ['Diesel', 'Maintenance', 'Driver Wages', 'Other'];

export async function listExpenses({ search = '', expense_type = '' } = {}) {
  const params = {};
  if (search) params.search = search;
  if (expense_type) params.expense_type = expense_type;
  const res = await api.get('/expenses/', { params });
  return res.data;
}

export async function createExpense(data) {
  const res = await api.post('/expenses/', data);
  return res.data;
}

// NOTE: expenses are immutable once recorded (backend rejects PUT/PATCH
// with 405). Corrections use a new expense record, so no update helper exists.

export async function deleteExpense(id) {
  await api.delete(`/expenses/${id}/`);
}
