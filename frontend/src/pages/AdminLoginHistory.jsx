// Admin Login History page (superuser only via AdminRoute).
// Every successful login is a separate row, newest first.
import { useEffect, useState } from 'react';
import BackButton from '../components/BackButton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { useLanguage } from '../i18n/LanguageContext';
import { getLoginHistory } from '../services/dashboard';

export default function AdminLoginHistory() {
  const { t } = useLanguage();
  const [records, setRecords] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await getLoginHistory();
      setRecords(Array.isArray(data) ? data : data.results || []);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Client-side filter over the loaded records (username, email, role,
  // dates, status, IP, browser). Case-insensitive; empty shows all.
  const q = query.trim().toLowerCase();
  const visible = !q ? records : records.filter((r) => (
    [r.username, r.email, r.is_superuser ? 'admin' : 'user',
     r.login_date, r.login_time, r.status, r.ip_address, r.user_agent]
      .map((v) => String(v || '').toLowerCase())
      .some((v) => v.includes(q))
  ));

  return (
    <div className="container py-4">
      <BackButton to="/admin/dashboard" label="Back to Dashboard" />
      <h2 className="fw-bold">{t('Login History')}</h2>

      {error && <ErrorState message={error} onRetry={load} />}

      <div className="mb-3" role="search">
        <label className="visually-hidden" htmlFor="login-history-search">{t('Search login activity...')}</label>
        <input
          id="login-history-search"
          className="form-control"
          type="search"
          placeholder={t('Search login activity...')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-muted">{t('Loading login history...')}</p>
      ) : records.length === 0 ? (
        <EmptyState message="No login records found." />
      ) : visible.length === 0 ? (
        <EmptyState message="No matching login records found." />
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-bordered aw-cards-table">
            <thead className="table-success">
              <tr>
                <th>{t('User')}</th>
                <th>{t('Role')}</th>
                <th>{t('Email')}</th>
                <th>{t('Login Date')}</th>
                <th>{t('Login Time')}</th>
                <th>{t('Status')}</th>
                <th>{t('IP Address')}</th>
                <th>{t('User Agent')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td data-label={t('User')}>{r.username}</td>
                  <td data-label={t('Role')}>{r.is_superuser
                    ? <span className="badge bg-primary">{t('Admin')}</span>
                    : <span className="badge bg-secondary">{t('User')}</span>}</td>
                  <td data-label={t('Email')} className="text-break">{r.email}</td>
                  <td data-label={t('Login Date')} className="text-nowrap">{r.login_date}</td>
                  <td data-label={t('Login Time')} className="text-nowrap">{r.login_time}</td>
                  <td data-label={t('Status')}><span className="badge bg-secondary">{t(r.status)}</span></td>
                  <td data-label={t('IP Address')} className="text-nowrap">{r.ip_address || '—'}</td>
                  <td data-label={t('User Agent')} className="text-break">{r.user_agent || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
