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

// Company Name is optional: blank stays valid, otherwise Unicode
// letters, numbers, spaces and & . - ' only (whitespace-only rejected).
function isValidCompanyName(v) {
  if (v === '') return true;
  const t = v.trim();
  return !!t && /^[\p{L}\p{M}\p{Nd} &.\-']+$/u.test(t);
}

export default function Signup() {
  const { register } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [touched, setTouched] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    touch(key);
  }

  function touch(key) {
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }

  // Single-field validation used both for real-time feedback (while
  // typing, once the field has been touched) and for submit validation.
  // Rules are identical in both cases; backend remains authoritative.
  function getFieldError(key, f = form) {
    const v = f[key] ?? '';
    switch (key) {
      case 'full_name':
        if (!v.trim()) return 'Full Name is required.';
        if (!/^\p{L}[\p{L}\p{M}]*( \p{L}[\p{L}\p{M}]*)*$/u.test(v)) {
          return 'Full Name must contain only letters with single spaces between words.';
        }
        return '';
      case 'last_name':
        if (!v.trim()) return 'Last Name is required.';
        if (!/^\p{L}[\p{L}\p{M}]*$/u.test(v)) {
          return 'Last Name must contain only letters without spaces.';
        }
        if (v.trim().length > 150) return 'Last Name is too long.';
        return '';
      case 'email':
        if (!v.trim()) return 'Email is required.';
        if (!isValidEmail(v)) return INVALID_EMAIL_MESSAGE;
        return '';
      case 'company_name':
        if (!isValidCompanyName(v)) return 'Company Name contains invalid characters.';
        return '';
      case 'mobile':
        if (!/^[6-9]\d{9}$/.test(v.trim())) return 'Mobile Number must be 10 digits.';
        return '';
      case 'password':
        if (!v) return 'Password is required.';
        return passwordError(v) || '';
      case 'confirm_password':
        if (f.password !== v) return 'Passwords do not match.';
        return '';
      default:
        return '';
    }
  }

  function validate() {
    for (const key of ['full_name', 'last_name', 'email', 'company_name', 'mobile', 'password', 'confirm_password']) {
      const msg = getFieldError(key);
      if (msg) return msg;
    }
    return '';
  }

  // Real-time feedback element for one field (rendered only after touch).
  // Messages are English keys rendered through t(), so language switching
  // updates visible errors automatically.
  function fieldFeedback(key) {
    if (!touched[key]) return null;
    const msg = getFieldError(key);
    if (!msg) return null;
    return <div className="invalid-feedback d-block">{t(msg)}</div>;
  }

  function fieldClass(key) {
    return `form-control${touched[key] && getFieldError(key) ? ' is-invalid' : ''}`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setTouched({
      full_name: true, last_name: true, company_name: true, email: true,
      mobile: true, password: true, confirm_password: true,
    });
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
              className={fieldClass('full_name')}
              value={form.full_name}
              onChange={(e) => set('full_name', e.target.value)}
              onBlur={() => touch('full_name')}
              autoComplete="given-name"
            />
            {fieldFeedback('full_name')}
          </div>
          <div className="col-12 col-md-6 mb-3">
            <label className="form-label">{t('Last Name *')}</label>
            <input
              className={fieldClass('last_name')}
              value={form.last_name}
              onChange={(e) => set('last_name', e.target.value)}
              onBlur={() => touch('last_name')}
              autoComplete="family-name"
            />
            {fieldFeedback('last_name')}
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label">{t('Company / Business Name')} <span className="text-muted">{t('(optional)')}</span></label>
            <input
              className={fieldClass('company_name')}
              value={form.company_name}
              onChange={(e) => set('company_name', e.target.value)}
              onBlur={() => touch('company_name')}
              placeholder={t('Leave blank if none')}
              autoComplete="organization"
            />
            {fieldFeedback('company_name')}
        </div>
        <div className="row g-2">
          <div className="col-12 col-md-6 mb-3">
            <label className="form-label">{t('Email *')}</label>
            <input
              type="email"
              className={fieldClass('email')}
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              onBlur={() => touch('email')}
              autoComplete="email"
            />
            {fieldFeedback('email')}
          </div>
          <div className="col-12 col-md-6 mb-3">
            <label className="form-label">{t('Mobile Number *')}</label>
            <div className="input-group">
              <span className="input-group-text" aria-hidden="true">+91</span>
<input
                  className={fieldClass('mobile')}
                  value={form.mobile}
                  onChange={(e) => set('mobile', e.target.value)}
                  onBlur={() => touch('mobile')}
                  maxLength={10}
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder={t('Enter 10-digit mobile number')}
                  pattern="[6-9][0-9]{9}"
                  aria-label={t('Mobile Number *')}
                />
            </div>
            {fieldFeedback('mobile')}
          </div>
        </div>
        <div className="row g-2">
          <div className="col-12 col-md-6 mb-3">
            <label className="form-label">{t('Password *')}</label>
            <input
              type="password"
              className={fieldClass('password')}
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              onBlur={() => touch('password')}
              autoComplete="new-password"
            />
            {fieldFeedback('password')}
            <div className="form-text">{t(PASSWORD_HINT)}</div>
          </div>
          <div className="col-12 col-md-6 mb-3">
            <label className="form-label">{t('Confirm Password *')}</label>
            <input
              type="password"
              className={fieldClass('confirm_password')}
              value={form.confirm_password}
              onChange={(e) => set('confirm_password', e.target.value)}
              onBlur={() => touch('confirm_password')}
              autoComplete="new-password"
            />
            {fieldFeedback('confirm_password')}
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
