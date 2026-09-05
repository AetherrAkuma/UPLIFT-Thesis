import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AccessibilityProvider } from './context/AccessibilityContext';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import JobDetails from './pages/JobDetails';
import ApplyPage from './pages/ApplyPage';
import Applications from './pages/Applications';
import EmployerPortal from './pages/EmployerPortal';
import Jobs from './pages/Jobs';
import AdminPortal from './pages/AdminPortal';
import EmployerLanding from './pages/EmployerLanding';
import EmployerLogin from './pages/EmployerLogin';
import EmployerOnboarding from './pages/EmployerOnboarding';
import Layout from './components/Layout';
import { ToastProvider } from './context/ToastContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" />;
  
  return children;
};

const AuthRedirectHandler = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.role === 'user') {
      const redirectTo = sessionStorage.getItem('redirect_after_login');
      if (redirectTo) {
        sessionStorage.removeItem('redirect_after_login');
        navigate(redirectTo);
      }
    }
  }, [user, navigate]);

  return null;
};

const AppContent = () => {
  const { user } = useAuth();

  return (
    <Router>
      <AuthRedirectHandler />
      <Layout>
        <Routes>
          <Route 
            path="/" 
            element={
              !user ? <Landing /> : 
              user.role === 'user' ? <Navigate to="/dashboard" /> :
              user.role === 'employer' ? <Navigate to="/employer" /> :
              <Navigate to="/admin" />
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['user']}>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute allowedRoles={['user']}>
                <Profile />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/jobs" 
            element={<Jobs />} 
          />
          <Route 
            path="/job/:id" 
            element={<JobDetails />} 
          />
          <Route 
            path="/apply/:id" 
            element={
              <ProtectedRoute allowedRoles={['user']}>
                <ApplyPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/applications" 
            element={
              <ProtectedRoute allowedRoles={['user']}>
                <Applications />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/employer" 
            element={
              <ProtectedRoute allowedRoles={['employer']}>
                <EmployerPortal />
              </ProtectedRoute>
            } 
          />
          <Route path="/employer/welcome" element={<EmployerLanding />} />
          <Route path="/employer/login" element={<EmployerLogin />} />
          <Route path="/employer/register" element={<EmployerOnboarding />} />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminPortal />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Layout>
    </Router>
  );
};

function App() {
  return (
    <AuthProvider>
      <AccessibilityProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AccessibilityProvider>
    </AuthProvider>
  );
}

export default App;
