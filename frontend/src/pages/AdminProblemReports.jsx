// Admin Problem Reports page (superuser only via AdminRoute).
// Lists all submitted reports, changeable status, delete, status filter.
import { useEffect, useState } from 'react';
import BackButton from '../components/BackButton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { useLanguage } from '../i18n/LanguageContext';
import { REPORT_STATUSES, deleteProblemReport, listProblemReports, screenshotUrl, updateProblemReportStatus } from '../services/support';

export default function AdminProblemReports() {
  const { t } = useLanguage();
  const [reports, setReports] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  async function handleDelete(id) {
    if (!window.confirm(t('Delete this report?'))) return;
    try {
      await deleteProblemReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError('Delete failed. Please try again.');
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
          <table className="table table-striped table-bordered">
            <thead className="table-success">
              <tr>
                <th>{t('Name')}</th>
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
                  <td>{r.username || r.name}</td>
                  <td className="text-break">{r.email}</td>
                  <td>{t(r.problem_type)}</td>
                  <td style={{ minWidth: 180 }}>{r.description}</td>
                  <td className="text-nowrap">{String(r.created_at || '').slice(0, 10)}</td>
                  <td>
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
                  <td className="text-nowrap">
                    {r.screenshot && (
                      <a
                        className="btn btn-sm btn-outline-primary me-2"
                        href={screenshotUrl(r.screenshot)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t('View')}
                      </a>
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
    </div>
  );
}
