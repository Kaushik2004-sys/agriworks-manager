// Auth update: Create Account page.
// Fields: Full Name (required), Last Name (required),
// Company/Business Name (optional),
// Email (required, unique, valid), Mobile (10 digits),
// Password + Confirm Password (must match, hashed by Django backend).
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { INVALID_EMAIL_MESSAGE, isValidEmail } from '../utils/validateEmail';
import { PASSWORD_HINT, passwordError } from '../utils/validatePassword';

const emptyForm = {
  full_name: '',
  last_name: '',
  company_name: '',
  email: '',
  mobile: '',
  password: '',
  confirm_password: '',
};

export default function Signup() {
  const { register } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate() {
    if (!form.full_name.trim()) return 'Full Name is required.';
    if (!/^[A-Za-z]+( [A-Za-z]+)*$/.test(form.full_name)) {
      return 'Full Name must contain only letters (A-Z, a-z) and single spaces.';
    }
    if (!form.last_name.trim()) return 'Last Name is required.';
    if (!/^[A-Za-z]+$/.test(form.last_name)) {
      return 'Last Name must contain only letters (A-Z, a-z).';
    }
    if (form.last_name.trim().length > 150) return 'Last Name is too long.';
    if (!form.email.trim()) return 'Email is required.';
    if (!isValidEmail(form.email)) {
      return INVALID_EMAIL_MESSAGE;
    }
    if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) {
      return 'Mobile Number must be 10 digits.';
    }
    if (!form.password) return 'Password is required.';
    const pwErr = passwordError(form.password);
    if (pwErr) return pwErr;
    if (form.password !== form.confirm_password) return 'Passwords do not match.';
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const localError = validate();
    if (localError) {
      setError(localError);
      return;
    }
    setBusy(true);
    try {
      await register({
        full_name: form.full_name.trim(),
        last_name: form.last_name.trim(),
        company_name: form.company_name.trim(), // optional - may be empty
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        password: form.password,
        confirm_password: form.confirm_password,
      });
      // Replace register in history and arm post-login collapse of any
      // older pre-login entries (see CollapseStaleHistory in App.jsx).
      sessionStorage.setItem('aw_post_login', '1');
      navigate('/', { replace: true });
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const firstKey = Object.keys(data)[0];
        const val = data[firstKey];
        const firstMsg = Array.isArray(val) ? val[0] : String(val);
        setError(firstKey === 'non_field_errors' ? firstMsg : `${firstKey}: ${firstMsg}`);
      } else {
        setError('Registration failed. Check backend connection.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container py-4 aw-auth-wrap" style={{ maxWidth: 560 }}>
      <h2 className="fw-bold mb-1">{t('Create Account')}</h2>
      <p className="text-muted">{t('Join AgriWorks — your digital register')}</p>

      <div className="aw-auth-card">
      {error && <div className="alert alert-danger" role="alert">{t(error)}</div>}

      <form onSubmit={handleSubmit}>
        <div className="row g-2">
          <div className="col-12 col-md-6 mb-3">
            <label className="form-label">{t('Full Name *')}</label>
            <input
              className="form-control"
              value={form.full_name}
              onChange={(e) => set('full_name', e.target.value)}
              autoComplete="given-name"
            />
          </div>
          <div className="col-12 col-md-6 mb-3">
            <label className="form-label">{t('Last Name *')}</label>
            <input
              className="form-control"
              value={form.last_name}
              onChange={(e) => set('last_name', e.target.value)}
              autoComplete="family-name"
            />
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label">{t('Company / Business Name')} <span className="text-muted">{t('(optional)')}</span></label>
          <input
            className="form-control"
            value={form.company_name}
            onChange={(e) => set('company_name', e.target.value)}
            placeholder={t('Leave blank if none')}
            autoComplete="organization"
          />
        </div>
        <div className="row g-2">
          <div className="col-12 col-md-6 mb-3">
            <label className="form-label">{t('Email *')}</label>
            <input
              type="email"
              className="form-control"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="col-12 col-md-6 mb-3">
            <label className="form-label">{t('Mobile Number *')}</label>
            <div className="input-group">
              <span className="input-group-text" aria-hidden="true">+91</span>
<input
                  className="form-control"
                  value={form.mobile}
                  onChange={(e) => set('mobile', e.target.value)}
                  maxLength={10}
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="0000000000"
                  pattern="[6-9][0-9]{9}"
                  aria-label={t('Mobile Number *')}
                />
            </div>
          </div>
        </div>
        <div className="row g-2">
          <div className="col-12 col-md-6 mb-3">
            <label className="form-label">{t('Password *')}</label>
            <input
              type="password"
              className="form-control"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              autoComplete="new-password"
            />
            <div className="form-text">{t(PASSWORD_HINT)}</div>
          </div>
          <div className="col-12 col-md-6 mb-3">
            <label className="form-label">{t('Confirm Password *')}</label>
            <input
              type="password"
              className="form-control"
              value={form.confirm_password}
              onChange={(e) => set('confirm_password', e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
        <button className="btn btn-success w-100" disabled={busy} type="submit">
          {busy ? t('Creating account...') : t('Create Account')}
        </button>
      </form>

      <p className="text-center mt-3 mb-0">
        {t('Already have an account? ')}<Link to="/login" replace>{t('Login')}</Link>
      </p>
      </div>
    </div>
  );
}
