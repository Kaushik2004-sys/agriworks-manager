// Phase 9: Reports API helper (real DB records with filters).
import api from './api';

export const REPORT_TYPES = [
  { value: 'work', label: 'Agricultural Work Report' },
  { value: 'billing', label: 'Billing Report' },
  { value: 'payment', label: 'Payment Report' },
  { value: 'pending', label: 'Pending Payment Report' },
  { value: 'expense', label: 'Expense Report' },
  { value: 'performance', label: 'Business Performance Report' },
];

export async function getReport(type, filters = {}) {
  const params = { type, ...filters };
  // Drop empty filters
  Object.keys(params).forEach((k) => {
    if (params[k] === '' || params[k] == null) delete params[k];
  });
  const res = await api.get('/reports/', { params });
  return res.data;
}
