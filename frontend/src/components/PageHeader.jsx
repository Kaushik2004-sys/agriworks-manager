// UI-only page header: clear title, short helper text, and one primary action.
// No logic changes; purely presentational for the rural-friendly redesign.
import { useLanguage } from '../i18n/LanguageContext';

export default function PageHeader({ title, subtitle, actionLabel, actionIcon, onAction, actionTo }) {
  const { t } = useLanguage();
  return (
    <div className="aw-page-head">
      <div>
        <h2>{t(title)}</h2>
        {subtitle && <p className="aw-page-sub">{t(subtitle)}</p>}
      </div>
      {actionLabel && (
        <button
          type="button"
          className="btn btn-success aw-primary-action"
          onClick={onAction}
          data-aw-action={actionTo || undefined}
        >
          {actionIcon && (
            <span aria-hidden="true">{actionIcon}</span>
          )}
          {t(actionLabel)}
        </button>
      )}
    </div>
  );
}
