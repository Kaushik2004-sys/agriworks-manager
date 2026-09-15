// Admin-only route guard (AgriWorks admin = Django is_superuser).
// A user with is_staff=true but is_superuser=false is a NORMAL user here.
// Unauthenticated users go to Login; normal users go Home.
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export default function AdminRoute({ children }) {
  const { user, token, loading, authError, revalidate } = useAuth();
  const { t } = useLanguage();

  if (loading) {
    return <div className="container py-4 text-muted">{t('Checking login...')}</div>;
  }
  // Same as ProtectedRoute: unreachable backend keeps the stored token,
  // so offer a retry instead of dropping to the login page.
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
  if (!user.is_superuser) {
    return <Navigate to="/" replace />;
  }
  return children;
}
