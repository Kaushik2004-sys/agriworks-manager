// Auth update: Reset Password page.
// Reads uid/token from the reset link (?uid=&token=), sets the new password
// through the Django backend (never frontend-only).
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { confirmPasswordReset } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import { PASSWORD_HINT, passwordError } from '../utils/validatePassword';

export default function ResetPassword() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [uid] = useState(params.get('uid') || '');
  const [token] = useState(params.get('token') || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!uid || !token) {
      setError('Reset link is invalid or expired.');
      return;
    }
    if (!newPassword) {
      setError('New password is required.');
      return;
    }
    const pwErr = passwordError(newPassword);
    if (pwErr) {
      setError(pwErr);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const data = await confirmPasswordReset({
        uid, token, new_password: newPassword, confirm_password: confirmPassword,
      });
      alert(data.message || 'Password has been reset. Please log in.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed. The link may be expired.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container py-4" style={{ maxWidth: 420 }}>
      <h2 className="fw-bold mb-1">{t('Reset Password')}</h2>
      <p className="text-muted">{t('Set a new password for your account.')}</p>

      {error && <div className="alert alert-danger">{t(error)}</div>}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">{t('New Password')}</label>
          <input
            type="password"
            className="form-control"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <div className="form-text">{t(PASSWORD_HINT)}</div>
        </div>
        <div className="mb-3">
          <label className="form-label">{t('Confirm New Password')}</label>
          <input
            type="password"
            className="form-control"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <button className="btn btn-success w-100" disabled={busy} type="submit">
          {busy ? t('Resetting...') : t('Reset Password')}
        </button>
      </form>

      <p className="text-center mt-3 mb-0">
        <Link to="/login" replace>{t('Back to Login')}</Link>
      </p>
    </div>
  );
}
