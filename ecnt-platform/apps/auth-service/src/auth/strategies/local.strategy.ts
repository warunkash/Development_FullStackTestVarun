import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'emailOrPhone',
      passwordField: 'password',
    });
  }

  async validate(emailOrPhone: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(emailOrPhone, password);
    if (!user) {
      throw new UnauthorizedException('Invalid email/phone or password');
    }
    return user;
  }
}
