// Static Privacy Policy page — informational only, no API calls, no DB changes.
// Uses existing Bootstrap styling and language system (t() for EN/HI/MR).
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';

export default function Privacy() {
  const { t } = useLanguage();

  return (
    <div className="container py-4">
      <h2 className="fw-bold">{t('Privacy Policy')}</h2>
      <p className="text-muted">{t('How information is handled in AgriWorks Manager. Last updated: 2026.')}</p>

      <div className="alert alert-info small">
        {t('This page provides information only. No data is created or modified here.')}
      </div>

      <section className="mb-4">
        <h5 className="fw-semibold">{t('Overview')}</h5>
        <p className="small">
          {t('AgriWorks Manager is designed for agricultural service providers to maintain their own business records. The application stores only the information you enter for managing farmers, work, billing, payments, and expenses. This policy explains, in simple terms, how each category of information is handled.')}
        </p>
      </section>

      <section className="mb-4">
        <h5 className="fw-semibold">{t('User Account Information')}</h5>
        <p className="small">
          {t('When you create an account, basic details such as your name, email address, and password credentials are stored so you can log in securely and access only your own records. Passwords are stored in a protected form and are never displayed. You are responsible for keeping your login credentials confidential.')}
        </p>
      </section>

      <section className="mb-4">
        <h5 className="fw-semibold">{t('Farmer Information')}</h5>
        <p className="small">
          {t('Farmer records you create — such as name, mobile number, village, and address — are stored so you can link work, bills, and payments to the correct farmer. These records are visible only within your own account and should be entered only with the farmer\u2019s knowledge for genuine business record-keeping purposes.')}
        </p>
      </section>

      <section className="mb-4">
        <h5 className="fw-semibold">{t('Work Records')}</h5>
        <p className="small">
          {t('Work records including work type, date, area covered, and amount charged are stored as your service history. They are used to generate bills and business reports. Work records belong to your account and are not shared with other users of the system.')}
        </p>
      </section>

      <section className="mb-4">
        <h5 className="fw-semibold">{t('Billing Information')}</h5>
        <p className="small">
          {t('Bills generated from work records, including bill date, total amount, and status (Unpaid, Partial, Paid), are stored as part of your business accounts. They are used to track dues and produce billing and pending-payment reports.')}
        </p>
      </section>

      <section className="mb-4">
        <h5 className="fw-semibold">{t('Payment Records')}</h5>
        <p className="small">
          {t('Payment entries including payment date, method, and amount are stored against their respective bills to calculate paid and pending amounts. The system does not process real money transfers; it only keeps a record of payments you report receiving.')}
        </p>
      </section>

      <section className="mb-4">
        <h5 className="fw-semibold">{t('Expense Records')}</h5>
        <p className="small">
          {t('Expense entries including expense type, amount, date, and description are stored so you can monitor business costs such as diesel, maintenance, and wages, and compare them against income in performance reports.')}
        </p>
      </section>

      <section className="mb-4">
        <h5 className="fw-semibold">{t('Data Use and Protection')}</h5>
        <ul className="small">
          <li>{t('Your records are isolated per account — you can access only the data entered under your own login.')}</li>
          <li>{t('Records are used only to display your dashboard, reports, and account history; they are not sold or used for advertising.')}</li>
          <li>{t('Always log out on shared devices and keep your password secure to protect your business data.')}</li>
        </ul>
      </section>

      <div className="card">
        <div className="card-body text-center">
          <p className="small text-muted mb-2">{t('Questions about this policy? Review the FAQ or contact the project administrator.')}</p>
          <div className="d-flex gap-2 justify-content-center flex-wrap">
            <Link to="/" className="btn btn-outline-success btn-sm">{t('Back to Home')}</Link>
            <Link to="/faq" className="btn btn-outline-success btn-sm">{t('View FAQ')}</Link>
            <Link to="/about" className="btn btn-success btn-sm">{t('About AgriWorks')}</Link>
            <Link to="/terms" className="btn btn-success btn-sm">{t('Next')}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
