// Admin Dashboard (superuser only via AdminRoute).
// System/user overview from the admin overview API — no operational
// CRUD here (no Add Farmer/Work/Payment/Expense/Bill actions).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ErrorState from '../components/ErrorState';
import StatIcon from '../components/StatIcon';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { getAdminOverview, getLoginHistory } from '../services/dashboard';

function AdminStatCard({ icon, label, value }) {
  return (
    <div className="col-6 col-md-4 col-lg-3">
      <div className="card h-100">
        <div className="card-body py-3">
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="text-success d-inline-flex">{icon}</span>
            <small className="text-muted">{label}</small>
          </div>
          <div className="fw-bold fs-5">{value}</div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [logins, setLogins] = useState([]);
  const [userQuery, setUserQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [overview, history] = await Promise.all([getAdminOverview(), getLoginHistory()]);
      setData(overview);
      setLogins(Array.isArray(history) ? history.slice(0, 5) : (history.results || []).slice(0, 5));
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className="container py-4 text-muted">{t('Loading dashboard...')}</div>;
  if (error) {
    return (
      <div className="container py-4">
        <h2 className="fw-bold">{t('Admin Dashboard')}</h2>
        <div className="mt-3"><ErrorState message={error} onRetry={load} /></div>
      </div>
    );
  }

  const totals = data?.totals || {};
  const reportCounts = data?.problem_reports || {};
  const users = data?.users || [];
  const recentReports = data?.recent_reports || [];
  const system = data?.system || {};

  // Client-side filter over registered users (name, username, email,
  // mobile). Case-insensitive; empty shows all.
  const uq = userQuery.trim().toLowerCase();
  const visibleUsers = !uq ? users : users.filter((u) => (
    [u.full_name, u.username, u.email, u.mobile]
      .map((v) => String(v || '').toLowerCase())
      .some((v) => v.includes(uq))
  ));

  return (
    <div className="container py-4">
      <h2 className="fw-bold">{t('Admin Dashboard')}</h2>
      <p className="text-muted">{t('Welcome,')} {user?.profile?.full_name || ''}</p>

      <div className="row g-2 mb-3">
        <AdminStatCard icon={<StatIcon name="farmers" />} label={t('Total Users')} value={totals.users ?? '—'} />
        <AdminStatCard icon={<StatIcon name="pending" />} label={t('Total Problem Reports')} value={totals.problem_reports ?? '—'} />
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">{t('Problem Reports')}</h5>
          <div className="row g-2 small mb-2">
            <div className="col-6 col-md-3">{t('Pending')}: <b>{reportCounts.pending ?? '—'}</b></div>
            <div className="col-6 col-md-3">{t('In Progress')}: <b>{reportCounts.in_progress ?? '—'}</b></div>
            <div className="col-6 col-md-3">{t('Resolved')}: <b>{reportCounts.resolved ?? '—'}</b></div>
            <div className="col-6 col-md-3">{t('Total')}: <b>{totals.problem_reports ?? '—'}</b></div>
          </div>
          <Link to="/admin/problem-reports" className="btn btn-success btn-sm">{t('View Problem Reports')}</Link>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">{t('Recent Login Activity')}</h5>
          {logins.length === 0 ? (
            <p className="text-muted small mb-2">{t('No login records found.')}</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-striped mb-2 aw-cards-table">
                <thead>
                  <tr>
                    <th>{t('User')}</th>
                    <th>{t('Login Date')}</th>
                    <th>{t('Login Time')}</th>
                    <th>{t('Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {logins.map((h) => (
                    <tr key={h.id}>
                      <td data-label={t('User')}>{h.username}</td>
                      <td data-label={t('Login Date')} className="text-nowrap">{h.login_date}</td>
                      <td data-label={t('Login Time')} className="text-nowrap">{h.login_time}</td>
                      <td data-label={t('Status')}><span className="badge bg-secondary">{t(h.status)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Link to="/admin/login-history" className="btn btn-success btn-sm">{t('View All Login History')}</Link>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">{t('Recent Problem Reports')}</h5>
              {recentReports.length === 0 ? (
                <p className="text-muted small mb-0">{t('No problem reports found.')}</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm table-striped mb-0 aw-cards-table">
                    <thead>
                      <tr>
                        <th>{t('User')}</th>
                        <th>{t('Problem Type')}</th>
                        <th>{t('Date')}</th>
                        <th>{t('Status')}</th>
                        <th>{t('Action')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentReports.map((r) => (
                        <tr key={r.id}>
                          <td data-label={t('User')}>{r.username}</td>
                          <td data-label={t('Problem Type')}>{t(r.problem_type)}</td>
                          <td data-label={t('Date')} className="text-nowrap">{r.created_at}</td>
                          <td data-label={t('Status')}><span className="badge bg-secondary">{t(r.status)}</span></td>
                          <td data-label={t('Action')}>
                            <Link to="/admin/problem-reports" className="btn btn-sm btn-outline-success">{t('View')}</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="card mb-3">
            <div className="card-body">
              <h5 className="card-title">{t('User Overview')}</h5>
              <div className="mb-2" role="search">
                <label className="visually-hidden" htmlFor="admin-user-search">{t('Search users...')}</label>
                <input
                  id="admin-user-search"
                  className="form-control form-control-sm"
                  type="search"
                  placeholder={t('Search users...')}
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                />
              </div>
              {users.length === 0 ? (
                <p className="text-muted small mb-0">{t('No users found.')}</p>
              ) : visibleUsers.length === 0 ? (
                <p className="text-muted small mb-0">{t('No matching users found.')}</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm table-striped mb-0 aw-cards-table">
                    <thead>
                      <tr>
                        <th>{t('Name')}</th>
                        <th>{t('Username')}</th>
                        <th>{t('Email')}</th>
                        <th>{t('Mobile')}</th>
                        <th>{t('Role')}</th>
                        <th>{t('Status')}</th>
                        <th>{t('Joined')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleUsers.map((u) => (
                        <tr key={u.username}>
                          <td data-label={t('Name')}>{u.full_name || '—'}</td>
                          <td data-label={t('Username')}>{u.username}</td>
                          <td data-label={t('Email')} className="aw-user-email">{u.email || '—'}</td>
                          <td data-label={t('Mobile')} className="text-nowrap">{u.mobile || '—'}</td>
                          <td data-label={t('Role')}>{u.is_superuser
                            ? <span className="badge bg-primary">{t('Admin')}</span>
                            : <span className="badge bg-secondary">{t('User')}</span>}</td>
                          <td data-label={t('Status')}>{u.is_active
                            ? <span className="badge bg-success">{t('Active')}</span>
                            : <span className="badge bg-secondary">{t('Inactive')}</span>}</td>
                          <td data-label={t('Joined')} className="text-nowrap">{u.date_joined || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">{t('System Overview')}</h5>
              <p className="small mb-0">
                {t('API status')}: <b>{system.api || '—'}</b>
                <span className="text-muted"> | </span>
                {t('Database status')}: <b>{system.database || '—'}</b>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
