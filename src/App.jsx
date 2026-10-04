import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { purgeInvalidLocalRecords } from './db/localDb';
import { initRealtimeSubscriptions } from './services/realtimeService';
import LoginPage from './pages/LoginPage';
import QuotationListPage from './pages/QuotationListPage';

// Code-split secondary routes with React.lazy for instant initial mobile load
const CreateEditQuotationPage = lazy(() => import('./pages/CreateEditQuotationPage'));
const QuotationPreviewPage = lazy(() => import('./pages/QuotationPreviewPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const MaterialsPage = lazy(() => import('./pages/MaterialsPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));

function RouteLoadingFallback() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-[#0B1B3F] dark:text-white">
      <div className="w-8 h-8 border-3 border-[#2F6FED] border-t-transparent rounded-full animate-spin mb-3" />
      <p className="text-[13px] text-[#6B7280] dark:text-gray-400 font-medium">Loading...</p>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0B1220] flex flex-col items-center justify-center p-6 text-[#0B1B3F] dark:text-white">
        <div className="w-8 h-8 border-3 border-[#2F6FED] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-[13px] text-[#6B7280] dark:text-gray-400">Initializing Vishakha Quotation App...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  useEffect(() => {
    // 1. One-time migration: on app start, purge any local records whose id is not a valid UUID
    purgeInvalidLocalRecords();

    // 2. Start Supabase Realtime subscriptions to keep Dexie & UI in sync live across devices
    const cleanupRealtime = initRealtimeSubscriptions();
    return () => {
      cleanupRealtime?.();
    };
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <LoginPage />
                  </PublicRoute>
                }
              />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <QuotationListPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/materials"
                element={
                  <ProtectedRoute>
                    <MaterialsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/quotation/new"
                element={
                  <ProtectedRoute>
                    <CreateEditQuotationPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/quotation/:id"
                element={
                  <ProtectedRoute>
                    <QuotationPreviewPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/quotation/:id/edit"
                element={
                  <ProtectedRoute>
                    <CreateEditQuotationPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
