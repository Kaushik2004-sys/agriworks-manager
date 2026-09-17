// Focused Expenses details (read-only). Opened from the Dashboard card.
// Shows expense info from existing expense data. Full expenses stay in /expenses.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import StatIcon from '../components/StatIcon';
import { useLanguage } from '../i18n/LanguageContext';
import { EXPENSE_TYPES, listExpenses } from '../services/expenses';

export default function DashboardExpenses() {
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listExpenses()
      .then((data) => setExpenses(Array.isArray(data) ? data : data.results || []))
      .catch(() => setError('Cannot load expenses. Check backend is running.'))
      .finally(() => setLoading(false));
  }, []);

  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  if (loading) return <div className="container py-4 text-muted">{t('Loading expense details...')}</div>;

  return (
    <div className="container py-4">
      <BackButton to="/" label="Back to Dashboard" />
      <h2 className="fw-bold d-flex align-items-center gap-2">
        <span className="text-success d-inline-flex"><StatIcon name="expense" /></span>{t('Expenses Details')}
      </h2>
      <p className="text-muted">{t('Focused summary of your business expenses.')}</p>
      {error && <div className="alert alert-danger">{t(error)}</div>}

      <div className="row g-2 mb-3">
        <div className="col-6 col-md-4">
          <div className="card"><div className="card-body py-2">
            <small className="text-muted">{t('Total Expenses')}</small>
            <div className="fw-bold fs-5">Rs {total}</div>
          </div></div>
        </div>
        <div className="col-6 col-md-4">
          <div className="card"><div className="card-body py-2">
            <small className="text-muted">{t('Records')}</small>
            <div className="fw-bold fs-5">{expenses.length}</div>
          </div></div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card"><div className="card-body py-2">
            <small className="text-muted">{t('By Type')}</small>
            <div className="small">
              {EXPENSE_TYPES.map((ty) => (
                <span key={ty} className="badge bg-success me-1 mb-1">
                  {t(ty)}: Rs {expenses.filter((e) => e.expense_type === ty).reduce((s, e) => s + Number(e.amount || 0), 0)}
                </span>
              ))}
            </div>
          </div></div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">{t('All Expenses')}</h5>
          {expenses.length === 0 ? (
            <p className="text-muted small mb-0">{t('No expenses.')}</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-striped mb-0 aw-cards-table">
                <thead>
                  <tr>
                    <th>{t('Type')}</th>
                    <th>{t('Date')}</th>
                    <th>{t('Amount')}</th>
                    <th>{t('Description')}</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td data-label={t('Type')}>{t(e.expense_type)}</td>
                      <td data-label={t('Date')}>{e.date}</td>
                      <td data-label={t('Amount')}>Rs {e.amount}</td>
                      <td data-label={t('Description')}>{e.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="d-flex gap-2 flex-wrap">
        <Link to="/expenses" className="btn btn-success btn-sm">{t('Manage Expenses')}</Link>
      </div>
    </div>
  );
}
