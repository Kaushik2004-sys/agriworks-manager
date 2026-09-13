// Phase 2: Blocks unauthorized access to protected pages.
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export default function ProtectedRoute({ children }) {
  const { user, token, loading } = useAuth();
  const { t } = useLanguage();

  if (loading) {
    return <div className="container py-4 text-muted">{t('Checking login...')}</div>;
  }
  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
