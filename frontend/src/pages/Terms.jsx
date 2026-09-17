// Static Terms & Conditions page — informational only, no API calls, no DB changes.
// Uses existing Bootstrap styling and language system (t() for EN/HI/MR).
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export default function Terms() {
  const { user } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="container py-4">
      <h2 className="fw-bold">{t('Terms & Conditions')}</h2>
      <p className="text-muted">{t('Rules for using AgriWorks Manager. Last updated: 2026.')}</p>

      <section className="mb-4">
        <h5 className="fw-semibold">{t('Proper Use of the System')}</h5>
        <p className="small">
          {t('AgriWorks Manager is provided for managing agricultural service work, including farmer records, work tracking, billing, payments, expenses, and business reports. You agree to use the system only for lawful business record-keeping related to your own agricultural services.')}
        </p>
      </section>

      <section className="mb-4">
        <h5 className="fw-semibold">{t('User Responsibility for Entered Data')}</h5>
        <p className="small">
          {t('You are responsible for the accuracy and completeness of all information you enter, including farmer details, work dates, areas, amounts, bills, payments, and expenses. Always verify entries before saving, since bills, pending amounts, and reports are calculated directly from your inputs.')}
        </p>
      </section>

      <section className="mb-4">
        <h5 className="fw-semibold">{t('Mobile Number Uniqueness')}</h5>
        <p className="small">
          {t('Each mobile number can be registered to only one account. If you attempt to register or update your profile with a mobile number already in use by another account, the request will be rejected. You can keep your own mobile number when updating your profile.')}
        </p>
      </section>

      <section className="mb-4">
        <h5 className="fw-semibold">{t('Account Security')}</h5>
        <ul className="small">
          <li>{t('Keep your email, username, and password confidential; do not share your login with others.')}</li>
          <li>{t('Use a strong password and log out after each session, especially on shared or public devices.')}</li>
          <li>{t('Notify the project administrator promptly if you suspect unauthorized access to your account.')}</li>
          <li>{t('Only one active session is allowed per account. Logging in on a new device will end your previous session.')}</li>
          <li>{t('Each successful login records the date, time, IP address, and browser information for security audit purposes.')}</li>
        </ul>
      </section>

      <section className="mb-4">
        <h5 className="fw-semibold">{t('Prohibited Misuse')}</h5>
        <ul className="small">
          <li>{t('Do not enter false, misleading, or inflated records.')}</li>
          <li>{t('Do not attempt to access other users\u2019 accounts or data.')}</li>
          <li>{t('Do not misuse the system to harass farmers or any other person.')}</li>
          <li>{t('Do not attempt to disrupt, damage, or gain unauthorized access to the application or its hosting environment.')}</li>
        </ul>
      </section>

      <section className="mb-4">
        <h5 className="fw-semibold">{t('Accuracy of Records')}</h5>
        <p className="small">
          {t('The system performs automatic calculations such as bill totals, paid and pending amounts, and report summaries. These outputs are only as accurate as the data you enter. You should independently review bills and reports before sharing them with farmers or using them for financial decisions.')}
        </p>
      </section>

      <section className="mb-4">
        <h5 className="fw-semibold">{t('General Service Limitations')}</h5>
        <p className="small">
          {t('AgriWorks Manager is a record-keeping and reporting tool developed as an academic project. It does not process real payments, does not provide legal, financial, accounting, or agricultural advice, and is provided on an as-is basis without guarantees of uninterrupted availability. Always keep your own backups of important business documents.')}
        </p>
      </section>

      <div className="card">
        <div className="card-body text-center">
          <p className="small text-muted mb-2">{t('By using this application you agree to these terms.')}</p>
          <div className={user ? 'd-flex gap-2 justify-content-between flex-wrap' : 'd-flex gap-2 justify-content-center flex-wrap'}>
            {user ? (
              <>
                <Link to="/privacy" className="btn btn-outline-success btn-sm">&larr; {t('Back')}</Link>
                <Link to={user.is_superuser ? '/admin/dashboard' : '/'} className="btn btn-success btn-sm">{t('Go to Dashboard')}</Link>
                <Link to="/disclaimer" className="btn btn-success btn-sm">{t('Next')} &rarr;</Link>
              </>
            ) : (
              <>
                <Link to="/privacy" className="btn btn-outline-success btn-sm">&larr; {t('Back')}</Link>
                <Link to="/" className="btn btn-outline-success btn-sm">{t('Back to Home')}</Link>
                <Link to="/privacy" className="btn btn-outline-success btn-sm">{t('Privacy Policy')}</Link>
                <Link to="/disclaimer" className="btn btn-success btn-sm">{t('Disclaimer')}</Link>
                <Link to="/disclaimer" className="btn btn-success btn-sm">{t('Next')}</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
