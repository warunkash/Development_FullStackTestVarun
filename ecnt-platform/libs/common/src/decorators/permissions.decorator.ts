import { SetMetadata } from '@nestjs/common';
import { Permission } from '../constants/roles';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to restrict route access to users with specific permissions.
 * @example @RequirePermissions(Permission.CHARGING_START)
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
