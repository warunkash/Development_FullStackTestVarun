export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  OPERATOR = 'operator',
  TECHNICIAN = 'technician',
  FRANCHISEE = 'franchisee',
  CUSTOMER = 'customer',
  FLEET_MANAGER = 'fleet_manager',
  FINANCE_MANAGER = 'finance_manager',
  AUDITOR = 'auditor',
}

export enum Permission {
  // User permissions
  USER_READ = 'user:read',
  USER_WRITE = 'user:write',
  USER_DELETE = 'user:delete',
  // Station permissions
  STATION_READ = 'station:read',
  STATION_WRITE = 'station:write',
  STATION_DELETE = 'station:delete',
  // Charging permissions
  CHARGING_READ = 'charging:read',
  CHARGING_START = 'charging:start',
  CHARGING_STOP = 'charging:stop',
  CHARGING_MANAGE = 'charging:manage',
  // Payment permissions
  PAYMENT_READ = 'payment:read',
  PAYMENT_PROCESS = 'payment:process',
  PAYMENT_REFUND = 'payment:refund',
  // Analytics permissions
  ANALYTICS_READ = 'analytics:read',
  ANALYTICS_EXPORT = 'analytics:export',
  // Fleet permissions
  FLEET_READ = 'fleet:read',
  FLEET_MANAGE = 'fleet:manage',
  // Franchise permissions
  FRANCHISE_READ = 'franchise:read',
  FRANCHISE_MANAGE = 'franchise:manage',
  // Maintenance permissions
  MAINTENANCE_READ = 'maintenance:read',
  MAINTENANCE_WRITE = 'maintenance:write',
  // System permissions
  SYSTEM_SETTINGS = 'system:settings',
  AUDIT_READ = 'audit:read',
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission),
  [UserRole.OPERATOR]: [
    Permission.USER_READ,
    Permission.STATION_READ,
    Permission.STATION_WRITE,
    Permission.CHARGING_READ,
    Permission.CHARGING_MANAGE,
    Permission.PAYMENT_READ,
    Permission.ANALYTICS_READ,
    Permission.ANALYTICS_EXPORT,
    Permission.MAINTENANCE_READ,
    Permission.MAINTENANCE_WRITE,
  ],
  [UserRole.TECHNICIAN]: [
    Permission.STATION_READ,
    Permission.CHARGING_READ,
    Permission.MAINTENANCE_READ,
    Permission.MAINTENANCE_WRITE,
  ],
  [UserRole.FRANCHISEE]: [
    Permission.STATION_READ,
    Permission.CHARGING_READ,
    Permission.ANALYTICS_READ,
    Permission.PAYMENT_READ,
    Permission.FRANCHISE_READ,
  ],
  [UserRole.CUSTOMER]: [
    Permission.CHARGING_READ,
    Permission.CHARGING_START,
    Permission.CHARGING_STOP,
    Permission.PAYMENT_READ,
    Permission.PAYMENT_PROCESS,
  ],
  [UserRole.FLEET_MANAGER]: [
    Permission.FLEET_READ,
    Permission.FLEET_MANAGE,
    Permission.CHARGING_READ,
    Permission.PAYMENT_READ,
    Permission.ANALYTICS_READ,
  ],
  [UserRole.FINANCE_MANAGER]: [
    Permission.PAYMENT_READ,
    Permission.PAYMENT_REFUND,
    Permission.ANALYTICS_READ,
    Permission.ANALYTICS_EXPORT,
    Permission.AUDIT_READ,
  ],
  [UserRole.AUDITOR]: [
    Permission.AUDIT_READ,
    Permission.ANALYTICS_READ,
    Permission.PAYMENT_READ,
  ],
};
