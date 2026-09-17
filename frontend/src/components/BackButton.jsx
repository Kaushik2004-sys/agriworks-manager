// Reusable Back/Next navigation buttons for authenticated pages.
// Both navigate directly to fixed routes via React Router Link (never history back),
// so they work after refresh or deep-linking. Bootstrap styling, responsive.
// Props: `to` (Back target, optional), `nextTo` (Next target, optional),
// `label` (Back button text, defaults to 'Back').
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';

export default function BackButton({ to, nextTo, label }) {
  const { t } = useLanguage();
  if (!to && !nextTo) return null;
  return (
    <div className="d-flex gap-2 mb-2 flex-wrap">
      {to && (
        <Link to={to} className="btn btn-outline-success btn-sm" aria-label={t(label || 'Back')}>
          <span aria-hidden="true">&larr;</span> {t(label || 'Back')}
        </Link>
      )}
      {nextTo && (
        <Link to={nextTo} className="btn btn-success btn-sm">
          {t('Next')} <span aria-hidden="true">&rarr;</span>
        </Link>
      )}
    </div>
  );
}
