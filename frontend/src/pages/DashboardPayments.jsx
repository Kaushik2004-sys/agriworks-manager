// Focused Payments details (read-only). Opened from the Dashboard card.
// Shows payment info from existing payment data. Full payments stay in /payments.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import StatIcon from '../components/StatIcon';
import { useLanguage } from '../i18n/LanguageContext';
import { PAYMENT_METHODS, listPayments } from '../services/payments';

export default function DashboardPayments() {
  const { t } = useLanguage();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listPayments()
      .then((data) => setPayments(Array.isArray(data) ? data : data.results || []))
      .catch(() => setError('Cannot load payments. Check backend is running.'))
      .finally(() => setLoading(false));
  }, []);

  const received = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  if (loading) return <div className="container py-4 text-muted">{t('Loading payment details...')}</div>;

  return (
    <div className="container py-4">
      <BackButton to="/" label="Back to Dashboard" />
      <h2 className="fw-bold d-flex align-items-center gap-2">
        <span className="text-success d-inline-flex"><StatIcon name="payment" /></span>{t('Payments Details')}
      </h2>
      <p className="text-muted">{t('Focused summary of payments received.')}</p>
      {error && <div className="alert alert-danger">{t(error)}</div>}

      <div className="row g-2 mb-3">
        <div className="col-6 col-md-4">
          <div className="card"><div className="card-body py-2">
            <small className="text-muted">{t('Received')}</small>
            <div className="fw-bold fs-5">Rs {received}</div>
          </div></div>
        </div>
        <div className="col-6 col-md-4">
          <div className="card"><div className="card-body py-2">
            <small className="text-muted">{t('Payments')}</small>
            <div className="fw-bold fs-5">{payments.length}</div>
          </div></div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card"><div className="card-body py-2">
            <small className="text-muted">{t('By Method')}</small>
            <div className="small">
              {PAYMENT_METHODS.map((m) => (
                <span key={m} className="badge bg-success me-1 mb-1">
                  {t(m)}: Rs {payments.filter((p) => p.method === m).reduce((s, p) => s + Number(p.amount || 0), 0)}
                </span>
              ))}
            </div>
          </div></div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">{t('All Payments')}</h5>
          {payments.length === 0 ? (
            <p className="text-muted small mb-0">{t('No payments received.')}</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-striped mb-0">
                <thead>
                  <tr>
                    <th>{t('Farmer')}</th>
                    <th>{t('Bill')}</th>
                    <th>{t('Date')}</th>
                    <th>{t('Method')}</th>
                    <th>{t('Amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.farmer_name || '—'}</td>
                      <td>#{p.bill_id ?? p.bill}</td>
                      <td>{p.payment_date}</td>
                      <td>{t(p.method)}</td>
                      <td>Rs {p.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="d-flex gap-2 flex-wrap">
        <Link to="/payments" className="btn btn-success btn-sm">{t('Manage Payments')}</Link>
      </div>
    </div>
  );
}
