// Static About AgriWorks page — informational only, no API calls, no DB changes.
// Uses existing Bootstrap styling and language system (t() for EN/HI/MR).
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export default function About() {
  const { user } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="container py-4">
      <h2 className="fw-bold">{t('About AgriWorks Manager')}</h2>
      <p className="text-muted">{t('Learn about the purpose and features of this application.')}</p>

      <div className="alert alert-info small">
        {t('This page provides information only. No data is created or modified here.')}
      </div>

      <section className="mb-4">
        <h5 className="fw-semibold">{t('Purpose')}</h5>
        <p className="small">
          {t('AgriWorks Manager is a comprehensive agricultural service management application designed to help farmers, agricultural service providers, and farm managers efficiently track and manage their daily operations. The system provides a centralized platform for recording farmer information, agricultural work performed, billing, payments, expenses, and generating business performance reports.')}
        </p>
      </section>

      <section className="mb-4">
        <h5 className="fw-semibold">{t('Key Features')}</h5>
        <ul className="small">
          <li>{t('Farmer Management — Add, view, edit, and delete farmer records with contact details and village information.')}</li>
          <li>{t('Agricultural Work Tracking — Record work performed for each farmer including work type (Ploughing, Rotavator, Cultivation, Harvesting, Irrigation), date, area covered, and amount charged.')}</li>
          <li>{t('Billing System — Generate bills from completed work records with automatic amount calculation and status tracking (Unpaid, Partial, Paid).')}</li>
          <li>{t('Payment Management — Record full or partial payments against bills with multiple payment methods (Cash, UPI, Bank Transfer, Cheque, Other) and automatic pending amount calculation.')}</li>
          <li>{t('Expense Tracking — Log business expenses by type (Diesel, Maintenance, Driver Wages, Other) with dates and optional descriptions.')}</li>
          <li>{t('Business Reports — Generate comprehensive reports for work, billing, payments, pending payments, expenses, and overall business performance with filtering and CSV export capabilities.')}</li>
          <li>{t('Dashboard — Real-time overview of key metrics including total farmers, work records, income, received payments, pending payments, expenses, and recent activity.')}</li>
          <li>{t('Multi-language Support — Interface available in English, Hindi (हिन्दी), and Marathi (मराठी).')}</li>
          <li>{t('User Authentication — Secure login, signup, password reset, and profile management.')}</li>
        </ul>
      </section>

      <section className="mb-4">
        <h5 className="fw-semibold">{t('Who Should Use This')}</h5>
        <p className="small">
          {t('AgriWorks Manager is designed for agricultural service providers, tractor owners, irrigation service operators, harvest contractors, and farm managers who need to organize their operations, track income and expenses, and maintain accurate records for business analysis and compliance purposes.')}
        </p>
      </section>

      <div className="card">
        <div className="card-body text-center">
          <p className="small text-muted mb-2">{t('Explore the application to see how it can help manage your agricultural services.')}</p>
          <div className={user ? 'd-flex gap-2 justify-content-between flex-wrap' : 'd-flex gap-2 justify-content-center flex-wrap'}>
            {user ? (
              <>
                <span />
                <Link to={user.is_superuser ? '/admin/dashboard' : '/'} className="btn btn-success btn-sm">{t('Go to Dashboard')}</Link>
                <Link to="/help-support" className="btn btn-success btn-sm">{t('Next')} &rarr;</Link>
              </>
            ) : (
              <>
                <Link to="/" className="btn btn-outline-success btn-sm">{t('Back to Home')}</Link>
                <Link to="/login" className="btn btn-success btn-sm">{t('Get Started')}</Link>
                <Link to="/signup" className="btn btn-outline-success btn-sm">{t('Create Account')}</Link>
                <Link to="/help-support" className="btn btn-success btn-sm">{t('Next')}</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}