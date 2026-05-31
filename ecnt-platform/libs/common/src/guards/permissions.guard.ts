import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission } from '../constants/roles';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { Request } from 'express';

/**
 * Guard that checks if the authenticated user has the required permissions.
 * Must be used after JwtAuthGuard.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const hasAllPermissions = requiredPermissions.every((permission) =>
      user.permissions?.includes(permission),
    );

    if (!hasAllPermissions) {
      const missingPermissions = requiredPermissions.filter(
        (p) => !user.permissions?.includes(p),
      );
      throw new ForbiddenException(
        `Access denied. Missing permissions: ${missingPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
