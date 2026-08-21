import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import QuizPage from './pages/QuizPage';
import FeedPage from './pages/FeedPage';
import GroupsPage from './pages/GroupsPage';
import FriendsPage from './pages/FriendsPage';
import NotesPage from './pages/NotesPage';
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

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          {/* Default entry point — if unauthenticated, ProtectedRoute redirects to /loginpg */}
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route
            path="/loginpg"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quiz"
            element={
              <ProtectedRoute>
                <QuizPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/feed"
            element={
              <ProtectedRoute>
                <FeedPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/groups"
            element={
              <ProtectedRoute>
                <GroupsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/friends"
            element={
              <ProtectedRoute>
                <FriendsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notes"
            element={
              <ProtectedRoute>
                <NotesPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}