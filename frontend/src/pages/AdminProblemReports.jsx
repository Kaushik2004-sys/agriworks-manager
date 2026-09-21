// Admin Problem Reports page (superuser only via AdminRoute).
// Lists all submitted reports, changeable status, delete, status filter.
import { useEffect, useState } from 'react';
import BackButton from '../components/BackButton';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { useLanguage } from '../i18n/LanguageContext';
import { REPORT_STATUSES, deleteProblemReport, fetchScreenshotUrl, listProblemReports, updateProblemReportStatus } from '../services/support';

export default function AdminProblemReports() {
  const { t } = useLanguage();
  const [reports, setReports] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await listProblemReports();
      setReports(Array.isArray(data) ? data : data.results || []);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleStatus(id, status) {
    try {
      const updated = await updateProblemReportStatus(id, status);
      setReports((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch {
      setError('Save failed. Please try again.');
    }
  }

  // Same delete logic as before; only the confirmation UI follows the
  // application pattern (accessible ConfirmDialog instead of
  // window.confirm; backend call unchanged).
  async function handleDelete(id) {
    setPendingDeleteId(id);
  }

  async function confirmDelete() {
    if (pendingDeleteId == null) return;
    setDeleting(true);
    try {
      await deleteProblemReport(pendingDeleteId);
      setReports((prev) => prev.filter((r) => r.id !== pendingDeleteId));
      setPendingDeleteId(null);
    } catch {
      setError('Delete failed. Please try again.');
      setPendingDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }

  const visible = filterStatus ? reports.filter((r) => r.status === filterStatus) : reports;

  return (
    <div className="container py-4">
      <BackButton to="/" label="Back to Home" />
      <h2 className="fw-bold">{t('Problem Reports')}</h2>

      <div className="row g-2 mb-3">
        <div className="col-12 col-md-4">
          <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">{t('All statuses')}</option>
            {REPORT_STATUSES.map((s) => (
              <option key={s} value={s}>{t(s)}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {loading ? (
        <p className="text-muted">{t('Loading reports...')}</p>
      ) : visible.length === 0 ? (
        <EmptyState message="No problem reports found." />
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-bordered aw-cards-table">
            <thead className="table-success">
              <tr>
                <th>{t('Username')}</th>
                <th>{t('Email')}</th>
                <th>{t('Problem Type')}</th>
                <th>{t('Description')}</th>
                <th>{t('Date')}</th>
                <th>{t('Status')}</th>
                <th>{t('Action')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td data-label={t('Username')}>{r.username || r.name}</td>
                  <td data-label={t('Email')} className="text-break">{r.email}</td>
                  <td data-label={t('Problem Type')}>{t(r.problem_type)}</td>
                  <td data-label={t('Description')}>{r.description}</td>
                  <td data-label={t('Date')} className="text-nowrap">{String(r.created_at || '').slice(0, 10)}</td>
                  <td data-label={t('Status')}>
                    <select
                      className="form-select form-select-sm"
                      value={r.status}
                      onChange={(e) => handleStatus(r.id, e.target.value)}
                      aria-label={t('Status')}
                    >
                      {REPORT_STATUSES.map((s) => (
                        <option key={s} value={s}>{t(s)}</option>
                      ))}
                    </select>
                  </td>
                  <td data-label={t('Action')} className="text-nowrap">
                    {r.screenshot && (
                      <button
                        className="btn btn-sm btn-outline-primary me-2"
                        type="button"
                        onClick={async () => {
                          try {
                            window.open(await fetchScreenshotUrl(r.screenshot), '_blank', 'noreferrer');
                          } catch {
                            setError('Something went wrong. Please try again.');
                          }
                        }}
                      >
                        {t('View')}
                      </button>
                    )}
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDelete(r.id)}
                    >
                      {t('Delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pendingDeleteId != null && (
        <ConfirmDialog
          title="Delete this report?"
          message="This will remove this report from your records."
          confirmLabel="Delete"
          busy={deleting}
          onCancel={() => { if (!deleting) setPendingDeleteId(null); }}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
