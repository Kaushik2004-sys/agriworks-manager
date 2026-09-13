// Focused Income details (read-only). Opened from the Dashboard card.
// Shows billed/income info from existing billing data. Full billing stays in /bills.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import StatIcon from '../components/StatIcon';
import { useLanguage } from '../i18n/LanguageContext';
import { listBills } from '../services/bills';

export default function DashboardIncome() {
  const { t } = useLanguage();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listBills()
      .then((data) => setBills(Array.isArray(data) ? data : data.results || []))
      .catch(() => setError('Cannot load bills. Check backend is running.'))
      .finally(() => setLoading(false));
  }, []);

  const income = bills.reduce((s, b) => s + Number(b.total_amount || 0), 0);
  const unpaid = bills.filter((b) => b.status === 'Unpaid').length;
  const partial = bills.filter((b) => b.status === 'Partial').length;
  const paid = bills.filter((b) => b.status === 'Paid').length;

  if (loading) return <div className="container py-4 text-muted">{t('Loading income details...')}</div>;

  return (
    <div className="container py-4">
      <BackButton to="/" label="Back to Dashboard" />
      <h2 className="fw-bold d-flex align-items-center gap-2">
        <span className="text-success d-inline-flex"><StatIcon name="income" /></span>{t('Income Details')}
      </h2>
      <p className="text-muted">{t('Focused summary of your billed income.')}</p>
      {error && <div className="alert alert-danger">{t(error)}</div>}

      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3">
          <div className="card"><div className="card-body py-2">
            <small className="text-muted">{t('Total Income (billed)')}</small>
            <div className="fw-bold fs-5">Rs {income}</div>
          </div></div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card"><div className="card-body py-2">
            <small className="text-muted">{t('Bills')}</small>
            <div className="fw-bold fs-5">{bills.length}</div>
          </div></div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card"><div className="card-body py-2">
            <small className="text-muted">{t('Unpaid / Partial')}</small>
            <div className="fw-bold fs-5">{unpaid} / {partial}</div>
          </div></div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card"><div className="card-body py-2">
            <small className="text-muted">{t('Paid')}</small>
            <div className="fw-bold fs-5">{paid}</div>
          </div></div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">{t('All Bills')}</h5>
          {bills.length === 0 ? (
            <p className="text-muted small mb-0">{t('No bills.')}</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-striped mb-0">
                <thead>
                  <tr>
                    <th>{t('Farmer')}</th>
                    <th>{t('Bill Date')}</th>
                    <th>{t('Total')}</th>
                    <th>{t('Paid')}</th>
                    <th>{t('Pending')}</th>
                    <th>{t('Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b) => (
                    <tr key={b.id}>
                      <td>{b.farmer_name || '—'}</td>
                      <td>{b.bill_date}</td>
                      <td>Rs {b.total_amount}</td>
                      <td>Rs {b.paid_amount}</td>
                      <td>Rs {b.pending_amount}</td>
                      <td>{t(b.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="d-flex gap-2 flex-wrap">
        <Link to="/bills" className="btn btn-success btn-sm">{t('Manage Bills')}</Link>
      </div>
    </div>
  );
}
