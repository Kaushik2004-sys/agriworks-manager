// Reusable friendly API error state with Retry.
// Shows a user-friendly message (never raw Axios/backend details).
// Retry simply repeats the existing request via onRetry.
// Bootstrap alert styling; works in Light/Dark and responsive layouts.
import { useLanguage } from '../i18n/LanguageContext';

export default function ErrorState({ message, onRetry }) {
  const { t } = useLanguage();
  return (
    <div className="alert alert-danger d-flex flex-wrap align-items-center gap-2" role="alert">
      <span className="flex-grow-1">{t(message || 'Something went wrong. Please try again.')}</span>
      {onRetry && (
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={onRetry}>
          {t('Retry')}
        </button>
      )}
    </div>
  );
}
