// Reusable empty-list state for tables with zero records.
// Simple Bootstrap info alert; no fake data, layout-preserving,
// responsive and Light/Dark compatible via Bootstrap classes.
import { useLanguage } from '../i18n/LanguageContext';

export default function EmptyState({ message, title, icon, actionLabel, onAction }) {
  const { t } = useLanguage();
  // Friendly first-run card; plain alert preserved when only a message is given.
  if (!title && !actionLabel) {
    return <div className="alert alert-info">{t(message)}</div>;
  }
  return (
    <div className="aw-empty">
      <div className="aw-empty-icon" aria-hidden="true">{icon || '🌱'}</div>
      <p className="aw-empty-title">{t(title || message)}</p>
      {message && title && <p className="aw-empty-text">{t(message)}</p>}
      {actionLabel && (
        <button type="button" className="btn btn-success" onClick={onAction}>
          {t(actionLabel)}
        </button>
      )}
    </div>
  );
}
