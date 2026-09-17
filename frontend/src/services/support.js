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

// P3: screenshots download through the authenticated API (owner or
// admin only) as a blob, so the file is never exposed on an anonymous
// guessable URL. Returns an object URL for viewing.
export async function fetchScreenshotUrl(path) {
  const filename = String(path || '').split('/').pop();
  if (!filename) throw new Error('Screenshot not found.');
  const res = await api.get(`/problem-screenshots/${encodeURIComponent(filename)}`, {
    responseType: 'blob',
  });
  return URL.createObjectURL(res.data);
}
