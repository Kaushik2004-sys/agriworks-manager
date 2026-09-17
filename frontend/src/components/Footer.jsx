// Site footer: clean, professional, matches the green navbar styling.
// Shows the same logo asset as the navbar, centered above the content.
// Sticks to the bottom via flex layout (never overlaps content) and wraps
// cleanly on split-screen, tablet and mobile.
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/farmers', label: 'Farmers' },
  { to: '/works', label: 'Work' },
  { to: '/bills', label: 'Bills' },
  { to: '/payments', label: 'Payments' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/reports', label: 'Reports' },
];

const INFO_LINKS = [
  { to: '/about', label: 'About AgriWorks' },
  { to: '/help-support', label: 'Help & Support' },
  { to: '/faq', label: 'FAQ' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms & Conditions' },
  { to: '/disclaimer', label: 'Disclaimer' },
  { to: '/contact-support', label: 'Contact & Report Problem' },
];

export default function Footer() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isSuperuser = !!user?.is_superuser;
  // Superusers never see operational links or Contact & Report Problem,
  // on any page. Normal users always keep the full footer.
  const showOperationalLinks = !isSuperuser;
  const infoLinks = !isSuperuser
    ? INFO_LINKS
    : INFO_LINKS.filter((l) => l.to !== '/contact-support');
  return (
    <footer className="bg-success text-white mt-auto d-print-none">
      <div className="container py-4">
        <div className="text-center mb-3">
          <img src="/logo.png" alt="AgriWorks logo" className="footer-logo" />
        </div>
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <h5 className="fw-bold mb-1">AgriWorks Manager</h5>
            <p className="mb-1 small">{t('Smart Farm Work & Irrigation Management System')}</p>
            <p className="mb-0 small opacity-75">{t('Developed for Agricultural Service Management')}</p>
          </div>
          <div className="col-12 col-md-6">
            {showOperationalLinks && (
              <div className="d-flex flex-wrap gap-2 gap-md-3 justify-content-md-end">
                {LINKS.map((l) => (
                  <Link key={l.to} className="text-white text-decoration-none small" to={l.to}>
                    {t(l.label)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="footer-info-links d-flex flex-wrap justify-content-md-end mt-2">
          {infoLinks.map((l, i) => (
            <span key={l.to} className="text-nowrap">
              {i > 0 && (
                <span className="text-white-50 mx-2" aria-hidden="true">
                  |
                </span>
              )}
              <Link className="text-white text-decoration-none small" to={l.to}>
                {t(l.label)}
              </Link>
            </span>
          ))}
        </div>
        <hr className="my-3 border-light" />
        <p className="text-center small mb-0">
          {t('© 2026 AgriWorks Manager. All Rights Reserved.')}
        </p>
      </div>
    </footer>
  );
}
