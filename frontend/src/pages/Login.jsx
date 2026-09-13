// Login page: Email + Password (existing username logins still work).
// Links to Create New Account and Forgot Password.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export default function Login() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
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
      navigate('/');
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
            placeholder={t('Email (usernames like admin still work)')}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">{t('Password')}</label>
          <input
            type="password"
            className="form-control"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <button className="btn btn-success w-100" disabled={busy} type="submit">
          {busy ? t('Logging in...') : t('Login')}
        </button>
      </form>

      <div className="d-flex justify-content-between flex-wrap gap-2 mt-3">
        <Link to="/signup">{t('Create New Account')}</Link>
        <Link to="/forgot-password">{t('Forgot Password?')}</Link>
      </div>

      <div className="alert alert-info mt-3 small mb-0">
        {t('Test user:')} <code>admin / admin123</code> {t('(created by backend setup).')}
      </div>
    </div>
  );
}
