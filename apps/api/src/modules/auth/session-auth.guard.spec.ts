import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SessionService } from './session.service.js';
import { SessionAuthGuard } from './session-auth.guard.js';
import { SESSION_COOKIE_NAME } from './auth.constants.js';
import type { AuthenticatedRequest } from './auth.types.js';

describe('SessionAuthGuard', () => {
  const sessions = { findActive: vi.fn() };
  const guard = new SessionAuthGuard(sessions as unknown as SessionService);
  const request: AuthenticatedRequest = { cookies: {} };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    request.cookies = {};
    delete request.authUser;
  });

  it('rejects requests without a session cookie', async () => {
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(sessions.findActive).not.toHaveBeenCalled();
  });

  it('rejects expired, revoked, or otherwise inactive sessions', async () => {
    request.cookies = { [SESSION_COOKIE_NAME]: 'opaque-token' };
    sessions.findActive.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('attaches only the selected user profile for an active session', async () => {
    const user = {
      id: 'user-id',
      email: 'user@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
    };
    request.cookies = { [SESSION_COOKIE_NAME]: 'opaque-token' };
    sessions.findActive.mockResolvedValue({ user });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.authUser).toEqual(user);
    expect(sessions.findActive).toHaveBeenCalledWith('opaque-token');
  });
});
