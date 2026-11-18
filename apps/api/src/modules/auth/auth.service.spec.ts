import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service.js';
import { PasswordHasher } from './password-hasher.service.js';
import { AuthService } from './auth.service.js';
import { SessionService } from './session.service.js';

describe('AuthService', () => {
  const prismaMocks = {
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  const passwordHasherMocks = {
    verify: vi.fn(),
    hash: vi.fn(),
  };
  const sessionServiceMocks = { create: vi.fn() };
  const configMocks = { get: vi.fn().mockReturnValue('HOSTEL_ADMIN') };

  const authService = new AuthService(
    prismaMocks as unknown as PrismaService,
    passwordHasherMocks as unknown as PasswordHasher,
    sessionServiceMocks as unknown as SessionService,
    configMocks as unknown as ConfigService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    passwordHasherMocks.hash.mockResolvedValue('$argon2id$dummy');
  });

  it('normalizes email, verifies the password, then creates a session', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    prismaMocks.user.findUnique.mockResolvedValue({
      id: 'user-id',
      passwordHash: '$argon2id$stored',
      status: 'ACTIVE',
    });
    passwordHasherMocks.verify.mockResolvedValue(true);
    sessionServiceMocks.create.mockResolvedValue({ token: 'opaque-token', expiresAt });

    await expect(
      authService.authenticate('  Person@Example.COM  ', 'password'),
    ).resolves.toEqual({ userId: 'user-id', token: 'opaque-token', expiresAt });

    expect(prismaMocks.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'person@example.com' },
      select: { id: true, passwordHash: true, status: true },
    });
    expect(passwordHasherMocks.verify).toHaveBeenCalledWith(
      '$argon2id$stored',
      'password',
    );
    expect(sessionServiceMocks.create).toHaveBeenCalledWith('user-id');
  });

  it('creates an active user, isolated organization, membership, role, and session transactionally', async () => {
    const tx = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'new-user' }),
      },
      organization: { create: vi.fn().mockResolvedValue({ id: 'new-org' }) },
      membership: { create: vi.fn() },
      role: { create: vi.fn().mockResolvedValue({ id: 'admin-role' }) },
      permission: { findMany: vi.fn().mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]) },
      rolePermission: { createMany: vi.fn() },
      userRole: { create: vi.fn() },
    };
    prismaMocks.$transaction.mockImplementation(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
    passwordHasherMocks.hash.mockResolvedValue('$argon2id$registered');
    const expiresAt = new Date(Date.now() + 60_000);
    sessionServiceMocks.create.mockResolvedValue({ token: 'session-token', expiresAt });

    await expect(authService.register({
      fullName: 'Avery Resident', email: ' Avery@Example.com ',
      password: 'long-password', confirmPassword: 'long-password',
    })).resolves.toEqual({ userId: 'new-user', token: 'session-token', expiresAt });

    expect(prismaMocks.$transaction).toHaveBeenCalledOnce();
    expect(tx.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      email: 'avery@example.com', firstName: 'Avery', lastName: 'Resident',
      passwordHash: '$argon2id$registered', status: 'ACTIVE',
    }) });
    expect(tx.membership.create).toHaveBeenCalledWith({ data: { organizationId: 'new-org', userId: 'new-user' } });
    expect(tx.userRole.create).toHaveBeenCalledWith({ data: {
      userId: 'new-user', roleId: 'admin-role', organizationId: 'new-org',
    } });
    expect(tx.rolePermission.createMany).toHaveBeenCalledWith({
      data: [{ roleId: 'admin-role', permissionId: 'p1' }, { roleId: 'admin-role', permissionId: 'p2' }],
      skipDuplicates: true,
    });
    expect(sessionServiceMocks.create).toHaveBeenCalledWith('new-user');
  });

  it('rejects an already registered email without creating records or a session', async () => {
    const tx = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'existing-user' }) },
    };
    prismaMocks.$transaction.mockImplementation(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));

    await expect(authService.register({
      fullName: 'Avery Resident', email: 'AVERY@example.com',
      password: 'long-password', confirmPassword: 'long-password',
    })).rejects.toBeInstanceOf(ConflictException);
    expect(sessionServiceMocks.create).not.toHaveBeenCalled();
  });

  it('uses the same generic rejection and dummy hash for unknown users', async () => {
    prismaMocks.user.findUnique.mockResolvedValue(null);

    await expect(
      authService.authenticate('unknown@example.com', 'password'),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));

    expect(passwordHasherMocks.hash).toHaveBeenCalledWith('password');
    expect(passwordHasherMocks.verify).not.toHaveBeenCalled();
    expect(sessionServiceMocks.create).not.toHaveBeenCalled();
  });

  it('does not authenticate inactive accounts or create a session', async () => {
    prismaMocks.user.findUnique.mockResolvedValue({
      id: 'suspended-user',
      passwordHash: '$argon2id$stored',
      status: 'SUSPENDED',
    });
    passwordHasherMocks.verify.mockResolvedValue(true);

    await expect(
      authService.authenticate('person@example.com', 'password'),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    expect(sessionServiceMocks.create).not.toHaveBeenCalled();
  });

  it('does not create a session for an incorrect password', async () => {
    prismaMocks.user.findUnique.mockResolvedValue({
      id: 'user-id',
      passwordHash: '$argon2id$stored',
      status: 'ACTIVE',
    });
    passwordHasherMocks.verify.mockResolvedValue(false);

    await expect(
      authService.authenticate('person@example.com', 'incorrect'),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    expect(sessionServiceMocks.create).not.toHaveBeenCalled();
  });
});
