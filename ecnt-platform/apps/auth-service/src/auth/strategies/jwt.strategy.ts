import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  type: string;
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'ecnt-secret-key'),
      issuer: 'ecnt-auth-service',
      audience: 'ecnt-platform',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles || [],
      permissions: this.getRolePermissions(payload.roles || []),
    };
  }

  private getRolePermissions(roles: string[]): string[] {
    const rolePermissions: Record<string, string[]> = {
      admin: ['read:all', 'write:all', 'delete:all', 'manage:users'],
      operator: ['read:stations', 'write:sessions', 'manage:chargers'],
      user: ['read:own', 'write:own'],
    };

    return roles.flatMap((role) => rolePermissions[role] || []);
  }
}
