import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { SESSION_COOKIE_NAME } from './auth.constants.js';
import { SessionService } from './session.service.js';
import { PasswordResetService } from './password-reset.service.js';

describe('AuthController', () => {
  const authMocks = { authenticate: vi.fn(), register: vi.fn() };
  const sessionMocks = { revoke: vi.fn(), rotate: vi.fn() };
  const configMocks = { get: vi.fn() };
  const passwordResetMocks = { resetPassword: vi.fn(), requestReset: vi.fn() };
  const authService = authMocks as unknown as AuthService;
  const sessionService = sessionMocks as unknown as SessionService;
  const config = configMocks as unknown as ConfigService;
  const passwordResetService = passwordResetMocks as unknown as PasswordResetService;
  const response = { cookie: vi.fn(), clearCookie: vi.fn() };
  const controller = new AuthController(authService, sessionService, passwordResetService, config);

  beforeEach(() => {
    vi.clearAllMocks();
  });


  it('sets an HttpOnly SameSite cookie without returning the token in JSON', async () => {
    const expiresAt = new Date('2026-12-01T00:00:00.000Z');
    authMocks.authenticate.mockResolvedValue({
      userId: 'user-id',
      token: 'opaque-session-token',
      expiresAt,
    });
    configMocks.get.mockReturnValue('development');

    await expect(
      controller.login(
        { email: 'user@example.com', password: 'secret' },
        response as never,
      ),
    ).resolves.toEqual({ userId: 'user-id' });

    expect(response.cookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      'opaque-session-token',
      {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        expires: expiresAt,
      },
    );
  });

  it('registers and sets the normal session cookie without returning its token', async () => {
    const expiresAt = new Date('2026-12-01T00:00:00.000Z');
    authMocks.register.mockResolvedValue({ userId: 'new-user', token: 'new-session-token', expiresAt });
    configMocks.get.mockReturnValue('development');
    await expect(controller.register({
      fullName: 'New Resident', email: 'new@example.com', password: 'a password', confirmPassword: 'a password',
    }, response as never)).resolves.toEqual({ userId: 'new-user' });
    expect(response.cookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, 'new-session-token', expect.objectContaining({
      httpOnly: true, secure: false, sameSite: 'lax', path: '/', expires: expiresAt,
    }));
  });

  it('completes a password reset without exposing the token', async () => {
    passwordResetMocks.resetPassword.mockResolvedValue(undefined);

    await expect(controller.completePasswordReset({
      token: 'reset-token',
      newPassword: 'a secure passphrase longer than fifteen',
    })).resolves.toEqual({ status: 'ok' });
    expect(passwordResetMocks.resetPassword).toHaveBeenCalledWith(
      'reset-token',
      'a secure passphrase longer than fifteen',
    );
  });

  it('returns the generic password reset request result', async () => {
    passwordResetMocks.requestReset.mockResolvedValue({ status: 'accepted', message: 'If the account exists, password reset instructions will be sent.' });
    await expect(controller.requestPasswordReset({ email: 'person@example.com' })).resolves.toEqual({
      status: 'accepted', message: 'If the account exists, password reset instructions will be sent.',
    });
    expect(passwordResetMocks.requestReset).toHaveBeenCalledWith('person@example.com');
  });

  it('marks the session cookie Secure in production', async () => {
    authMocks.authenticate.mockResolvedValue({
      userId: 'user-id',
      token: 'opaque-session-token',
      expiresAt: new Date(),
    });
    configMocks.get.mockReturnValue('production');

    await controller.login(
      { email: 'user@example.com', password: 'secret' },
      response as never,
    );

    expect(response.cookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      'opaque-session-token',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
      }),
    );
  });

  it('replaces the cookie after successful server-side session rotation', async () => {
    const expiresAt = new Date('2026-12-01T00:00:00.000Z');
    sessionMocks.rotate.mockResolvedValue({
      token: 'replacement-token',
      expiresAt,
    });
    configMocks.get.mockReturnValue('development');

    await expect(
      controller.rotateSession(
        { cookies: { [SESSION_COOKIE_NAME]: 'old-token' } } as never,
        response as never,
      ),
    ).resolves.toEqual({ status: 'ok' });

    expect(sessionMocks.rotate).toHaveBeenCalledWith('old-token');
    expect(response.cookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      'replacement-token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        expires: expiresAt,
      }),
    );
  });

  it('revokes the session cookie token and clears the cookie', async () => {
    configMocks.get.mockReturnValue('development');

    await expect(
      controller.logout(
        { cookies: { [SESSION_COOKIE_NAME]: 'opaque-session-token' } } as never,
        response as never,
      ),
    ).resolves.toEqual({ status: 'ok' });

    expect(sessionMocks.revoke).toHaveBeenCalledWith('opaque-session-token');
    expect(response.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });
  });

  it('clears the cookie even when no session token is present', async () => {
    configMocks.get.mockReturnValue('development');

    await controller.logout({ cookies: {} } as never, response as never);

    expect(sessionMocks.revoke).not.toHaveBeenCalled();
    expect(response.clearCookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      expect.objectContaining({ path: '/' }),
    );
  });
});
