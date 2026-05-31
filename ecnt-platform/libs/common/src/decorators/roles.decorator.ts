import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../constants/roles';

export const ROLES_KEY = 'roles';

/**
 * Decorator to restrict route access to specific user roles.
 * @example @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATOR)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
