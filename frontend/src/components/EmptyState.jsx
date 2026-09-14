// Reusable empty-list state for tables with zero records.
// Simple Bootstrap info alert; no fake data, layout-preserving,
// responsive and Light/Dark compatible via Bootstrap classes.
import { useLanguage } from '../i18n/LanguageContext';

export default function EmptyState({ message }) {
  const { t } = useLanguage();
  return <div className="alert alert-info">{t(message)}</div>;
}
