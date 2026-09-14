// Phase 2: Routes with protected pages.
// /login, /signup, /forgot-password, /reset-password are public;
// /, /farmers, /works, /bills, /payments, /expenses, /reports, /profile are protected.
// Phase 10: full flow Login > Dashboard > Farmers > Work > Bills > Payments > Expenses > Reports > Logout.
// Auth update: public signup + backend-driven password reset.
// Profile Management: protected /profile page.
import { Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import AppNavbar from './components/AppNavbar';
import AdminRoute from './components/AdminRoute';
import NotFound from './components/NotFound';
import ProtectedRoute from './components/ProtectedRoute';
import About from './pages/About';
import AdminDashboard from './pages/AdminDashboard';
import AdminLoginHistory from './pages/AdminLoginHistory';
import AdminProblemReports from './pages/AdminProblemReports';
import Bills from './pages/Bills';
import ContactSupport from './pages/ContactSupport';
import Dashboard from './pages/Dashboard';
import DashboardExpenses from './pages/DashboardExpenses';
import DashboardFarmers from './pages/DashboardFarmers';
import DashboardIncome from './pages/DashboardIncome';
import DashboardPayments from './pages/DashboardPayments';
import DashboardPending from './pages/DashboardPending';
import DashboardWorks from './pages/DashboardWorks';
import Disclaimer from './pages/Disclaimer';
import Expenses from './pages/Expenses';
import FAQ from './pages/FAQ';
import Farmers from './pages/Farmers';
import Footer from './components/Footer';
import { useAuth } from './context/AuthContext';
import ForgotPassword from './pages/ForgotPassword';
import HelpSupport from './pages/HelpSupport';
import Login from './pages/Login';
import Payments from './pages/Payments';
import Privacy from './pages/Privacy';
import Profile from './pages/Profile';
import Reports from './pages/Reports';
import ResetPassword from './pages/ResetPassword';
import Signup from './pages/Signup';
import Terms from './pages/Terms';
import Works from './pages/Works';

// Home shows the Admin Dashboard to superusers and the normal
// business dashboard to everyone else (never the reverse).
function HomeRoute() {
  const { user } = useAuth();
  if (user?.is_superuser) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <Dashboard />;
}

function App() {
  return (
    <>
      <AppNavbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
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
          element={
            <ProtectedRoute>
              <ContactSupport />
            </ProtectedRoute>
          }
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
      <Footer />
    </>
  );
}

export default App;
