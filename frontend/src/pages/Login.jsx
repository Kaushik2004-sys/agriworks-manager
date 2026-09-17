// Login page: Username or Registered Mobile Number + Password
// (existing email logins still work). Links to Create New Account and
// Forgot Password.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

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
      // {non_field_errors: [...]}, array, plain string). Generic
      // fallback only when nothing usable is present.
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
      setError(msg ? String(msg) : 'Login failed. Check backend connection.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container py-4 aw-auth-wrap">
      <div className="aw-brand-row">
        <img src="/logo.png" alt="AgriWorks logo" />
        <div>
          <h2 className="fw-bold mb-0">{t('Login')}</h2>
          <p className="text-muted mb-0">{t('Your digital register for farm work')}</p>
        </div>
      </div>

      <div className="aw-auth-card">
      {error && <div className="alert alert-danger" role="alert">{t(error)}</div>}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label" htmlFor="login-id">{t('Username or Registered Mobile Number')}</label>
          <input
            id="login-id"
            className="form-control"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            placeholder={t('Enter username or registered mobile number')}
          />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="login-password">{t('Password')}</label>
          <div className="input-group">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              className="form-control"
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
