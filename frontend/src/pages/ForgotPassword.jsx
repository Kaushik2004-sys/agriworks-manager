// Auth update: Forgot Password page (email reset link flow).
// The user enters their registered email address; the backend emails a
// single-use reset link. Only a confirmation message is displayed here.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import { INVALID_EMAIL_MESSAGE, isValidEmail } from '../utils/validateEmail';

export default function ForgotPassword() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    if (!isValidEmail(email)) {
      setError(INVALID_EMAIL_MESSAGE);
      return;
    }
    setBusy(true);
    try {
      const data = await requestPasswordReset(email.trim());
      setMessage(data.message || 'If an account exists with this email address, a password reset link has been sent.');
    } catch (err) {
      setError(err.response?.data?.error || 'Request failed. Check backend connection.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container py-4" style={{ maxWidth: 420 }}>
      <h2 className="fw-bold mb-1">{t('Forgot Password')}</h2>
      <p className="text-muted">{t('Enter your registered email address. We will send you a password reset link.')}</p>

      {error && <div className="alert alert-danger">{t(error)}</div>}
      {message && <div className="alert alert-success">{t(message)}</div>}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label" htmlFor="forgot-email">{t('Email Address')}</label>
          <input
            id="forgot-email"
            type="email"
            className="form-control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </div>
        <button className="btn btn-success w-100" disabled={busy} type="submit">
          {busy ? t('Sending...') : t('Send Reset Link')}
        </button>
      </form>

      <p className="text-center mt-3 mb-0">
        <Link to="/login" replace>{t('Back to Login')}</Link>
      </p>
    </div>
  );
}
