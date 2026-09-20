// Contact & Report Problem page: public info for guests, full report form
// plus My Reports for authenticated users (token-gated, own reports only).
// A. Contact Support info (links to existing guides; no invented details).
// B. Report-a-Problem form saved to the database via the support API.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { PROBLEM_TYPES, createProblemReport, listProblemReports } from '../services/support';
import { INVALID_EMAIL_MESSAGE, isValidEmail } from '../utils/validateEmail';

const emptyForm = { name: '', email: '', problem_type: '', description: '', screenshot: null };

export default function ContactSupport() {
  const { user, token, loading } = useAuth();
  const { t } = useLanguage();
  const authed = !!(user && token);
  const [form, setForm] = useState(emptyForm);
  const [ok, setOk] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [listError, setListError] = useState('');

  // My Reports: the API returns only this user's own reports.
  // Re-fetched on every visit and after each submission, so an admin
  // status change (Pending -> Resolved) becomes visible on refresh.
  async function loadReports() {
    setLoadingReports(true);
    setListError('');
    try {
      const data = await listProblemReports();
      setReports(Array.isArray(data) ? data : data.results || []);
    } catch {
      setListError('Something went wrong. Please try again.');
    } finally {
      setLoadingReports(false);
    }
  }

  useEffect(() => {
    if (loading) return;
    // Guests make no authenticated requests: form and My Reports stay hidden.
    if (authed) loadReports();
    else setLoadingReports(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, authed]);

  function statusBadge(status) {
    if (status === 'Resolved') return 'badge bg-success';
    if (status === 'In Progress') return 'badge bg-info text-dark';
    return 'badge bg-warning text-dark';
  }

  const resolvedCount = reports.filter((r) => r.status === 'Resolved').length;

  // Name/Email are read-only and always reflect the logged-in account.
  useEffect(() => {
    if (user) {
      setForm((f) => ({
        ...f,
        name: user.profile?.full_name || user.username || '',
        email: user.email || '',
      }));
    }
  }, [user]);

  function validateForm() {
    if (!form.name.trim()) return 'Name is required.';
    // M13: same shared validator as Signup/Forgot Password (strict format
    // plus typo-domain rejection) - no new rule invented here.
    if (!isValidEmail(form.email)) return INVALID_EMAIL_MESSAGE;
    if (!PROBLEM_TYPES.includes(form.problem_type)) return 'Select a valid problem type.';
    if (!form.description.trim()) return 'Description must not be empty.';
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setOk('');
    const localError = validateForm();
    if (localError) {
      setError(localError);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createProblemReport({
        name: form.name.trim(),
        email: form.email.trim(),
        problem_type: form.problem_type,
        description: form.description.trim(),
        screenshot: form.screenshot,
      });
      setOk('Your problem has been submitted successfully.');
      loadReports();
      setForm({
        ...emptyForm,
        name: user?.profile?.full_name || user?.username || '',
        email: user?.email || '',
      });
    } catch (err) {
      // P11: show the backend validation message like other forms do;
      // keep entered data intact.
      const data = err?.response?.data;
      let msg = 'Save failed. Please try again.';
      if (data && typeof data === 'object') {
        const first = Object.values(data).flat().find((v) => typeof v === 'string' && v);
        if (first) msg = first;
      } else if (typeof data === 'string' && data) {
        msg = data;
      }
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container py-4">
      <BackButton to="/" label="Back to Home" />
      <h2 className="fw-bold">{t('Contact & Report Problem')}</h2>

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">{t('Contact Support')}</h5>
          <p className="text-muted small mb-2">
            {t('Questions about the app? Check the guides or send us a problem report below.')}
          </p>
          <p className="text-muted small mb-2">
            {t('Problem reports collect your name, email, problem type, description, and optional screenshot image. Screenshots are stored as uploaded files.')}
          </p>
          <div className="d-flex gap-2 flex-wrap">
            <Link to="/help-support" className="btn btn-outline-success btn-sm">{t('Help & Support')}</Link>
            <Link to="/faq" className="btn btn-outline-success btn-sm">{t('FAQ')}</Link>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-muted">{t('Checking login...')}</p>
      ) : !authed ? (
        <div className="card mb-3">
          <div className="card-body">
            <h5 className="card-title">{t('Report a Problem')}</h5>
            <p className="text-muted small mb-2">
              {t('Submitting a problem report requires an account. Please log in or create an account to report a problem.')}
            </p>
            <div className="d-flex gap-2 flex-wrap">
              <Link to="/login" className="btn btn-success btn-sm">{t('Login')}</Link>
              <Link to="/signup" className="btn btn-outline-success btn-sm">{t('Create Account')}</Link>
            </div>
          </div>
        </div>
      ) : (
        <>
      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">{t('Report a Problem')}</h5>
          {ok && <div className="alert alert-success">{t(ok)}</div>}
          {error && <ErrorState message={error} />}
          <form onSubmit={handleSubmit}>
            <div className="row g-2">
              <div className="col-12 col-md-6">
                <label className="form-label">{t('Name')} *</label>
                <input
                  className="form-control"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoComplete="name"
                  readOnly
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label">{t('Email')} *</label>
                <input
                  className="form-control"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  autoComplete="email"
                  readOnly
                />
              </div>
              <div className="col-12">
                <label className="form-label">{t('Problem Type')} *</label>
                <select
                  className="form-select"
                  value={form.problem_type}
                  onChange={(e) => setForm({ ...form, problem_type: e.target.value })}
                >
                  <option value="">{t('Select problem type')}</option>
                  {PROBLEM_TYPES.map((p) => (
                    <option key={p} value={p}>{t(p)}</option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label">{t('Description')} *</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="col-12">
                <label className="form-label">{t('Screenshot (optional)')}</label>
                <input
                  type="file"
                  accept="image/*"
                  className="form-control"
                  onChange={(e) => setForm({ ...form, screenshot: e.target.files?.[0] || null })}
                />
              </div>
            </div>
            <div className="mt-3 d-flex gap-2 flex-wrap">
              <button className="btn btn-success" type="submit" disabled={saving}>
                {saving ? t('Sending...') : t('Submit Problem')}
              </button>
              {user?.is_superuser && (
                <Link to="/admin/problem-reports" className="btn btn-outline-success">
                  {t('View all reports')}
                </Link>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">{t('My Reports')}</h5>
          {resolvedCount > 0 && (
            <div className="alert alert-success">{t('Your reported problem has been resolved.')}</div>
          )}
          {listError && <ErrorState message={listError} onRetry={loadReports} />}
          {loadingReports ? (
            <p className="text-muted">{t('Loading reports...')}</p>
          ) : reports.length === 0 ? (
            <EmptyState message="No problem reports found." />
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-bordered aw-cards-table">
                <thead className="table-success">
                  <tr>
                    <th>{t('Date')}</th>
                    <th>{t('Problem Type')}</th>
                    <th>{t('Description')}</th>
                    <th>{t('Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td data-label={t('Date')} className="text-nowrap">{String(r.created_at || '').slice(0, 10)}</td>
                      <td data-label={t('Problem Type')}>{t(r.problem_type)}</td>
                      <td data-label={t('Description')}>{r.description}</td>
                      <td data-label={t('Status')}><span className={statusBadge(r.status)}>{t(r.status)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
}
