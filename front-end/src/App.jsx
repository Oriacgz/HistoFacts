import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import QuizPage from './pages/QuizPage';
import FeedPage from './pages/FeedPage';
import GroupsPage from './pages/GroupsPage';
import FriendsPage from './pages/FriendsPage';
import NotesPage from './pages/NotesPage';
import LandingPage from './pages/LandingPage';
import MainLayout from './components/MainLayout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-histo-dark flex items-center justify-center text-histo-gold font-ui text-sm">
        Loading HistoFacts...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/loginpg" replace />;
  }
  return children;
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    return <Navigate to="/home" replace />;
  }
  return children;
}

function LandingRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-histo-dark flex items-center justify-center text-histo-gold font-ui text-sm">
        Loading HistoFacts...
      </div>
    );
  }
  if (user) {
    return <Navigate to="/home" replace />;
  }
  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          {/* Public landing page - redirects authenticated users to /home */}
          <Route
            path="/"
            element={
              <LandingRoute>
                <LandingPage />
              </LandingRoute>
            }
          />
          <Route
            path="/loginpg"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />

          {/* 
            Protected routes inside MainLayout.
            MainLayout renders the persistent Navbar + <Outlet />.
            When switching between these routes, only the Outlet content
            re-renders — the Navbar stays mounted (no page reload flicker).
          */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/home" element={<DashboardPage />} />
            <Route path="/quiz" element={<QuizPage />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/friends" element={<FriendsPage />} />
          </Route>

          {/* Notes has its own specialized layout/navbar */}
          <Route
            path="/notes"
            element={
              <ProtectedRoute>
                <NotesPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}