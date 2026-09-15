// Phase 2: Blocks unauthorized access to protected pages.
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export default function ProtectedRoute({ children }) {
  const { user, token, loading, authError, revalidate } = useAuth();
  const { t } = useLanguage();

  if (loading) {
    return <div className="container py-4 text-muted">{t('Checking login...')}</div>;
  }
  // Backend unreachable but a token is stored: the session may still be
  // valid, so offer a retry instead of dropping to the login page.
  if (token && !user && authError === 'network') {
    return (
      <div className="container py-4">
        <div className="alert alert-warning">{t('Could not verify your session. Please check your connection and retry.')}</div>
        <button className="btn btn-success" type="button" onClick={() => revalidate()}>
          {t('Retry')}
        </button>
      </div>
    );
  }
  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }
  // Admin accounts never render the normal User Panel: after a role switch
  // (Back/forward to a stale user entry, or a direct user URL) the admin
  // session lands here and is bounced to the Admin Panel instead.
  if (user.is_superuser) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return children;
}
