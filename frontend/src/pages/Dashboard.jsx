// Phase 8: Business Dashboard with real DB/API data.
// Totals + recent work/payments/expenses. No duplicate records.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatIcon from '../components/StatIcon';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { getDashboard } from '../services/dashboard';

// Simple rural-friendly card: ICON + TITLE + VALUE + SHORT DESCRIPTION.
function StatCard({ emoji, label, value, desc, link, linkText }) {
  const { t } = useLanguage();
  return (
    <div className="col-6 col-md-4 col-lg-3">
      <div className="card h-100 position-relative stat-card aw-stat-card">
        <div className="card-body py-3">
          <div className="aw-stat-icon" aria-hidden="true">{emoji}</div>
          <div className="aw-stat-title">{label}</div>
          <div className="aw-stat-value">{value}</div>
          {desc && <div className="aw-stat-desc">{desc}</div>}
          {link && <Link className="small stretched-link" to={link}>{linkText || t('View')}</Link>}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // P11: extracted so a failed load offers the same Retry affordance
  // as every other data page instead of a dead-end message.
  function load() {
    setLoading(true);
    setError('');
    getDashboard()
      .then(setData)
      .catch(() => setError('Cannot load dashboard. Start backend with: python manage.py runserver'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="container py-4 text-muted">{t('Loading dashboard...')}</div>;

  if (error) {
    return (
      <div className="container py-4">
        <h2 className="fw-bold">{t('Welcome,')} {user?.profile?.full_name || ''}</h2>
        <div className="alert alert-danger mt-3">{t(error)}</div>
        <button className="btn btn-success" type="button" onClick={load}>
          {t('Retry')}
        </button>
      </div>
    );
  }

  // Defensive defaults: a malformed response shows dashes, never a white screen.
  const totals = data?.totals || {};
  const recentWorks = data?.recent_works || [];
  const recentPayments = data?.recent_payments || [];
  const recentExpenses = data?.recent_expenses || [];
  const company = data?.business?.company_name || user?.profile?.company_name || '';

  return (
    <div className="container py-4">
      <h2 className="fw-bold">{t('Welcome,')} {user?.profile?.full_name || ''}</h2>
      {company && <p className="mb-0 fw-semibold">{company}</p>}

      {/* One-tap everyday tasks: same routes, big touch targets */}
      <div className="aw-quick-actions" aria-label={t('Quick actions')}>
        <Link className="btn btn-success" to="/farmers">{t('+ Add Farmer')}</Link>
        <Link className="btn btn-success" to="/works">{t('+ Add Work')}</Link>
        <Link className="btn btn-outline-success" to="/payments">{t('Record Payment')}</Link>
        <Link className="btn btn-outline-success" to="/expenses">{t('+ Add Expense')}</Link>
      </div>

      <div className="row g-2 mb-3">
        <StatCard emoji="🚜" label={t('Work Records')} value={totals.works ?? '—'} desc={t('Total jobs done')} link="/dashboard/work-records" linkText={t('Work')} />
        <StatCard emoji="💰" label={t('Total Income (billed)')} value={totals.income == null ? '—' : `₹${totals.income}`} desc={t('Billed so far')} link="/dashboard/income" linkText={t('Bills')} />
        <StatCard emoji="✅" label={t('Payments Received')} value={totals.received == null ? '—' : `₹${totals.received}`} desc={t('Money collected')} link="/dashboard/payments" linkText={t('Payments')} />
        <StatCard emoji="⏳" label={t('Pending Payments')} value={totals.pending == null ? '—' : `₹${totals.pending}`} desc={t('Still to collect')} link="/dashboard/pending-payments" linkText={t('Pending bills')} />
        <StatCard emoji="💸" label={t('Total Expenses')} value={totals.expenses == null ? '—' : `₹${totals.expenses}`} desc={t('Money spent')} link="/dashboard/expenses" linkText={t('Expenses')} />
        <StatCard emoji="👨‍🌾" label={t('Farmers')} value={totals.farmers ?? '—'} desc={t('Farmers in register')} link="/dashboard/farmers" linkText={t('Farmers')} />
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title d-flex align-items-center gap-2">
                <span className="text-success d-inline-flex"><StatIcon name="work" size={18} /></span>{t('Recent Work')}
              </h5>
              {recentWorks.length === 0 ? (
                <p className="text-muted small mb-0">{t('No work records.')}</p>
              ) : (
                <ul className="list-group list-group-flush">
                  {recentWorks.map((w) => (
                    <li key={w.id} className="list-group-item px-0 small">
                      <span className="text-success me-1 d-inline-flex align-middle"><StatIcon name="work" size={14} /></span>
                      <b>{w.farmer_name}</b> – {t(w.work_type)} ({w.work_date})<br />
                      <span className="text-muted">Rs {w.amount}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title d-flex align-items-center gap-2">
                <span className="text-success d-inline-flex"><StatIcon name="payment" size={18} /></span>{t('Recent Payments')}
              </h5>
              {recentPayments.length === 0 ? (
                <p className="text-muted small mb-0">{t('No payments received.')}</p>
              ) : (
                <ul className="list-group list-group-flush">
                  {recentPayments.map((p) => (
                    <li key={p.id} className="list-group-item px-0 small">
                      <span className="text-success me-1 d-inline-flex align-middle"><StatIcon name="payment" size={14} /></span>
                      <b>{p.farmer_name}</b> – Bill #{p.bill_id} ({p.payment_date})<br />
                      <span className="text-muted">{t(p.method)} Rs {p.amount}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title d-flex align-items-center gap-2">
                <span className="text-success d-inline-flex"><StatIcon name="expense" size={18} /></span>{t('Recent Expenses')}
              </h5>
              {recentExpenses.length === 0 ? (
                <p className="text-muted small mb-0">{t('No expenses.')}</p>
              ) : (
                <ul className="list-group list-group-flush">
                  {recentExpenses.map((e) => (
                    <li key={e.id} className="list-group-item px-0 small">
                      <span className="text-success me-1 d-inline-flex align-middle"><StatIcon name="expense" size={14} /></span>
                      <b>{t(e.expense_type)}</b> ({e.date})<br />
                      <span className="text-muted">Rs {e.amount}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
