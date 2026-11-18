import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { PasswordHasher } from './password-hasher.service.js';
import { ConfigService } from '@nestjs/config';
import {
  PASSWORD_RESET_TTL_MS,
  PasswordResetService,
} from './password-reset.service.js';

describe('PasswordResetService', () => {
  const transactionMocks = {
    passwordResetToken: { updateMany: vi.fn() },
    user: { update: vi.fn() },
    session: { updateMany: vi.fn() },
  };
  const prismaMocks = {
    passwordResetToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  const hasherMocks = { hash: vi.fn() };
  const configMocks = { get: vi.fn() };
  const service = new PasswordResetService(
    prismaMocks as unknown as PrismaService,
    hasherMocks as unknown as PasswordHasher,
    configMocks as unknown as ConfigService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    configMocks.get.mockReturnValue(undefined);
    prismaMocks.$transaction.mockImplementation(async (operation) =>
      operation(transactionMocks),
    );
  });

  it('creates a high-entropy token and persists only its hash', async () => {
    const beforeCreate = Date.now();
    const result = await service.create('user-id');
    const afterCreate = Date.now();
    const createArgs = prismaMocks.passwordResetToken.create.mock.calls[0]?.[0];

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(
      beforeCreate + PASSWORD_RESET_TTL_MS,
    );
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(
      afterCreate + PASSWORD_RESET_TTL_MS,
    );
    expect(createArgs?.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createArgs?.data.tokenHash).not.toBe(result.token);
    expect(createArgs?.data.userId).toBe('user-id');
  });

  it('atomically consumes the token, updates the password, and revokes sessions', async () => {
    prismaMocks.passwordResetToken.findFirst.mockResolvedValue({
      id: 'reset-id',
      userId: 'user-id',
    });
    hasherMocks.hash.mockResolvedValue('$argon2id$new-password');
    transactionMocks.passwordResetToken.updateMany.mockResolvedValueOnce({
      count: 1,
    });

    await expect(
      service.resetPassword('presented-token', 'new-password'),
    ).resolves.toBeUndefined();

    const findArgs = prismaMocks.passwordResetToken.findFirst.mock.calls[0]?.[0];
    expect(findArgs?.where).toMatchObject({
      tokenHash: expect.any(String),
      consumedAt: null,
      expiresAt: { gt: expect.any(Date) },
    });
    expect(findArgs?.where.tokenHash).not.toBe('presented-token');
    expect(hasherMocks.hash).toHaveBeenCalledWith('new-password');
    expect(transactionMocks.passwordResetToken.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'reset-id', consumedAt: null, expiresAt: { gt: expect.any(Date) } },
        data: { consumedAt: expect.any(Date) },
      }),
    );
    expect(transactionMocks.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: { passwordHash: '$argon2id$new-password' },
    });
    expect(transactionMocks.session.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-id', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(transactionMocks.passwordResetToken.updateMany).toHaveBeenNthCalledWith(2, {
      where: { userId: 'user-id', id: { not: 'reset-id' }, consumedAt: null },
      data: { consumedAt: expect.any(Date) },
    });
    expect(prismaMocks.$transaction).toHaveBeenCalledOnce();
  });

  it('does not hash or update a password for an invalid token', async () => {
    prismaMocks.passwordResetToken.findFirst.mockResolvedValue(null);

    await expect(
      service.resetPassword('invalid-token', 'new-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(hasherMocks.hash).not.toHaveBeenCalled();
    expect(prismaMocks.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a token consumed by a concurrent reset attempt', async () => {
    prismaMocks.passwordResetToken.findFirst.mockResolvedValue({
      id: 'reset-id',
      userId: 'user-id',
    });
    hasherMocks.hash.mockResolvedValue('$argon2id$new-password');
    transactionMocks.passwordResetToken.updateMany.mockResolvedValueOnce({
      count: 0,
    });

    await expect(
      service.resetPassword('raced-token', 'new-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(transactionMocks.passwordResetToken.updateMany).toHaveBeenCalledOnce();
    expect(transactionMocks.user.update).not.toHaveBeenCalled();
    expect(transactionMocks.session.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an expired token', async () => {
    prismaMocks.passwordResetToken.findFirst.mockResolvedValue(null);
    await expect(service.resetPassword('expired-token', 'new-password')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prismaMocks.passwordResetToken.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ expiresAt: { gt: expect.any(Date) }, consumedAt: null }),
    }));
  });

  it('rejects reuse after the token has been consumed', async () => {
    prismaMocks.passwordResetToken.findFirst.mockResolvedValueOnce({ id: 'reset-id', userId: 'user-id' }).mockResolvedValueOnce(null);
    hasherMocks.hash.mockResolvedValue('$argon2id$new-password');
    transactionMocks.passwordResetToken.updateMany.mockResolvedValueOnce({ count: 1 });
    await service.resetPassword('one-time-token', 'new-password');
    await expect(service.resetPassword('one-time-token', 'other-password')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prismaMocks.passwordResetToken.findFirst).toHaveBeenCalledTimes(2);
    expect(prismaMocks.$transaction).toHaveBeenCalledOnce();
  });

  it('returns the same response for known and unknown email addresses', async () => {
    prismaMocks.user.findUnique.mockResolvedValueOnce({ id: 'user-id', email: 'known@example.com', status: 'ACTIVE' }).mockResolvedValueOnce(null);
    prismaMocks.passwordResetToken.create.mockResolvedValue({});
    const knownStarted = Date.now();
    const known = await service.requestReset('KNOWN@example.com');
    const knownElapsed = Date.now() - knownStarted;
    const unknownStarted = Date.now();
    const unknown = await service.requestReset('unknown@example.com');
    const unknownElapsed = Date.now() - unknownStarted;
    expect(known).toEqual(unknown);
    expect(knownElapsed).toBeGreaterThanOrEqual(295);
    expect(unknownElapsed).toBeGreaterThanOrEqual(295);
    expect(Math.abs(knownElapsed - unknownElapsed)).toBeLessThan(100);
    expect(known).toEqual({ status: 'accepted', message: 'If the account exists, password reset instructions will be sent.' });
    expect(prismaMocks.user.findUnique).toHaveBeenNthCalledWith(1, {
      where: { email: 'known@example.com' }, select: { id: true, email: true, status: true },
    });
  });
});
