import { useAuthStore } from '@/store/auth.store';

const PERMISSIONS: Record<string, string[]> = {
  'stations:read': ['admin', 'operator', 'viewer'],
  'stations:write': ['admin', 'operator'],
  'stations:delete': ['admin'],
  'chargers:read': ['admin', 'operator', 'viewer'],
  'chargers:write': ['admin', 'operator'],
  'sessions:read': ['admin', 'operator', 'viewer'],
  'sessions:write': ['admin', 'operator'],
  'users:read': ['admin', 'operator'],
  'users:write': ['admin'],
  'payments:read': ['admin', 'finance', 'viewer'],
  'payments:refund': ['admin', 'finance'],
  'analytics:read': ['admin', 'operator', 'finance', 'viewer'],
  'fleet:read': ['admin', 'operator'],
  'fleet:write': ['admin'],
  'franchise:read': ['admin'],
  'franchise:write': ['admin'],
  'maintenance:read': ['admin', 'operator', 'technician'],
  'maintenance:write': ['admin', 'operator', 'technician'],
  'settings:read': ['admin'],
  'settings:write': ['admin'],
};

export function usePermissions() {
  const { user } = useAuthStore();
  const roles = user?.roles ?? [];

  const hasPermission = (permission: string): boolean => {
    const allowedRoles = PERMISSIONS[permission] ?? [];
    return roles.some((role) => allowedRoles.includes(role));
  };

  const hasRole = (role: string): boolean => roles.includes(role);
  const isAdmin = hasRole('admin');

  return { hasPermission, hasRole, isAdmin, roles };
}
