// Focused Farmers details (read-only). Opened from the Dashboard card.
// Shows farmer info from existing farmer data. Full management stays in /farmers.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import StatIcon from '../components/StatIcon';
import { useLanguage } from '../i18n/LanguageContext';
import { listFarmers } from '../services/farmers';

export default function DashboardFarmers() {
  const { t } = useLanguage();
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listFarmers()
      .then((data) => setFarmers(Array.isArray(data) ? data : data.results || []))
      .catch(() => setError('Cannot load farmers. Check backend is running.'))
      .finally(() => setLoading(false));
  }, []);

  const villages = new Set(farmers.map((f) => f.village).filter(Boolean)).size;

  if (loading) return <div className="container py-4 text-muted">{t('Loading farmer details...')}</div>;

  return (
    <div className="container py-4">
      <BackButton to="/" label="Back to Dashboard" />
      <h2 className="fw-bold d-flex align-items-center gap-2">
        <span className="text-success d-inline-flex"><StatIcon name="farmers" /></span>{t('Farmers Details')}
      </h2>
      <p className="text-muted">{t('Focused summary of your farmers.')}</p>
      {error && <div className="alert alert-danger">{t(error)}</div>}

      <div className="row g-2 mb-3">
        <div className="col-6 col-md-6">
          <div className="card"><div className="card-body py-2">
            <small className="text-muted">{t('Farmers')}</small>
            <div className="fw-bold fs-5">{farmers.length}</div>
          </div></div>
        </div>
        <div className="col-6 col-md-6">
          <div className="card"><div className="card-body py-2">
            <small className="text-muted">{t('Villages')}</small>
            <div className="fw-bold fs-5">{villages}</div>
          </div></div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">{t('All Farmers')}</h5>
          {farmers.length === 0 ? (
            <p className="text-muted small mb-0">{t('No farmers.')}</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-striped mb-0 aw-cards-table">
                <thead>
                  <tr>
                    <th>{t('Name')}</th>
                    <th>{t('Mobile')}</th>
                    <th>{t('Village')}</th>
                  </tr>
                </thead>
                <tbody>
                  {farmers.map((f) => (
                    <tr key={f.id}>
                      <td data-label={t('Name')}>{f.name}</td>
                      <td data-label={t('Mobile')}>{f.mobile}</td>
                      <td data-label={t('Village')}>{f.village}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="d-flex gap-2 flex-wrap">
        <Link to="/farmers" className="btn btn-success btn-sm">{t('Manage Farmers')}</Link>
      </div>
    </div>
  );
}
