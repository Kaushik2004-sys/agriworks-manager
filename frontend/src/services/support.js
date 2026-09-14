// Problem report API helpers (Contact & Report Problem feature).
// Token attached by the shared api.js interceptor.
import api from './api';

export const PROBLEM_TYPES = [
  'Login Problem',
  'Work Record Problem',
  'Billing Problem',
  'Payment Problem',
  'Report Problem',
  'Dashboard Problem',
  'Language Problem',
  'Other',
];

export const REPORT_STATUSES = ['Pending', 'In Progress', 'Resolved'];

export async function listProblemReports() {
  const res = await api.get('/problem-reports/');
  return res.data;
}

export async function createProblemReport({ name, email, problem_type, description, screenshot }) {
  // Multipart only when a screenshot file is attached; otherwise plain JSON.
  if (screenshot) {
    const form = new FormData();
    form.append('name', name);
    form.append('email', email);
    form.append('problem_type', problem_type);
    form.append('description', description);
    form.append('screenshot', screenshot);
    const res = await api.post('/problem-reports/', form);
    return res.data;
  }
  const res = await api.post('/problem-reports/', { name, email, problem_type, description });
  return res.data;
}

export async function updateProblemReportStatus(id, status) {
  const res = await api.patch(`/problem-reports/${id}/`, { status });
  return res.data;
}

export async function deleteProblemReport(id) {
  await api.delete(`/problem-reports/${id}/`);
}

// Screenshot paths from the API are backend-relative (/media/...);
// resolve them against the API host so they open correctly in the browser.
export function screenshotUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const base = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').replace(/\/api\/?$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
