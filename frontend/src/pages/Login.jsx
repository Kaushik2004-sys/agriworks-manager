// Login page: Email + Password (existing username logins still work).
// Links to Create New Account and Forgot Password.
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
      const msg = err.response?.data?.error || 'Login failed. Check backend connection.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container py-4" style={{ maxWidth: 420 }}>
      <h2 className="fw-bold mb-1">{t('Login')}</h2>
      <p className="text-muted">{t('Secure access to AgriWorks Manager')}</p>

      {error && <div className="alert alert-danger">{t(error)}</div>}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">{t('Email')}</label>
          <input
            className="form-control"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="email"
            placeholder={t('Enter your registered email')}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">{t('Password')}</label>
          <div className="input-group">
            <input
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
  );
}
