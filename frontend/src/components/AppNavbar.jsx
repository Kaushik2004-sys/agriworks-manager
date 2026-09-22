// Top navbar: single clean row on desktop (xl and up); hamburger menu
// below that so tablet/narrow widths never wrap links onto a second row.
// Includes the language selector (English / Hindi / Marathi).
import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export default function AppNavbar() {
  const { user, logout } = useAuth();
  const { t, lang, setLang, LANGUAGES } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Main authenticated navigation links (Profile stays separate below).
  // Superusers see admin links instead of the operational links.
  const NAV_LINKS = [
    { to: '/', label: 'Home' },
    { to: '/farmers', label: 'Farmers' },
    { to: '/works', label: 'Work' },
    { to: '/bills', label: 'Bills' },
    { to: '/payments', label: 'Payments' },
    { to: '/expenses', label: 'Expenses' },
    { to: '/reports', label: 'Reports' },
    { to: '/contact-support', label: 'Contact & Report Problem' },
  ];

  const ADMIN_LINKS = [
    { to: '/admin/dashboard', label: 'Admin Dashboard' },
    { to: '/admin/problem-reports', label: 'Problem Reports' },
    { to: '/admin/login-history', label: 'Login History' },
  ];

  function close() {
    setOpen(false);
  }

  async function handleLogout() {
    await logout();
    close();
    // Replace: Back after logout must not reopen authenticated pages.
    navigate('/login', { replace: true });
  }

  // Bottom mobile nav: only the most-used modules; the rest stay in the
  // top menu + footer. Same routes, same guards — presentation only.
  const BOTTOM_NAV = [
    { to: '/', label: 'Home', icon: '🏠' },
    { to: '/farmers', label: 'Farmers', icon: '👨‍🌾' },
    { to: '/works', label: 'Work', icon: '🚜' },
    { to: '/bills', label: 'Bills', icon: '🧾' },
    { to: '/payments', label: 'Payments', icon: '💰' },
    { to: '/profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <>
    <nav className="navbar navbar-expand-xl navbar-dark bg-success mb-3 sticky-top d-print-none aw-topnav">
      <div className="container aw-topnav-inner">
        <Link className="navbar-brand fw-bold d-flex align-items-center gap-2" to="/" onClick={close}>
          <img src="/logo.png" alt="AgriWorks logo" className="navbar-logo" />
          AgriWorks
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          aria-label={t('Toggle navigation')}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className={`collapse navbar-collapse${open ? ' show' : ''}`}>
          {user && (
            <nav className="navbar-nav me-auto aw-topnav-links" aria-label={t('Main sections')}>
              {(user.is_superuser ? ADMIN_LINKS : NAV_LINKS).map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === '/'}
                  onClick={close}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  {t(l.label)}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="navbar-nav ms-auto aw-topnav-controls">
            <button
              type="button"
              className="btn btn-outline-light btn-sm my-2 my-xl-0 flex-shrink-0"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t('Switch to Light Mode') : t('Switch to Dark Mode')}
              title={theme === 'dark' ? t('Switch to Light Mode') : t('Switch to Dark Mode')}
            >
              <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
            </button>
            <select
              className="form-select form-select-sm my-2 my-xl-0 flex-shrink-0 aw-lang-select"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              aria-label={t('Language')}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            {user ? (
              <>
                <NavLink className={({ isActive }) => `nav-link flex-shrink-0${isActive ? ' active' : ''}`} to="/profile" onClick={close}>{t('Profile')}</NavLink>
                <span className="navbar-text text-nowrap text-truncate aw-greeting">{t('Hi,')} {user.profile?.full_name || ''}</span>
                <button className="btn btn-light btn-sm my-2 my-xl-0 flex-shrink-0" onClick={handleLogout}>
                  {t('Logout')}
                </button>
              </>
            ) : (
              <Link className="btn btn-light btn-sm my-2 my-xl-0" to="/login" onClick={close}>{t('Login')}</Link>
            )}
          </div>
        </div>
      </div>
    </nav>
    {user && !user.is_superuser && (
      <nav className="aw-bottom-nav d-print-none" aria-label={t('Main sections')}>
        {BOTTOM_NAV.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            onClick={close}
            className={location.pathname === l.to ? 'aw-active' : undefined}
            aria-current={location.pathname === l.to ? 'page' : undefined}
          >
            <span aria-hidden="true">{l.icon}</span>
            <span>{t(l.label)}</span>
          </Link>
        ))}
      </nav>
    )}
    </>
  );
}
