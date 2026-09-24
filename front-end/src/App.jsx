import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { AiNotesProvider } from './contexts/AiNotesContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FeatureErrorFallback } from './components/FeatureErrorFallback';

// Code-split page components for optimized bundle performance
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const FeedPage = lazy(() => import('./pages/FeedPage'));
const GroupsPage = lazy(() => import('./pages/GroupsPage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const NotesPage = lazy(() => import('./pages/NotesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-histo-dark flex flex-col items-center justify-center text-histo-gold font-ui text-sm space-y-3">
      <div className="w-8 h-8 border-2 border-histo-gold/30 border-t-histo-gold rounded-full animate-spin" />
      <span className="tracking-widest uppercase text-xs text-histo-gold/80">Loading HistoFacts...</span>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <PageLoader />;
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
    return <PageLoader />;
  }
  if (user) {
    return <Navigate to="/home" replace />;
  }
  return children;
}

/**
 * FeatureBoundary — thin wrapper that renders an ErrorBoundary with the
 * HistoFacts-themed fallback card for a named feature route.
 */
function FeatureBoundary({ featureName, children }) {
  return (
    <ErrorBoundary
      featureName={featureName}
      fallback={({ error, resetError }) => (
        <FeatureErrorFallback
          featureName={featureName}
          error={error}
          resetError={resetError}
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AiNotesProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public-only auth routes */}
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

              {/* Protected app routes inside MainLayout */}
              <Route
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route
                  path="/home"
                  element={
                    <FeatureBoundary featureName="Home Dashboard">
                      <DashboardPage />
                    </FeatureBoundary>
                  }
                />
                <Route
                  path="/quiz"
                  element={
                    <FeatureBoundary featureName="Interactive Quizzes">
                      <QuizPage />
                    </FeatureBoundary>
                  }
                />
                <Route
                  path="/feed"
                  element={
                    <FeatureBoundary featureName="Community Forum">
                      <FeedPage />
                    </FeatureBoundary>
                  }
                />
                <Route
                  path="/groups"
                  element={
                    <FeatureBoundary featureName="Study Groups">
                      <GroupsPage />
                    </FeatureBoundary>
                  }
                />
                <Route
                  path="/friends"
                  element={
                    <FeatureBoundary featureName="Friends & Classmates">
                      <FriendsPage />
                    </FeatureBoundary>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <FeatureBoundary featureName="Settings">
                      <SettingsPage />
                    </FeatureBoundary>
                  }
                />
                <Route
                  path="/notes"
                  element={
                    <FeatureBoundary featureName="AI Study Notes">
                      <NotesPage />
                    </FeatureBoundary>
                  }
                />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AiNotesProvider>
      </AuthProvider>
    </ToastProvider>
  );
}