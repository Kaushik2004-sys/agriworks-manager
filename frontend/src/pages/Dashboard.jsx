// Phase 8: Business Dashboard with real DB/API data.
// Totals + recent work/payments/expenses. No duplicate records.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatIcon from '../components/StatIcon';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { getDashboard } from '../services/dashboard';

function StatCard({ icon, label, value, link, linkText }) {
  const { t } = useLanguage();
  return (
    <div className="col-6 col-md-4 col-lg-3">
      <div className="card h-100 position-relative stat-card">
        <div className="card-body py-3">
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="text-success d-inline-flex">{icon}</span>
            <small className="text-muted">{label}</small>
          </div>
          <div className="fw-bold fs-5">{value}</div>
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

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(() => setError('Cannot load dashboard. Start backend with: python manage.py runserver'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="container py-4 text-muted">{t('Loading dashboard...')}</div>;

  if (error) {
    return (
      <div className="container py-4">
        <h2 className="fw-bold">{t('Welcome,')} {user?.profile?.full_name || ''}</h2>
        <div className="alert alert-danger mt-3">{t(error)}</div>
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

      <div className="row g-2 mb-3">
        <StatCard icon={<StatIcon name="work" />} label={t('Work Records')} value={totals.works ?? '—'} link="/dashboard/work-records" linkText={t('Work')} />
        <StatCard icon={<StatIcon name="income" />} label={t('Total Income (billed)')} value={`Rs ${totals.income ?? '—'}`} link="/dashboard/income" linkText={t('Bills')} />
        <StatCard icon={<StatIcon name="payment" />} label={t('Payments Received')} value={`Rs ${totals.received ?? '—'}`} link="/dashboard/payments" linkText={t('Payments')} />
        <StatCard icon={<StatIcon name="pending" />} label={t('Pending Payments')} value={`Rs ${totals.pending ?? '—'}`} link="/dashboard/pending-payments" linkText={t('Pending bills')} />
        <StatCard icon={<StatIcon name="expense" />} label={t('Total Expenses')} value={`Rs ${totals.expenses ?? '—'}`} link="/dashboard/expenses" linkText={t('Expenses')} />
        <StatCard icon={<StatIcon name="farmers" />} label={t('Farmers')} value={totals.farmers ?? '—'} link="/dashboard/farmers" linkText={t('Farmers')} />
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
