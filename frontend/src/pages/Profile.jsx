// Profile Management page: view + edit own profile, change password.
// Email is read-only. Consistent Bootstrap styling, mobile responsive.
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import BackButton from '../components/BackButton';
import ErrorState from '../components/ErrorState';
import { useLanguage } from '../i18n/LanguageContext';
import { PASSWORD_HINT, passwordError } from '../utils/validatePassword';

// Company Name is optional: blank stays valid, otherwise Unicode
// letters, numbers, spaces and & . - ' only (whitespace-only rejected).
function isValidCompanyName(v) {
  if (v === '') return true;
  const t = v.trim();
  return !!t && /^[\p{L}\p{M}\p{Nd} &.\-']+$/u.test(t);
}

export default function Profile() {
  const { user, loadProfile, updateProfile, changePassword } = useAuth();
  const { t } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: '', last_name: '', company_name: '', mobile: '' });
  const [formError, setFormError] = useState('');
  const [formOk, setFormOk] = useState('');
  const [saving, setSaving] = useState(false);

  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwError, setPwError] = useState('');
  const [pwOk, setPwOk] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  // M11: extract one user-friendly message from common DRF error shapes
  // ({field: [...]}, {non_field_errors: [...]}, {error}, {detail}, plain
  // string). Never raw objects or stack traces; fallback when unknown.
  function backendMessage(err, fallback) {
    const data = err.response?.data;
    let msg = '';
    if (typeof data === 'string') msg = data;
    else if (typeof data?.error === 'string') msg = data.error;
    else if (typeof data?.detail === 'string') msg = data.detail;
    else if (Array.isArray(data) && data.length) msg = data[0];
    else if (data && typeof data === 'object') {
      const first = Object.values(data).flat().find(Boolean);
      msg = Array.isArray(first) ? first[0] : first;
    }
    return msg ? String(msg) : fallback;
  }

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      const data = await loadProfile();
      setProfile(data);
      setForm({
        full_name: data.profile?.full_name || '',
        last_name: data.profile?.last_name || '',
        company_name: data.profile?.company_name || '',
        mobile: data.profile?.mobile || '',
      });
    } catch (err) {
      // M11: HTTP 401/403 means the stored token was rejected - the
      // existing AuthContext + API interceptor already clear the session
      // and route to Login, so report a session problem. Anything without
      // a response status is genuinely unreachable backend - never claim
      // the session is invalid in that case.
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        setLoadError('Your session has expired. Please log in again.');
      } else {
        setLoadError('Cannot load profile. Check backend connection.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validateProfile() {
    if (!form.full_name.trim()) return 'Full Name is required.';
    if (form.full_name.trim().length > 150) return 'Full Name is too long.';
    if (!/^\p{L}[\p{L}\p{M}]*( \p{L}[\p{L}\p{M}]*)*$/u.test(form.full_name)) {
      return 'Full Name must contain only letters with single spaces between words.';
    }
    if (!form.last_name.trim()) return 'Last Name is required.';
    if (form.last_name.trim().length > 150) return 'Last Name is too long.';
    if (!/^\p{L}[\p{L}\p{M}]*$/u.test(form.last_name)) {
      return 'Last Name must contain only letters without spaces.';
    }
    if (form.company_name.trim().length > 150) return 'Company / Business Name is too long.';
    if (!isValidCompanyName(form.company_name)) {
      return 'Company Name contains invalid characters.';
    }
    if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) return 'Mobile Number must be 10 digits.';
    return '';
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError('');
    setFormOk('');
    const localError = validateProfile();
    if (localError) {
      setFormError(localError);
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProfile({
        full_name: form.full_name.trim(),
        last_name: form.last_name.trim(),
        company_name: form.company_name.trim(),
        mobile: form.mobile.trim(),
      });
      setProfile(updated);
      setEditing(false);
      setFormOk('Profile updated successfully.');
    } catch (err) {
      // Keep form data intact; show the actual backend validation message.
      setFormError(backendMessage(err, 'Save failed. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  function validatePassword() {
    if (!pw.current_password) return 'Current Password is required.';
    if (!pw.new_password) return 'New Password is required.';
    const pwErr = passwordError(pw.new_password);
    if (pwErr) return pwErr;
    if (pw.new_password !== pw.confirm_password) return 'Passwords do not match.';
    return '';
  }

  async function handlePassword(e) {
    e.preventDefault();
    setPwError('');
    setPwOk('');
    const localError = validatePassword();
    if (localError) {
      setPwError(localError);
      return;
    }
    setPwBusy(true);
    try {
      const res = await changePassword({
        current_password: pw.current_password,
        new_password: pw.new_password,
        confirm_password: pw.confirm_password,
      });
      setPwOk(res.message || 'Password changed successfully.');
      setPw({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      // Same surfacing as profile save (e.g. wrong current password).
      setPwError(backendMessage(err, 'Save failed. Please try again.'));
    } finally {
      setPwBusy(false);
    }
  }

  if (loading) return <div className="container py-4 text-muted">{t('Loading profile...')}</div>;
  if (loadError) {
    return (
      <div className="container py-4">
        <h2 className="fw-bold">{t('Profile')}</h2>
        <div className="mt-3"><ErrorState message={loadError} onRetry={load} /></div>
      </div>
    );
  }

  const email = profile?.email || user?.email || '';

  return (
    <div className="container py-4" style={{ maxWidth: 640 }}>
      <BackButton to="/" />
      <h2 className="fw-bold">{t('Profile')}</h2>
      <p className="text-muted">{t('View and manage your account information.')}</p>

      <div className="card mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h5 className="card-title mb-0">{t('My Information')}</h5>
            {!editing && (
              <button className="btn btn-outline-success btn-sm" onClick={() => setEditing(true)}>
                {t('Edit Profile')}
              </button>
            )}
          </div>

          {formOk && <div className="alert alert-success">{t(formOk)}</div>}
          {formError && <div className="alert alert-danger">{t(formError)}</div>}

          {!editing ? (
            <dl className="row mb-0">
              <dt className="col-5 col-md-4">{t('Full Name')}</dt>
              <dd className="col-7 col-md-8">{profile?.profile?.full_name || '—'}</dd>
              <dt className="col-5 col-md-4">{t('Last Name')}</dt>
              <dd className="col-7 col-md-8">{profile?.profile?.last_name || '—'}</dd>
              <dt className="col-5 col-md-4">{t('Company')}</dt>
              <dd className="col-7 col-md-8">{profile?.profile?.company_name || '—'}</dd>
              <dt className="col-5 col-md-4">{t('Email')}</dt>
              <dd className="col-7 col-md-8 text-break">{email || '—'}</dd>
              <dt className="col-5 col-md-4">{t('Mobile')}</dt>
              <dd className="col-7 col-md-8">{profile?.profile?.mobile || '—'}</dd>
            </dl>
          ) : (
            <form onSubmit={handleSave}>
              <div className="row g-2">
                <div className="col-12 col-md-6 mb-3">
                  <label className="form-label">{t('Full Name *')}</label>
                  <input
                    className="form-control"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    autoComplete="given-name"
                  />
                </div>
                <div className="col-12 col-md-6 mb-3">
                  <label className="form-label">{t('Last Name *')}</label>
                  <input
                    className="form-control"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    autoComplete="family-name"
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">
                  {t('Company / Business Name')} <span className="text-muted">{t('(optional)')}</span>
                </label>
                <input
                  className="form-control"
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">{t('Email')}</label>
                <input className="form-control" value={email} disabled readOnly />
                <div className="form-text">{t('Email cannot be changed here.')}</div>
              </div>
              <div className="mb-3">
                <label className="form-label">{t('Mobile Number *')}</label>
                <div className="input-group">
                  <span className="input-group-text" aria-hidden="true">+91</span>
                  <input
                    className="form-control"
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    maxLength={10}
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder={t('Enter 10-digit mobile number')}
                    pattern="[6-9][0-9]{9}"
                    aria-label={t('Mobile Number *')}
                  />
                </div>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <button className="btn btn-success" type="submit" disabled={saving}>
                  {saving ? t('Saving...') : t('Save Changes')}
                </button>
                <button
                  className="btn btn-secondary" type="button"
                  onClick={() => {
                    setEditing(false);
                    setFormError('');
                    setForm({
                      full_name: profile?.profile?.full_name || '',
                      last_name: profile?.profile?.last_name || '',
                      company_name: profile?.profile?.company_name || '',
                      mobile: profile?.profile?.mobile || '',
                    });
                  }}
                >
                  {t('Cancel')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h5 className="card-title">{t('Change Password')}</h5>
          {pwOk && <div className="alert alert-success">{t(pwOk)}</div>}
          {pwError && <div className="alert alert-danger">{t(pwError)}</div>}
          <form onSubmit={handlePassword}>
            <div className="mb-3">
              <label className="form-label">{t('Current Password *')}</label>
              <input
                type="password"
                className="form-control"
                value={pw.current_password}
                onChange={(e) => setPw({ ...pw, current_password: e.target.value })}
                autoComplete="current-password"
              />
            </div>
            <div className="row g-2">
              <div className="col-12 col-md-6 mb-3">
                <label className="form-label">{t('New Password *')}</label>
                <input
                  type="password"
                  className="form-control"
                  value={pw.new_password}
                  onChange={(e) => setPw({ ...pw, new_password: e.target.value })}
                  autoComplete="new-password"
                />
                <div className="form-text">{t(PASSWORD_HINT)}</div>
              </div>
              <div className="col-12 col-md-6 mb-3">
                <label className="form-label">{t('Confirm New Password *')}</label>
                <input
                  type="password"
                  className="form-control"
                  value={pw.confirm_password}
                  onChange={(e) => setPw({ ...pw, confirm_password: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <button className="btn btn-success" type="submit" disabled={pwBusy}>
              {pwBusy ? t('Changing...') : t('Change Password')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
