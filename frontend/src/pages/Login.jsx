// Login page: Email or Registered Mobile Number + Password
// (existing email logins still work). Links to Create New Account and
// Forgot Password.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

// Inline field icons in the project's existing 24x24 stroke style
// (same as StatIcon: currentColor, no new dependency). Decorative only.
const FIELD_ICON_STYLE = {
  position: 'absolute',
  left: '0.75rem',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 18,
  height: 18,
  pointerEvents: 'none',
  zIndex: 6,
};
const FIELD_INPUT_STYLE = { paddingLeft: '2.4rem' };

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={FIELD_ICON_STYLE} className="text-muted" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1-4 4-6 7-6s6 2 7 6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={FIELD_ICON_STYLE} className="text-muted" aria-hidden="true" focusable="false">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export default function Login() {
  const { login, refreshUser } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Frontend validation: both fields required
    if (!identifier.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    setBusy(true);
    try {
      await login(identifier.trim(), password);
      // Superusers land on the Admin Dashboard; everyone else goes Home.
      let isAdmin = false;
      try {
        const me = await refreshUser();
        isAdmin = !!me?.is_superuser;
      } catch {
        isAdmin = false;
      }
      // Replace login in history and arm post-login collapse of any
      // older pre-login entries (see CollapseStaleHistory in App.jsx).
      sessionStorage.setItem('aw_post_login', '1');
      navigate(isAdmin ? '/admin/dashboard' : '/', { replace: true });
    } catch (err) {
      // M12: extract the real backend message from any DRF shape
      // ({error}, {detail} e.g. throttled 429s, {field: [...]},
      // {non_field_errors: [...]}, array, plain string). A production
      // 500 returns an HTML error page, which must never be dumped into
      // the UI - it carries no usable message. Status-based fallbacks
      // apply only when no backend message could be extracted, so real
      // messages (401 invalid credentials, 429 detail, validation
      // errors) keep working exactly as before.
      const status = err.response?.status;
      const data = err.response?.data;
      let msg = '';
      if (typeof data === 'string' && !data.trim().startsWith('<')) msg = data;
      else if (typeof data?.error === 'string') msg = data.error;
      else if (typeof data?.detail === 'string') msg = data.detail;
      else if (Array.isArray(data) && data.length) msg = data[0];
      else if (data && typeof data === 'object') {
        const first = Object.values(data).flat().find(Boolean);
        msg = Array.isArray(first) ? first[0] : first;
      }
      if (!msg) {
        if (status === 401) msg = 'Invalid email or password.';
        else if (status === 429) msg = 'Too many attempts. Please try again later.';
        else if (status >= 500) msg = 'Server error. Please try again later.';
      }
      setError(msg ? String(msg) : 'Login failed. Check backend connection.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container py-4 aw-auth-wrap aw-login-farm">
      <div className="text-center mb-3">
        <h2 className="fw-bold mb-0">{t('Login')}</h2>
        <p className="text-muted mb-0">{t('Manage farm work easily')}</p>
      </div>

      <div className="aw-auth-card">
      {error && <div className="alert alert-danger" role="alert">{t(error)}</div>}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label" htmlFor="login-id">{t('Email or Registered Mobile Number')}</label>
          <div className="position-relative">
            <PersonIcon />
            <input
              id="login-id"
              className="form-control"
              style={FIELD_INPUT_STYLE}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              placeholder={t('Enter Email or Registered Mobile Number')}
            />
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="login-password">{t('Password')}</label>
          <div className="input-group">
            <LockIcon />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              className="form-control"
              style={FIELD_INPUT_STYLE}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder={t('Enter your password')}
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
        </div>
        <button className="btn btn-success w-100" disabled={busy} type="submit">
          {busy ? t('Logging in...') : t('Login')}
        </button>
      </form>

      <div className="d-flex justify-content-between flex-wrap gap-2 mt-3">
        {/* Auth-to-auth moves replace so at most one auth page ever sits in history. */}
        <Link to="/signup" replace>{t('Create New Account')}</Link>
        <Link to="/forgot-password" replace>{t('Forgot Password?')}</Link>
      </div>
      </div>
    </div>
  );
}
