// UI-only accessible confirmation dialog (replaces window.confirm visually).
// Same contract as confirm(): onConfirm runs the existing delete handler,
// onCancel closes. Focus goes to Cancel first; Escape closes.
import { useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';

export default function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel, busy }) {
  const { t } = useLanguage();
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') onCancel?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="aw-dialog-backdrop" onClick={onCancel}>
      <div
        className="aw-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="aw-confirm-title"
        aria-describedby="aw-confirm-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="aw-confirm-title">{t(title)}</h3>
        <p id="aw-confirm-desc" className="text-muted">{t(message)}</p>
        <div className="d-flex gap-2 justify-content-end flex-wrap">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {t('Cancel')}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? t('Deleting...') : t(confirmLabel || 'Delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
