// Contact & Report Problem page (authenticated users).
// A. Contact Support info (links to existing guides; no invented details).
// B. Report-a-Problem form saved to the database via the support API.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import ErrorState from '../components/ErrorState';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { PROBLEM_TYPES, createProblemReport } from '../services/support';

const emptyForm = { name: '', email: '', problem_type: '', description: '', screenshot: null };

export default function ContactSupport() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [form, setForm] = useState(emptyForm);
  const [ok, setOk] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Prefill from the logged-in account; never overwrite what the user typed.
  useEffect(() => {
    if (user) {
      setForm((f) => ({
        ...f,
        name: f.name || user.profile?.full_name || user.username || '',
        email: f.email || user.email || '',
      }));
    }
  }, [user]);

  function validateForm() {
    if (!form.name.trim()) return 'Name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid email address.';
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
      setForm({
        ...emptyForm,
        name: user?.profile?.full_name || user?.username || '',
        email: user?.email || '',
      });
    } catch {
      // Keep entered data intact; no technical details exposed.
      setError('Save failed. Please try again.');
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
          <div className="d-flex gap-2 flex-wrap">
            <Link to="/help-support" className="btn btn-outline-success btn-sm">{t('Help & Support')}</Link>
            <Link to="/faq" className="btn btn-outline-success btn-sm">{t('FAQ')}</Link>
          </div>
        </div>
      </div>

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
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label">{t('Email')} *</label>
                <input
                  className="form-control"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  autoComplete="email"
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
    </div>
  );
}
