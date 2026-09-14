// Admin-only route guard (AgriWorks admin = Django is_superuser).
// A user with is_staff=true but is_superuser=false is a NORMAL user here.
// Unauthenticated users go to Login; normal users go Home.
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export default function AdminRoute({ children }) {
  const { user, token, loading } = useAuth();
  const { t } = useLanguage();

  if (loading) {
    return <div className="container py-4 text-muted">{t('Checking login...')}</div>;
  }
  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }
  if (!user.is_superuser) {
    return <Navigate to="/" replace />;
  }
  return children;
}
