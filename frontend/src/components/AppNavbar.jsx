// Top navbar: collapses to a hamburger menu below the lg breakpoint so all
// items stay visible on split-screen, tablet and mobile (no page overflow).
// Includes the language selector (English / Hindi / Marathi).
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export default function AppNavbar() {
  const { user, logout } = useAuth();
  const { t, lang, setLang, LANGUAGES } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
  }

  async function handleLogout() {
    await logout();
    close();
    navigate('/login');
  }

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-success mb-3">
      <div className="container">
        <Link className="navbar-brand fw-bold d-flex align-items-center gap-2" to="/" onClick={close}>
          <img src="/logo.png" alt="AgriWorks logo" className="navbar-logo" />
          AgriWorks
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className={`collapse navbar-collapse${open ? ' show' : ''}`}>
          {user && (
            <div className="navbar-nav me-auto">
              <Link className="nav-link" to="/" onClick={close}>{t('Home')}</Link>
              <Link className="nav-link" to="/farmers" onClick={close}>{t('Farmers')}</Link>
              <Link className="nav-link" to="/works" onClick={close}>{t('Work')}</Link>
              <Link className="nav-link" to="/bills" onClick={close}>{t('Bills')}</Link>
              <Link className="nav-link" to="/payments" onClick={close}>{t('Payments')}</Link>
              <Link className="nav-link" to="/expenses" onClick={close}>{t('Expenses')}</Link>
              <Link className="nav-link" to="/reports" onClick={close}>{t('Reports')}</Link>
            </div>
          )}
          <div className="navbar-nav ms-auto align-items-lg-center">
            <select
              className="form-select form-select-sm my-2 my-lg-0 me-lg-2"
              style={{ width: 'auto' }}
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              aria-label="Language"
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
