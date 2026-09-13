// Static FAQ page — informational only, no API calls, no DB changes.
// Uses existing Bootstrap styling and language system (t() for EN/HI/MR).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';

const FAQS = [
  {
    id: 'what-is',
    q: 'What is AgriWorks Manager?',
    a: 'AgriWorks Manager is a farm work and irrigation service management application. It helps agricultural service providers record farmers, track work performed, generate bills, record payments, log expenses, and view business reports from one central place.',
  },
  {
    id: 'who-can-use',
    q: 'Who can use it?',
    a: 'It is designed for agricultural service providers such as tractor owners, ploughing and harvesting contractors, irrigation service operators, and farm managers who provide paid field services to farmers and need organized records of their work and income.',
  },
  {
    id: 'work-types',
    q: 'What agricultural work can be recorded?',
    a: 'You can record work types such as Ploughing, Rotavator, Cultivation, Harvesting, and Irrigation. Each work record is linked to one farmer and includes the work date, area covered, and amount charged.',
  },
  {
    id: 'bills',
    q: 'How are bills generated?',
    a: 'Go to the Bills page and generate a bill from a completed, unbilled work record. The farmer and amount are auto-filled from the work, and you set the bill date and total amount. Each bill tracks its status automatically as Unpaid, Partial, or Paid based on payments received.',
  },
  {
    id: 'partial-payments',
    q: 'How are partial payments handled?',
    a: 'A bill can be paid in multiple installments. Each payment is recorded separately against the bill with a date and method (Cash, UPI, Bank Transfer, Cheque, or Other). The pending amount is calculated automatically as Total Amount minus Paid Amount, and overpayment beyond the pending amount is blocked.',
  },
  {
    id: 'expenses',
    q: 'How are expenses recorded?',
    a: 'Go to the Expenses page and add each business expense with its type (Diesel, Maintenance, Driver Wages, or Other), amount, date, and an optional description. Expenses are included in reports and business performance summaries.',
  },
  {
    id: 'pending',
    q: 'Can users view pending payments?',
    a: 'Yes. Bill status shows at a glance whether a bill is Unpaid, Partial, or Paid. The Reports page also has a dedicated Pending Payments report listing all bills with a pending amount greater than zero, and the Dashboard shows total pending payments.',
  },
  {
    id: 'mobile',
    q: 'Is the system mobile-friendly?',
    a: 'Yes. The interface uses responsive design and works on mobile phones, tablets, and desktop computers, so work, bills, and payments can be recorded directly from the field.',
  },
];

export default function FAQ() {
  const { t } = useLanguage();
  const [open, setOpen] = useState('what-is');

  function toggle(id) {
    setOpen((prev) => (prev === id ? '' : id));
  }

  return (
    <div className="container py-4">
      <h2 className="fw-bold">{t('Frequently Asked Questions')}</h2>
      <p className="text-muted">{t('Common questions about using AgriWorks Manager.')}</p>

      <div className="alert alert-info small">
        {t('This page provides information only. No data is created or modified here.')}
      </div>

      <div className="accordion mb-4" id="faqAccordion">
        {FAQS.map((f) => (
          <div className="accordion-item" key={f.id}>
            <h2 className="accordion-header">
              <button
                className={`accordion-button ${open === f.id ? '' : 'collapsed'}`}
                type="button"
                onClick={() => toggle(f.id)}
                aria-expanded={open === f.id}
              >
                {t(f.q)}
              </button>
            </h2>
            <div className={`accordion-collapse collapse ${open === f.id ? 'show' : ''}`}>
              <div className="accordion-body small">{t(f.a)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-body text-center">
          <p className="small text-muted mb-2">{t('Learn more about the application or get started today.')}</p>
          <div className="d-flex gap-2 justify-content-center flex-wrap">
            <Link to="/" className="btn btn-outline-success btn-sm">{t('Back to Home')}</Link>
            <Link to="/about" className="btn btn-outline-success btn-sm">{t('About AgriWorks')}</Link>
            <Link to="/login" className="btn btn-success btn-sm">{t('Get Started')}</Link>
            <Link to="/privacy" className="btn btn-success btn-sm">{t('Next')}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
