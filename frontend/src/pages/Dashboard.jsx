// Phase 8: Business Dashboard with real DB/API data.
// Totals + recent work/payments/expenses. No duplicate records.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { getDashboard } from '../services/dashboard';

function StatCard({ label, value, link, linkText }) {
  const { t } = useLanguage();
  return (
    <div className="col-6 col-md-4 col-lg-3">
      <div className="card h-100">
        <div className="card-body py-3">
          <small className="text-muted">{label}</small>
          <div className="fw-bold fs-5">{value}</div>
          {link && <Link className="small" to={link}>{linkText || t('View')}</Link>}
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
        <h2 className="fw-bold">{t('Welcome,')} {user?.username}</h2>
        <div className="alert alert-danger mt-3">{t(error)}</div>
      </div>
    );
  }

  // Defensive defaults: a malformed response shows dashes, never a white screen.
  const totals = data?.totals || {};
  const recentWorks = data?.recent_works || [];
  const recentPayments = data?.recent_payments || [];
  const recentExpenses = data?.recent_expenses || [];
  const company = data?.business?.company_name || user?.company_name || '';

  return (
    <div className="container py-4">
      <h2 className="fw-bold">{t('Welcome,')} {user?.username}</h2>
      {company && <p className="mb-0 fw-semibold">{company}</p>}
      <p className="text-muted">{t('Phase 8 – Business summary from actual records.')}</p>

      <div className="row g-2 mb-3">
        <StatCard label={t('Work Records')} value={totals.works} link="/works" linkText={t('Work')} />
        <StatCard label={t('Total Income (billed)')} value={`Rs ${totals.income}`} link="/bills" linkText={t('Bills')} />
        <StatCard label={t('Payments Received')} value={`Rs ${totals.received}`} link="/payments" linkText={t('Payments')} />
        <StatCard label={t('Pending Payments')} value={`Rs ${totals.pending}`} link="/bills" linkText={t('Pending bills')} />
        <StatCard label={t('Total Expenses')} value={`Rs ${totals.expenses}`} link="/expenses" linkText={t('Expenses')} />
        <StatCard label={t('Farmers')} value={totals.farmers} link="/farmers" linkText={t('Farmers')} />
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">{t('Recent Work')}</h5>
              {recentWorks.length === 0 ? (
                <p className="text-muted small mb-0">{t('No work records.')}</p>
              ) : (
                <ul className="list-group list-group-flush">
                  {recentWorks.map((w) => (
                    <li key={w.id} className="list-group-item px-0 small">
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
              <h5 className="card-title">{t('Recent Payments')}</h5>
              {recentPayments.length === 0 ? (
                <p className="text-muted small mb-0">{t('No payments received.')}</p>
              ) : (
                <ul className="list-group list-group-flush">
                  {recentPayments.map((p) => (
                    <li key={p.id} className="list-group-item px-0 small">
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
              <h5 className="card-title">{t('Recent Expenses')}</h5>
              {recentExpenses.length === 0 ? (
                <p className="text-muted small mb-0">{t('No expenses.')}</p>
              ) : (
                <ul className="list-group list-group-flush">
                  {recentExpenses.map((e) => (
                    <li key={e.id} className="list-group-item px-0 small">
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
