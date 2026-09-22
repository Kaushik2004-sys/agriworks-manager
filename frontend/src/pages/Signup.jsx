// Auth update: Create Account page.
// Fields: Full Name (required), Last Name (required),
// Company/Business Name (optional),
// Email (required, unique, valid), Mobile (10 digits),
// Password + Confirm Password (must match, hashed by Django backend).
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GoogleSignInButton from '../components/GoogleSignInButton';
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
  const { register, googleLogin } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [touched, setTouched] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Google sign-up state: the GIS credential lives only in memory for
  // this flow (never storage) and is cleared after use/cancel.
  const [googleCredential, setGoogleCredential] = useState('');
  const [showMobileStep, setShowMobileStep] = useState(false);
  const [gMobile, setGMobile] = useState('');
  const [gMobileError, setGMobileError] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);
  const googleBusyRef = useRef(false);
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

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
        // Backend messages are shown bare (translated via t() when a
        // translation exists) instead of prefixed with the raw API
        // field key, so users never see technical prefixes like
        // "email:" or "detail:" and existing translations match.
        setError(firstMsg);
      } else {
        setError('Registration failed. Check backend connection.');
      }
    } finally {
      setBusy(false);
    }
  }

  // Google sign-up: keep the credential in memory, collect the required
  // mobile number first, then authenticate once with credential + mobile.
  function handleGoogleCredential(credential) {
    if (googleBusyRef.current || !credential) return;
    setError('');
    setGMobileError('');
    setGMobile(form.mobile);
    setGoogleCredential(credential);
    setShowMobileStep(true);
  }

  function cancelGoogleSignup() {
    if (googleBusy) return;
    setGoogleCredential('');
    setShowMobileStep(false);
    setGMobileError('');
  }

  async function handleGoogleMobileSubmit(e) {
    e.preventDefault();
    if (googleBusyRef.current) return;
    const mobile = (gMobile || '').trim();
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setGMobileError('Mobile Number must be 10 digits.');
      return;
    }
    googleBusyRef.current = true;
    setGoogleBusy(true);
    setGMobileError('');
    setError('');
    try {
      await googleLogin(googleCredential, mobile);
      sessionStorage.setItem('aw_post_login', '1');
      navigate('/', { replace: true });
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      let msg = '';
      if (typeof data?.error === 'string' && data.error
        && !(status === 409 && data?.code === 'google_not_linked')) msg = data.error;
      if (!msg) {
        if (status === 401) msg = 'Invalid Google credential.';
        else if (status === 503) msg = 'Google sign-in is temporarily unavailable. Please try again later.';
        else if (status === 409) msg = 'This Google account is not linked to an AgriWorks account. Please log in with your password first.';
      }
      setShowMobileStep(false);
      setError(msg ? String(msg) : 'Something went wrong. Please try again.');
    } finally {
      setGoogleCredential('');
      googleBusyRef.current = false;
      setGoogleBusy(false);
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
            <div className="input-group">
              <input
                type={showPassword ? 'text' : 'password'}
                className={fieldClass('password')}
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                onBlur={() => touch('password')}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={t(showPassword ? 'Hide' : 'Show')}
                aria-pressed={showPassword}
              >
                {t(showPassword ? 'Hide' : 'Show')}
              </button>
            </div>
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

      {googleClientId && !showMobileStep && (
        <>
          <div className="d-flex align-items-center gap-2 my-3" aria-hidden="true">
            <hr className="flex-grow-1 my-0" />
            <span className="text-muted small">{t('or')}</span>
            <hr className="flex-grow-1 my-0" />
          </div>
          <GoogleSignInButton text="continue_with" onCredential={handleGoogleCredential} disabled={googleBusy || busy} />
        </>
      )}
      {googleClientId && showMobileStep && (
        <div className="card mt-3">
          <div className="card-body">
            <h6 className="fw-bold mb-2">{t('Complete Google signup')}</h6>
            <form onSubmit={handleGoogleMobileSubmit}>
              <label className="form-label">{t('Mobile Number *')}</label>
              <div className="input-group">
                <span className="input-group-text" aria-hidden="true">+91</span>
                <input
                  value={gMobile}
                  onChange={(e) => setGMobile(e.target.value)}
                  maxLength={10}
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder={t('Enter 10-digit mobile number')}
                  aria-label={t('Mobile Number *')}
                />
              </div>
              {gMobileError && <div className="text-danger small mt-1">{t(gMobileError)}</div>}
              <div className="d-flex gap-2 mt-3">
                <button className="btn btn-success flex-grow-1" type="submit" disabled={googleBusy}>
                  {t('Continue')}
                </button>
                <button className="btn btn-outline-secondary" type="button" onClick={cancelGoogleSignup} disabled={googleBusy}>
                  {t('Cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <p className="text-center mt-3 mb-0">
        {t('Already have an account? ')}<Link to="/login" replace>{t('Login')}</Link>
      </p>
      </div>
    </div>
  );
}
