// Phase 2: Routes with protected pages.
// /login, /signup, /forgot-password, /reset-password are public;
// /, /farmers, /works, /bills, /payments, /expenses, /reports, /profile are protected.
// Phase 10: full flow Login > Dashboard > Farmers > Work > Bills > Payments > Expenses > Reports > Logout.
// Auth update: public signup + backend-driven password reset.
// Profile Management: protected /profile page.
import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import './App.css';
import AppNavbar from './components/AppNavbar';
import AdminRoute from './components/AdminRoute';
import NotFound from './components/NotFound';
import ProtectedRoute from './components/ProtectedRoute';
import Footer from './components/Footer';
import { useAuth } from './context/AuthContext';
import { useLanguage } from './i18n/LanguageContext';
// P14: route-level code splitting - each page loads on demand instead of
// inflating the initial bundle. Shell (navbar, guards, footer) stays eager.
const About = lazy(() => import('./pages/About'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminLoginHistory = lazy(() => import('./pages/AdminLoginHistory'));
const AdminProblemReports = lazy(() => import('./pages/AdminProblemReports'));
const Bills = lazy(() => import('./pages/Bills'));
const ContactSupport = lazy(() => import('./pages/ContactSupport'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DashboardExpenses = lazy(() => import('./pages/DashboardExpenses'));
const DashboardFarmers = lazy(() => import('./pages/DashboardFarmers'));
const DashboardIncome = lazy(() => import('./pages/DashboardIncome'));
const DashboardPayments = lazy(() => import('./pages/DashboardPayments'));
const DashboardPending = lazy(() => import('./pages/DashboardPending'));
const DashboardWorks = lazy(() => import('./pages/DashboardWorks'));
const Disclaimer = lazy(() => import('./pages/Disclaimer'));
const Expenses = lazy(() => import('./pages/Expenses'));
const FAQ = lazy(() => import('./pages/FAQ'));
const Farmers = lazy(() => import('./pages/Farmers'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const HelpSupport = lazy(() => import('./pages/HelpSupport'));
const Login = lazy(() => import('./pages/Login'));
const Payments = lazy(() => import('./pages/Payments'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Profile = lazy(() => import('./pages/Profile'));
const Reports = lazy(() => import('./pages/Reports'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Signup = lazy(() => import('./pages/Signup'));
const Terms = lazy(() => import('./pages/Terms'));
const Works = lazy(() => import('./pages/Works'));

// Home shows the Admin Dashboard to superusers and the normal
// business dashboard to everyone else (never the reverse).
function HomeRoute() {
  const { user } = useAuth();
  if (user?.is_superuser) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <Dashboard />;
}

// Already-authenticated users visiting /login or /signup are sent Home
// with history replacement, so auth pages never linger behind a session.
// If a stale token is stored but the session could not be verified
// (backend unreachable), the auth form is still shown: a non-blocking
// warning with Retry is displayed on top, plus an option to discard the
// stale saved session. The login/signup page must never be replaced by
// a dead-end error screen.
function GuestRoute({ children }) {
  const { user, token, loading, authError, revalidate, logout } = useAuth();
  const { t } = useLanguage();
  if (loading) {
    return <div className="container py-4 text-muted" role="status">{t('Loading...')}</div>;
  }
  // Live storage check mirrors the route guards: a stale in-memory session
  // (token already cleared) must still render the auth form. Without this,
  // GuestRoute and the guards could bounce against each other.
  if (user && token && localStorage.getItem('agriworks_token')) {
    return <Navigate to="/" replace />;
  }
  if (token && authError === 'network') {
    return (
      <div className="container py-4">
        <div className="alert alert-warning">{t('Could not verify your session. Please check your connection and retry.')}</div>
        <div className="d-flex gap-2 flex-wrap mb-3">
          <button className="btn btn-success" type="button" onClick={() => revalidate()}>
            {t('Retry')}
          </button>
          <button className="btn btn-outline-secondary" type="button" onClick={() => logout()}>
            {t('Clear saved login')}
          </button>
        </div>
        {children}
      </div>
    );
  }
  return children;
}

// Post-login history collapse (no popstate interception, no fake entries).
// A single replace on login can only drop the top entry, so a pre-login
// chain like About -> FAQ -> Login would survive behind Dashboard. Instead,
// login sets a session flag; while it is set, any BACK/FORWARD (POP)
// traversal landing on a pre-login public/auth page bounces forward to the
// dashboard via replace (which also drops forward entries). The flag clears
// on the first PUSH navigation (user settled into the app) and on logout,
// so legitimate Back/Forward inside the app and deliberate public-page
// visits keep working normally.
const COLLAPSE_KEY = 'aw_post_login';
const PRE_AUTH_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/about',
  '/faq',
  '/privacy',
  '/terms',
  '/disclaimer',
  '/help-support',
  '/contact-support',
];

function CollapseStaleHistory() {
  const { user, token } = useAuth();
  const location = useLocation();
  const navType = useNavigationType();
  const navigate = useNavigate();
  const authed = !!(user && token);

  useEffect(() => {
    if (!authed) {
      sessionStorage.removeItem(COLLAPSE_KEY);
      return;
    }
    // Settle (disarm) only once the user pushes forward into the app itself.
    // A PUSH that merely re-renders the pre-login location (e.g. auth state
    // settling right after login, before the replace commits) must NOT
    // disarm, or the flag set by Login/Signup would be wiped instantly.
    if (navType === 'PUSH' && !PRE_AUTH_PATHS.includes(location.pathname)) {
      sessionStorage.removeItem(COLLAPSE_KEY);
      return;
    }
    if (
      navType === 'POP'
      && sessionStorage.getItem(COLLAPSE_KEY)
      && PRE_AUTH_PATHS.includes(location.pathname)
    ) {
      navigate(user.is_superuser ? '/admin/dashboard' : '/', { replace: true });
    }
  }, [authed, navType, location.pathname, navigate, user]);

  return null;
}

function App() {
  const { t } = useLanguage();
  return (
    <>
      <CollapseStaleHistory />
      <AppNavbar />
      <Suspense fallback={<div className="container py-4 text-muted">{t('Loading')}</div>}>
      <Routes>
        <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/about" element={<About />} />
        <Route path="/help-support" element={<HelpSupport />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/disclaimer" element={<Disclaimer />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomeRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="/farmers"
          element={
            <ProtectedRoute>
              <Farmers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/works"
          element={
            <ProtectedRoute>
              <Works />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bills"
          element={
            <ProtectedRoute>
              <Bills />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payments"
          element={
            <ProtectedRoute>
              <Payments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expenses"
          element={
            <ProtectedRoute>
              <Expenses />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/work-records"
          element={
            <ProtectedRoute>
              <DashboardWorks />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/income"
          element={
            <ProtectedRoute>
              <DashboardIncome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/payments"
          element={
            <ProtectedRoute>
              <DashboardPayments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/pending-payments"
          element={
            <ProtectedRoute>
              <DashboardPending />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/expenses"
          element={
            <ProtectedRoute>
              <DashboardExpenses />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/farmers"
          element={
            <ProtectedRoute>
              <DashboardFarmers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contact-support"
          element={<ContactSupport />}
        />
        <Route
          path="/admin/dashboard"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/problem-reports"
          element={
            <AdminRoute>
              <AdminProblemReports />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/login-history"
          element={
            <AdminRoute>
              <AdminLoginHistory />
            </AdminRoute>
          }
        />
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <NotFound />
            </ProtectedRoute>
          }
        />
      </Routes>
      </Suspense>
      <Footer />
    </>
  );
}

export default App;
