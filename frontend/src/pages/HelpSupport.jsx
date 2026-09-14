// Static Help & Support page — informational only, no API calls, no DB changes.
// Uses existing Bootstrap styling and language system (t() for EN/HI/MR).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

const SECTIONS = [
  { id: 'login', label: 'Login & Account Help' },
  { id: 'farmers', label: 'Farmer Management Help' },
  { id: 'works', label: 'Agricultural Work Help' },
  { id: 'billing', label: 'Billing Help' },
  { id: 'payments', label: 'Payment Help' },
  { id: 'expenses', label: 'Expense Help' },
  { id: 'dashboard', label: 'Dashboard Help' },
  { id: 'reports', label: 'Reports Help' },
  { id: 'common', label: 'Common Problems' },
];

const WORK_TYPES = ['Ploughing', 'Rotavator', 'Cultivation', 'Harvesting', 'Irrigation', 'Other', 'Land Leveling'];
const EXPENSE_TYPES = ['Diesel', 'Maintenance', 'Driver Wages', 'Other'];

export default function HelpSupport() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState('login');

  function toggle(id) {
    setOpen((prev) => (prev === id ? '' : id));
  }

  return (
    <div className="container py-4">
      <h2 className="fw-bold">{t('Help & Support')}</h2>
      <p className="text-muted">{t('Guides for using AgriWorks Manager.')}</p>

      {/* Quick navigation buttons */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={`btn btn-sm ${open === s.id ? 'btn-success' : 'btn-outline-success'}`}
            onClick={() => toggle(s.id)}
          >
            {t(s.label)}
          </button>
        ))}
      </div>

      <div className="accordion mb-4" id="helpAccordion">
        {/* A. Login & Account Help */}
        <div className="accordion-item">
          <h2 className="accordion-header">
            <button
              className={`accordion-button ${open === 'login' ? '' : 'collapsed'}`}
              type="button"
              onClick={() => toggle('login')}
              aria-expanded={open === 'login'}
            >
              {t('Login & Account Help')}
            </button>
          </h2>
          <div className={`accordion-collapse collapse ${open === 'login' ? 'show' : ''}`}>
            <div className="accordion-body small">
              <h6 className="fw-semibold">{t('How to log in')}</h6>
              <p className="mb-2">{t('Open the Login page and enter your registered Email (or Username) and Password, then click Login.')}</p>

              <h6 className="fw-semibold">{t('What to do if login fails')}</h6>
              <p className="mb-2">{t('Check that Caps Lock is off, your email and password are correct, and your account exists. If you forgot your password, use Forgot Password.')}</p>

              <h6 className="fw-semibold">{t('Forgot password instructions')}</h6>
              <p className="mb-2">{t('On the Login page click "Forgot Password?", enter your registered email and click "Send Reset Link".')}</p>

              <h6 className="fw-semibold">{t('Password reset instructions')}</h6>
              <p className="mb-1">{t('You will receive a reset link by email (valid for 24 hours, single-use). Open it, set a new strong password and confirm, then log in with the new password.')}</p>
              <p className="text-muted mb-2">{t('Your new password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a special character.')}</p>

              <h6 className="fw-semibold">{t('Logout information')}</h6>
              <p className="mb-0">{t('Click Logout in the top navigation bar. You will be redirected to the Login page and your session will end.')}</p>
            </div>
          </div>
        </div>

        {/* B. Farmer Management Help */}
        <div className="accordion-item">
          <h2 className="accordion-header">
            <button
              className={`accordion-button ${open === 'farmers' ? '' : 'collapsed'}`}
              type="button"
              onClick={() => toggle('farmers')}
              aria-expanded={open === 'farmers'}
            >
              {t('Farmer Management Help')}
            </button>
          </h2>
          <div className={`accordion-collapse collapse ${open === 'farmers' ? 'show' : ''}`}>
            <div className="accordion-body small">
              <h6 className="fw-semibold">{t('How to add a farmer')}</h6>
              <p className="mb-2">{t('Go to Farmers and click Add Farmer. Fill Name, 10-digit Mobile, Village and optional Address, then Save.')}</p>
              <h6 className="fw-semibold">{t('How to view farmer records')}</h6>
              <p className="mb-2">{t('Open Farmers to see all your farmers in a table.')}</p>
              <h6 className="fw-semibold">{t('How to edit farmer information')}</h6>
              <p className="mb-2">{t('Click Edit on a farmer row, update the details and Save.')}</p>
              <h6 className="fw-semibold">{t('How to delete a farmer')}</h6>
              <p className="mb-2">{t('Click Delete on a farmer row and confirm. Deleting a farmer will also remove linked work, bills and payments (cascade).')}</p>
              <h6 className="fw-semibold">{t('How to search/filter farmers')}</h6>
              <p className="mb-0">{t('Use the search box to filter by name, mobile or village.')}</p>
            </div>
          </div>
        </div>

        {/* C. Agricultural Work Help */}
        <div className="accordion-item">
          <h2 className="accordion-header">
            <button
              className={`accordion-button ${open === 'works' ? '' : 'collapsed'}`}
              type="button"
              onClick={() => toggle('works')}
              aria-expanded={open === 'works'}
            >
              {t('Agricultural Work Help')}
            </button>
          </h2>
          <div className={`accordion-collapse collapse ${open === 'works' ? 'show' : ''}`}>
            <div className="accordion-body small">
              <h6 className="fw-semibold">{t('How to add a work record')}</h6>
              <p className="mb-2">{t('Go to Work and click Add Work. Select a Farmer, choose Work Type, enter Work Date, Area and Amount, then Save.')}</p>
              <h6 className="fw-semibold">{t('Available work types:')}</h6>
              <p className="mb-2">
                {WORK_TYPES.map((wt) => (
                  <span key={wt} className="badge bg-success me-1 mb-1">{t(wt)}</span>
                ))}
              </p>
              <p className="mb-1">{t('Work records are linked to farmers. Each work belongs to one farmer and cannot be assigned to another user\'s farmer.')}</p>
              <p className="mb-0">{t('Work date, area and amount are recorded. Date cannot be in the future, area must be greater than 0, amount cannot be negative.')}</p>
            </div>
          </div>
        </div>

        {/* D. Billing Help */}
        <div className="accordion-item">
          <h2 className="accordion-header">
            <button
              className={`accordion-button ${open === 'billing' ? '' : 'collapsed'}`}
              type="button"
              onClick={() => toggle('billing')}
              aria-expanded={open === 'billing'}
            >
              {t('Billing Help')}
            </button>
          </h2>
          <div className={`accordion-collapse collapse ${open === 'billing' ? 'show' : ''}`}>
            <div className="accordion-body small">
              <h6 className="fw-semibold">{t('How to generate a bill from a work record')}</h6>
              <p className="mb-2">{t('Go to Bills and click Generate Bill. Select an unbilled work record (farmer and amount are auto-filled), set Bill Date and Total Amount, then Save.')}</p>
              <h6 className="fw-semibold">{t('Explain automatic bill amount calculation')}</h6>
              <p className="mb-2">{t('The bill total defaults to the linked work amount but can be adjusted before saving. Once a bill is generated, its total amount is locked and cannot be changed. Paid and pending amounts are calculated automatically from payments.')}</p>
              <h6 className="fw-semibold">{t('Explain bill status:')}</h6>
              <ul className="mb-0">
                <li><b>{t('Unpaid')}</b> — {t('Unpaid — no payment recorded yet.')}</li>
                <li><b>{t('Partial')}</b> — {t('Partial — some payment received, pending remains.')}</li>
                <li><b>{t('Paid')}</b> — {t('Paid — full amount received, pending is zero.')}</li>
              </ul>
            </div>
          </div>
        </div>

        {/* E. Payment Help */}
        <div className="accordion-item">
          <h2 className="accordion-header">
            <button
              className={`accordion-button ${open === 'payments' ? '' : 'collapsed'}`}
              type="button"
              onClick={() => toggle('payments')}
              aria-expanded={open === 'payments'}
            >
              {t('Payment Help')}
            </button>
          </h2>
          <div className={`accordion-collapse collapse ${open === 'payments' ? 'show' : ''}`}>
            <div className="accordion-body small">
              <h6 className="fw-semibold">{t('How to record a payment')}</h6>
              <p className="mb-2">{t('Go to Payments, search and select a Farmer, then select one of their Work/Bill records, click Record Payment, enter Payment Date, Method and Amount, then Save.')}</p>
              <h6 className="fw-semibold">{t('Explain partial payments')}</h6>
              <p className="mb-2">{t('You can pay a bill in multiple installments. Each payment is recorded separately.')}</p>
              <h6 className="fw-semibold">{t('Explain pending amount')}</h6>
              <p className="mb-2">{t('Pending = Total Amount − Paid Amount. It shows how much is still due for a bill.')}</p>
              <h6 className="fw-semibold">{t('Explain that overpayment is not allowed')}</h6>
              <p className="mb-0">{t('The system blocks amounts greater than the pending amount. Pending cannot go below zero.')}</p>
            </div>
          </div>
        </div>

        {/* F. Expense Help */}
        <div className="accordion-item">
          <h2 className="accordion-header">
            <button
              className={`accordion-button ${open === 'expenses' ? '' : 'collapsed'}`}
              type="button"
              onClick={() => toggle('expenses')}
              aria-expanded={open === 'expenses'}
            >
              {t('Expense Help')}
            </button>
          </h2>
          <div className={`accordion-collapse collapse ${open === 'expenses' ? 'show' : ''}`}>
            <div className="accordion-body small">
              <h6 className="fw-semibold">{t('How to add an expense')}</h6>
              <p className="mb-2">{t('Go to Expenses and click Add Expense. Select Expense Type, enter Amount, Date and optional Description, then Save.')}</p>
              <h6 className="fw-semibold">{t('Available expense types:')}</h6>
              <p className="mb-0">
                {EXPENSE_TYPES.map((et) => (
                  <span key={et} className="badge bg-success me-1 mb-1">{t(et)}</span>
                ))}
              </p>
            </div>
          </div>
        </div>

        {/* G. Dashboard Help */}
        <div className="accordion-item">
          <h2 className="accordion-header">
            <button
              className={`accordion-button ${open === 'dashboard' ? '' : 'collapsed'}`}
              type="button"
              onClick={() => toggle('dashboard')}
              aria-expanded={open === 'dashboard'}
            >
              {t('Dashboard Help')}
            </button>
          </h2>
          <div className={`accordion-collapse collapse ${open === 'dashboard' ? 'show' : ''}`}>
            <div className="accordion-body small">
              <h6 className="fw-semibold">{t('Explain the information available on the dashboard:')}</h6>
              <p className="mb-2">{t('Farmers, Work Records, Income, Received payments, Pending payments, Expenses and Recent activity.')}</p>
              <p className="mb-0">{t('The dashboard shows totals for your account only. Recent Work, Recent Payments and Recent Expenses show the latest 5 records.')}</p>
            </div>
          </div>
        </div>

        {/* H. Reports Help */}
        <div className="accordion-item">
          <h2 className="accordion-header">
            <button
              className={`accordion-button ${open === 'reports' ? '' : 'collapsed'}`}
              type="button"
              onClick={() => toggle('reports')}
              aria-expanded={open === 'reports'}
            >
              {t('Reports Help')}
            </button>
          </h2>
          <div className={`accordion-collapse collapse ${open === 'reports' ? 'show' : ''}`}>
            <div className="accordion-body small">
              <h6 className="fw-semibold">{t('Explain the available reports for:')}</h6>
              <ul className="mb-2">
                <li>{t('Agricultural Work — list of work records with filters.')}</li>
                <li>{t('Billing — list of bills with status and totals.')}</li>
                <li>{t('Payments — payment history per bill.')}</li>
                <li>{t('Pending Payments — bills with pending amount greater than zero.')}</li>
                <li>{t('Expenses — expense records with totals.')}</li>
                <li>{t('Business Performance — summary of income, received, pending, expenses, profit (cash/billed) and breakdown by work type and expense type.')}</li>
              </ul>
              <p className="mb-0">{t('Reports can be filtered by search, farmer, dates, work type, status, expense type or method, and can be printed or exported to CSV.')}</p>
            </div>
          </div>
        </div>

        {/* I. Common Problems */}
        <div className="accordion-item">
          <h2 className="accordion-header">
            <button
              className={`accordion-button ${open === 'common' ? '' : 'collapsed'}`}
              type="button"
              onClick={() => toggle('common')}
              aria-expanded={open === 'common'}
            >
              {t('Common Problems')}
            </button>
          </h2>
          <div className={`accordion-collapse collapse ${open === 'common' ? 'show' : ''}`}>
            <div className="accordion-body small">
              <h6 className="fw-semibold">{t('Provide simple troubleshooting instructions for:')}</h6>
              <ul className="mb-2">
                <li>{t('Page not loading')}</li>
                <li>{t('Login problem')}</li>
                <li>{t('Data not appearing')}</li>
                <li>{t('Password reset problem')}</li>
                <li>{t('Slow response')}</li>
                <li>{t('Browser-related issues')}</li>
              </ul>
              <h6 className="fw-semibold">{t('Suggested basic steps:')}</h6>
              <ol className="mb-2">
                <li>{t('1. Refresh the page.')}</li>
                <li>{t('2. Check the internet connection if required.')}</li>
                <li>{t('3. Log out and log in again.')}</li>
                <li>{t('4. Try a supported browser.')}</li>
                <li>{t('5. If the problem continues, contact the project administrator/support team.')}</li>
              </ol>
              <div className="alert alert-warning mb-0 py-2">
                {t('If the problem continues, contact the project administrator/support team.')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body text-center">
          <p className="small text-muted mb-2">{t('Still need help? Contact the project administrator/support team.')}</p>
          <div className={user ? 'd-flex gap-2 justify-content-between flex-wrap' : 'd-flex gap-2 justify-content-center flex-wrap'}>
            {user ? (
              <>
                <Link to="/about" className="btn btn-outline-success btn-sm">&larr; {t('Back')}</Link>
                <Link to={user.is_superuser ? '/admin/dashboard' : '/'} className="btn btn-success btn-sm">{t('Go to Dashboard')}</Link>
                <Link to="/faq" className="btn btn-success btn-sm">{t('Next')} &rarr;</Link>
              </>
            ) : (
              <>
                <Link to="/about" className="btn btn-outline-success btn-sm">&larr; {t('Back')}</Link>
                <Link to="/" className="btn btn-outline-success btn-sm">{t('Back to Home')}</Link>
                <Link to="/login" className="btn btn-success btn-sm">{t('Go to Login')}</Link>
                <Link to="/" className="btn btn-outline-success btn-sm">{t('Go to Dashboard')}</Link>
                <Link to="/faq" className="btn btn-success btn-sm">{t('Next')}</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
