import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import Layout from '@/components/layout/Layout';
import LoginPage from '@/pages/auth/LoginPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import StationsPage from '@/pages/stations/StationsPage';
import StationDetailPage from '@/pages/stations/StationDetailPage';
import ChargersPage from '@/pages/chargers/ChargersPage';
import SessionsPage from '@/pages/sessions/SessionsPage';
import UsersPage from '@/pages/users/UsersPage';
import UserDetailPage from '@/pages/users/UserDetailPage';
import PaymentsPage from '@/pages/payments/PaymentsPage';
import AnalyticsPage from '@/pages/analytics/AnalyticsPage';
import FleetPage from '@/pages/fleet/FleetPage';
import FleetDetailPage from '@/pages/fleet/FleetDetailPage';
import FranchisePage from '@/pages/franchise/FranchisePage';
import MaintenancePage from '@/pages/maintenance/MaintenancePage';
import SettingsPage from '@/pages/settings/SettingsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="stations" element={<StationsPage />} />
        <Route path="stations/:id" element={<StationDetailPage />} />
        <Route path="chargers" element={<ChargersPage />} />
        <Route path="sessions" element={<SessionsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:id" element={<UserDetailPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="fleet" element={<FleetPage />} />
        <Route path="fleet/:id" element={<FleetDetailPage />} />
        <Route path="franchise" element={<FranchisePage />} />
        <Route path="maintenance" element={<MaintenancePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
