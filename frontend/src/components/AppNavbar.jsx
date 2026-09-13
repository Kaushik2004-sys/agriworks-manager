// Top navbar: collapses to a hamburger menu below the lg breakpoint so all
// items stay visible on split-screen, tablet and mobile (no page overflow).
// Includes the language selector (English / Hindi / Marathi).
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export default function AppNavbar() {
  const { user, logout } = useAuth();
  const { t, lang, setLang, LANGUAGES } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Main authenticated navigation links (Profile stays separate below).
  const NAV_LINKS = [
    { to: '/', label: 'Home' },
    { to: '/farmers', label: 'Farmers' },
    { to: '/works', label: 'Work' },
    { to: '/bills', label: 'Bills' },
    { to: '/payments', label: 'Payments' },
    { to: '/expenses', label: 'Expenses' },
    { to: '/reports', label: 'Reports' },
  ];

  function close() {
    setOpen(false);
  }

  async function handleLogout() {
    await logout();
    close();
    navigate('/login');
  }

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-success mb-3 sticky-top d-print-none">
      <div className="container">
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
            <div className="navbar-nav me-auto align-items-lg-center">
              {NAV_LINKS.map((l, i) => (
                <span key={l.to} className="d-flex align-items-center">
                  {i > 0 && (
                    <span className="d-none d-lg-inline text-white-50 px-1" aria-hidden="true">
                      |
                    </span>
                  )}
                  <Link className="nav-link" to={l.to} onClick={close}>{t(l.label)}</Link>
                </span>
              ))}
            </div>
          )}
          <div className="navbar-nav ms-auto align-items-lg-center">
            <button
              type="button"
              className="btn btn-outline-light btn-sm my-2 my-lg-0 me-lg-2"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t('Switch to Light Mode') : t('Switch to Dark Mode')}
              title={theme === 'dark' ? t('Switch to Light Mode') : t('Switch to Dark Mode')}
            >
              <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
            </button>
            <select
              className="form-select form-select-sm my-2 my-lg-0 me-lg-2"
              style={{ width: 'auto' }}
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
                <Link className="nav-link me-lg-2" to="/profile" onClick={close}>{t('Profile')}</Link>
                <span className="navbar-text me-lg-3">{t('Hi,')} {user.username}</span>
                <button className="btn btn-light btn-sm my-2 my-lg-0" onClick={handleLogout}>
                  {t('Logout')}
                </button>
              </>
            ) : (
              <Link className="btn btn-light btn-sm my-2 my-lg-0" to="/login" onClick={close}>{t('Login')}</Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
