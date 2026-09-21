// Frontend-only 404 page for invalid React Router URLs.
// Catch-all route (see App.jsx): public so guests and authenticated
// users alike see it. Uses existing BackButton + Bootstrap
// styling, i18n t(), Light/Dark and responsive container layout.
import { Link } from 'react-router-dom';
import BackButton from './BackButton';
import { useLanguage } from '../i18n/LanguageContext';

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="container py-5">
      <BackButton to="/" label="Back to Home" />
      <div className="text-center">
        <h2 className="fw-bold">{t('Page Not Found')}</h2>
        <p className="text-muted">{t('The page you are looking for does not exist.')}</p>
        <Link to="/" className="btn btn-success">
          {t('Go to Home')}
        </Link>
      </div>
    </div>
  );
}
