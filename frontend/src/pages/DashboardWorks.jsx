// Focused Work Records details (read-only). Opened from the Dashboard card.
// Full add/edit/delete stays in /works. Reuses listWorks; no logic changes.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import StatIcon from '../components/StatIcon';
import { useLanguage } from '../i18n/LanguageContext';
import { listWorks } from '../services/works';
import { formatRupees } from '../utils/formatRupees';

export default function DashboardWorks() {
  const { t } = useLanguage();
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listWorks()
      .then((data) => setWorks(Array.isArray(data) ? data : data.results || []))
      .catch(() => setError('Cannot load work records. Check backend is running.'))
      .finally(() => setLoading(false));
  }, []);

  const totalArea = works.reduce((s, w) => s + Number(w.area || 0), 0);
  const totalAmount = works.reduce((s, w) => s + Number(w.amount || 0), 0);

  if (loading) return <div className="container py-4 text-muted">{t('Loading work details...')}</div>;

  return (
    <div className="container py-4">
      <BackButton to="/" label="Back to Dashboard" />
      <h2 className="fw-bold d-flex align-items-center gap-2">
        <span className="text-success d-inline-flex"><StatIcon name="work" /></span>{t('Work Records Details')}
      </h2>
      <p className="text-muted">{t('Focused summary of your agricultural work records.')}</p>
      {error && <div className="alert alert-danger">{t(error)}</div>}

      <div className="row g-2 mb-3">
        <div className="col-6 col-md-4">
          <div className="card"><div className="card-body py-2">
            <small className="text-muted">{t('Records')}</small>
            <div className="fw-bold fs-5">{works.length}</div>
          </div></div>
        </div>
        <div className="col-6 col-md-4">
          <div className="card"><div className="card-body py-2">
            <small className="text-muted">{t('Total Area')}</small>
            <div className="fw-bold fs-5">{totalArea}</div>
          </div></div>
        </div>
        <div className="col-6 col-md-4">
          <div className="card"><div className="card-body py-2">
            <small className="text-muted">{t('Total Amount')}</small>
            <div className="fw-bold fs-5">₹{formatRupees(totalAmount)}</div>
          </div></div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">{t('All Work Records')}</h5>
          {works.length === 0 ? (
            <p className="text-muted small mb-0">{t('No work records.')}</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-striped mb-0 aw-cards-table">
                <thead>
                  <tr>
                    <th>{t('Farmer')}</th>
                    <th>{t('Work Type')}</th>
                    <th>{t('Date')}</th>
                    <th>{t('Area')}</th>
                    <th>{t('Amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {works.map((w) => (
                    <tr key={w.id}>
                      <td data-label={t('Farmer')}>{w.farmer_name || '—'}</td>
                      <td data-label={t('Work Type')}>{t(w.work_type)}</td>
                      <td data-label={t('Date')}>{w.work_date}</td>
                      <td data-label={t('Area')}>{w.area}</td>
                      <td data-label={t('Amount')}>₹{formatRupees(w.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="d-flex gap-2 flex-wrap">
        <Link to="/works" className="btn btn-success btn-sm">{t('Manage Work Records')}</Link>
      </div>
    </div>
  );
}
