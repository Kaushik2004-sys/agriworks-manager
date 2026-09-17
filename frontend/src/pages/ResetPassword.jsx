// Auth update: Reset Password page (email reset link flow).
// Reads uid/token from the reset link (?uid=&token=), sets the new password
// through the Django backend (never frontend-only).
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { confirmPasswordReset } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import { PASSWORD_HINT, passwordError } from '../utils/validatePassword';

export default function ResetPassword() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // Read uid/token from the live URL on every render (useSearchParams
  // is reactive), never frozen in useState - if the URL changes from reset
  // link A to reset link B while mounted, submission uses B's values.
  const uid = params.get('uid') || '';
  const token = params.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setOk('');
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
      // Inline success (no native alert); then continue to Login as before.
      if (mounted.current) {
        setOk(data.message || 'Password has been reset. Please log in.');
        setTimeout(() => {
          if (mounted.current) navigate('/login', { replace: true });
        }, 1500);
      }
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
      {ok && <div className="alert alert-success">{t(ok)}</div>}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label" htmlFor="reset-new-password">{t('New Password')}</label>
          <input
            id="reset-new-password"
            type="password"
            className="form-control"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <div className="form-text">{t(PASSWORD_HINT)}</div>
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="reset-confirm-password">{t('Confirm New Password')}</label>
          <input
            id="reset-confirm-password"
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
