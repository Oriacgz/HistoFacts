import React, { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

// Code-split page components for optimized bundle performance
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const FeedPage = lazy(() => import('./pages/FeedPage'));
const GroupsPage = lazy(() => import('./pages/GroupsPage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const NotesPage = lazy(() => import('./pages/NotesPage'));

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

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
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
        </Suspense>
      </AuthProvider>
    </ToastProvider>
  );
}