import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SessionService } from './session.service.js';
import { SESSION_COOKIE_NAME } from './auth.constants.js';
import type { AuthenticatedRequest } from './auth.types.js';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[SESSION_COOKIE_NAME];
    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException();
    }

    const session = await this.sessions.findActive(token);
    if (!session) {
      throw new UnauthorizedException();
    }

    request.authUser = session.user;
    return true;
  }
}
