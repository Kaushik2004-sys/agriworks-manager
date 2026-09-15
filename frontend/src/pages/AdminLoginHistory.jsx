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

  return (
    <div className="container py-4">
      <BackButton to="/admin/dashboard" label="Back to Dashboard" />
      <h2 className="fw-bold">{t('Login History')}</h2>

      {error && <ErrorState message={error} onRetry={load} />}

      {loading ? (
        <p className="text-muted">{t('Loading login history...')}</p>
      ) : records.length === 0 ? (
        <EmptyState message="No login records found." />
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-bordered">
            <thead className="table-success">
              <tr>
                <th>{t('User')}</th>
                <th>{t('Role')}</th>
                <th>{t('Email')}</th>
                <th>{t('Login Date')}</th>
                <th>{t('Login Time')}</th>
                <th>{t('Status')}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.username}</td>
                  <td>{r.is_superuser
                    ? <span className="badge bg-primary">{t('Admin')}</span>
                    : <span className="badge bg-secondary">{t('User')}</span>}</td>
                  <td className="text-break">{r.email}</td>
                  <td className="text-nowrap">{r.login_date}</td>
                  <td className="text-nowrap">{r.login_time}</td>
                  <td><span className="badge bg-secondary">{t(r.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
