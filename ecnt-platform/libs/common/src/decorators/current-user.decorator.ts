import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  phone?: string;
  roles: string[];
  permissions: string[];
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser extends JwtPayload {
  id: string;
}

/**
 * Parameter decorator to extract the current authenticated user from the request.
 * @example getCurrentUser(@CurrentUser() user: AuthenticatedUser)
 * @example getCurrentUser(@CurrentUser('id') userId: string)
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      return null;
    }

    // Map sub to id for convenience
    user.id = user.sub;

    if (data) {
      return user[data];
    }

    return user;
  },
);
