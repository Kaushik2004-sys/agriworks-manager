// Static Disclaimer page — informational only, no API calls, no DB changes.
// Uses existing Bootstrap styling and language system (t() for EN/HI/MR).
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';

export default function Disclaimer() {
  const { t } = useLanguage();

  return (
    <div className="container py-4">
      <h2 className="fw-bold">{t('Disclaimer')}</h2>
      <p className="text-muted">{t('Important information about the scope of AgriWorks Manager. Last updated: 2026.')}</p>

      <div className="alert alert-info small">
        {t('This page provides information only. No data is created or modified here.')}
      </div>

      <section className="mb-4">
        <h5 className="fw-semibold">{t('Purpose of the System')}</h5>
        <p className="small">
          {t('AgriWorks Manager is designed for agricultural service and work management and record keeping — recording farmers, field work, bills, payments, expenses, and business reports. It is an organizational tool that helps service providers maintain clear and consistent business records.')}
        </p>
      </section>

      <section className="mb-4">
        <h5 className="fw-semibold">{t('User Responsibility for Accuracy')}</h5>
        <p className="small">
          {t('Users are responsible for the accuracy of their entered information. Bill totals, pending amounts, dashboards, and reports are generated automatically from the data you provide. Incorrect farmer details, work entries, amounts, or payment records will produce incorrect outputs, so please verify every entry.')}
        </p>
      </section>

      <section className="mb-4">
        <h5 className="fw-semibold">{t('No Professional Advice')}</h5>
        <p className="small">
          {t('The system does not replace professional legal, financial, accounting, or agricultural advice. Information, totals, and reports shown in the application are for general record-keeping and business tracking only. Consult a qualified professional before making legal, tax, financial, or crop-management decisions.')}
        </p>
      </section>

      <section className="mb-4">
        <h5 className="fw-semibold">{t('Academic Project Context')}</h5>
        <p className="small">
          {t('This application was developed as a college project to demonstrate full-stack web development and to address real needs in agricultural service management. While it is built to be useful for real record-keeping, it is presented as an academic project and is provided on an as-is basis without warranties of any kind.')}
        </p>
      </section>

      <div className="card">
        <div className="card-body text-center">
          <p className="small text-muted mb-2">{t('Use the system responsibly and verify important records independently.')}</p>
          <div className="d-flex gap-2 justify-content-center flex-wrap">
            <Link to="/" className="btn btn-outline-success btn-sm">{t('Back to Home')}</Link>
            <Link to="/terms" className="btn btn-outline-success btn-sm">{t('Terms & Conditions')}</Link>
            <Link to="/faq" className="btn btn-success btn-sm">{t('View FAQ')}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
