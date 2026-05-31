import React, { Suspense, lazy } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/auth/LoginPage';

const FleetDashboard   = lazy(() => import('./pages/dashboard/FleetDashboard'));
const FleetVehiclesPage = lazy(() => import('./pages/vehicles/FleetVehiclesPage'));
const DriversPage       = lazy(() => import('./pages/drivers/DriversPage'));
const FleetSessionsPage = lazy(() => import('./pages/sessions/FleetSessionsPage'));
const FleetBillingPage  = lazy(() => import('./pages/billing/FleetBillingPage'));
const ReportsPage       = lazy(() => import('./pages/reports/ReportsPage'));
const SettingsPage      = lazy(() => import('./pages/settings/SettingsPage'));

const Spinner = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
  </div>
);

const isAuthenticated = () => !!localStorage.getItem('fleet_token');

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <Suspense fallback={<Spinner />}>
                <FleetDashboard />
              </Suspense>
            }
          />
          <Route
            path="vehicles"
            element={
              <Suspense fallback={<Spinner />}>
                <FleetVehiclesPage />
              </Suspense>
            }
          />
          <Route
            path="drivers"
            element={
              <Suspense fallback={<Spinner />}>
                <DriversPage />
              </Suspense>
            }
          />
          <Route
            path="sessions"
            element={
              <Suspense fallback={<Spinner />}>
                <FleetSessionsPage />
              </Suspense>
            }
          />
          <Route
            path="billing"
            element={
              <Suspense fallback={<Spinner />}>
                <FleetBillingPage />
              </Suspense>
            }
          />
          <Route
            path="reports"
            element={
              <Suspense fallback={<Spinner />}>
                <ReportsPage />
              </Suspense>
            }
          />
          <Route
            path="settings"
            element={
              <Suspense fallback={<Spinner />}>
                <SettingsPage />
              </Suspense>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
