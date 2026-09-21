// Focused Pending Payments details (read-only). Opened from the Dashboard card.
// Uses the backend pending_amount (Total − Paid); only filters to pending bills.
// Full billing stays in /bills.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import StatIcon from '../components/StatIcon';
import { useLanguage } from '../i18n/LanguageContext';
import { listBills } from '../services/bills';
import { formatRupees } from '../utils/formatRupees';

export default function DashboardPending() {
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

  const pendingBills = bills.filter((b) => Number(b.pending_amount || 0) > 0);
  const pendingTotal = pendingBills.reduce((s, b) => s + Number(b.pending_amount || 0), 0);

  if (loading) return <div className="container py-4 text-muted">{t('Loading pending payment details...')}</div>;

  return (
    <div className="container py-4">
      <BackButton to="/" label="Back to Dashboard" />
      <h2 className="fw-bold d-flex align-items-center gap-2">
        <span className="text-success d-inline-flex"><StatIcon name="pending" /></span>{t('Pending Payments Details')}
      </h2>
      <p className="text-muted">{t('Focused summary of bills with amounts still due.')}</p>
      {error && <div className="alert alert-danger">{t(error)}</div>}

      <div className="row g-2 mb-3">
        <div className="col-6 col-md-6">
          <div className="card"><div className="card-body py-2">
            <small className="text-muted">{t('Total Pending')}</small>
            <div className="fw-bold fs-5">₹{formatRupees(pendingTotal)}</div>
          </div></div>
        </div>
        <div className="col-6 col-md-6">
          <div className="card"><div className="card-body py-2">
            <small className="text-muted">{t('Pending Bills')}</small>
            <div className="fw-bold fs-5">{pendingBills.length}</div>
          </div></div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">{t('Bills With Pending Amount')}</h5>
          {pendingBills.length === 0 ? (
            <p className="text-muted small mb-0">{t('No pending payments. All bills are paid.')}</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-striped mb-0 aw-cards-table">
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
                  {pendingBills.map((b) => (
                    <tr key={b.id}>
                      <td data-label={t('Farmer')}>{b.farmer_name || '—'}</td>
                      <td data-label={t('Bill Date')}>{b.bill_date}</td>
                      <td data-label={t('Total')}>₹{formatRupees(b.total_amount)}</td>
                      <td data-label={t('Paid')}>₹{formatRupees(b.paid_amount)}</td>
                      <td data-label={t('Pending')}>₹{formatRupees(b.pending_amount)}</td>
                      <td data-label={t('Status')}>{t(b.status)}</td>
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
