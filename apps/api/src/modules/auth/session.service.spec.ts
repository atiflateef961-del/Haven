import { PrismaService } from '../../database/prisma.service.js';
import {
  SessionService,
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_TTL_MS,
} from './session.service.js';

describe('SessionService', () => {
  const transactionMocks = {
    session: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  const prismaMocks = {
    $transaction: vi.fn(),
    session: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  const prisma = prismaMocks as unknown as PrismaService;
  const sessionService = new SessionService(prisma);

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.$transaction.mockImplementation(async (operation) =>
      operation(transactionMocks),
    );
  });

  it('creates a high-entropy token and stores only its SHA-256 hash', async () => {
    const beforeCreate = Date.now();
    const result = await sessionService.create('user-id');
    const afterCreate = Date.now();
    const createArgs = prismaMocks.session.create.mock.calls[0]?.[0];
    const storedHash = createArgs?.data.tokenHash;

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(
      beforeCreate + SESSION_TTL_MS,
    );
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(
      afterCreate + SESSION_TTL_MS,
    );
    expect(storedHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storedHash).not.toBe(result.token);
    expect(createArgs?.data).toMatchObject({
      userId: 'user-id',
      expiresAt: result.expiresAt,
    });
  });

  it('looks up only unrevoked, unexpired sessions for active users', async () => {
    prismaMocks.session.findFirst.mockResolvedValue({
      id: 'session-id',
      userId: 'user-id',
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      user: {
        id: 'user-id',
        email: 'user@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
      },
    });
    prismaMocks.session.updateMany.mockResolvedValue({ count: 1 });
    await sessionService.findActive('opaque-token');

    const query = prismaMocks.session.findFirst.mock.calls[0]?.[0];
    expect(query?.where).toMatchObject({
      revokedAt: null,
      expiresAt: { gt: expect.any(Date) },
      lastSeenAt: { gt: expect.any(Date) },
      user: { status: 'ACTIVE' },
    });
    expect(query?.where.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(query?.select).toEqual({
      id: true,
      userId: true,
      expiresAt: true,
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
    });
    expect(prismaMocks.session.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'session-id',
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
        lastSeenAt: { gt: expect.any(Date) },
      },
      data: { lastSeenAt: expect.any(Date) },
    });
  });

  it('rejects sessions that have crossed the idle timeout', async () => {
    prismaMocks.session.findFirst.mockResolvedValue(null);

    await expect(sessionService.findActive('idle-token')).resolves.toBeNull();

    const query = prismaMocks.session.findFirst.mock.calls[0]?.[0];
    const idleCutoff = query?.where.lastSeenAt?.gt;
    expect(idleCutoff).toBeInstanceOf(Date);
    expect(Date.now() - idleCutoff!.getTime()).toBeCloseTo(
      SESSION_IDLE_TIMEOUT_MS,
      -3,
    );
    expect(prismaMocks.session.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a session if it becomes inactive while being refreshed', async () => {
    prismaMocks.session.findFirst.mockResolvedValue({
      id: 'session-id',
      userId: 'user-id',
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      user: {
        id: 'user-id',
        email: 'user@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
      },
    });
    prismaMocks.session.updateMany.mockResolvedValue({ count: 0 });

    await expect(sessionService.findActive('raced-token')).resolves.toBeNull();
  });

  it('revokes a single session or all sessions for a user', async () => {
    await sessionService.revoke('opaque-token');
    await sessionService.revokeAllForUser('user-id');

    expect(prismaMocks.session.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { tokenHash: expect.any(String), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      }),
    );
    expect(prismaMocks.session.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { userId: 'user-id', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      }),
    );
  });

  it('atomically revokes an active token and creates a replacement', async () => {
    transactionMocks.session.findFirst.mockResolvedValue({
      id: 'old-session-id',
      userId: 'user-id',
    });
    transactionMocks.session.updateMany.mockResolvedValue({ count: 1 });

    const replacement = await sessionService.rotate('old-token');
    const findArgs = transactionMocks.session.findFirst.mock.calls[0]?.[0];
    const revokeArgs = transactionMocks.session.updateMany.mock.calls[0]?.[0];
    const createArgs = transactionMocks.session.create.mock.calls[0]?.[0];

    expect(prismaMocks.$transaction).toHaveBeenCalledOnce();
    expect(findArgs?.where).toMatchObject({
      tokenHash: expect.any(String),
      revokedAt: null,
      expiresAt: { gt: expect.any(Date) },
      lastSeenAt: { gt: expect.any(Date) },
      user: { status: 'ACTIVE' },
    });
    expect(revokeArgs?.where).toMatchObject({
      id: 'old-session-id',
      revokedAt: null,
      expiresAt: { gt: expect.any(Date) },
      lastSeenAt: { gt: expect.any(Date) },
    });
    expect(revokeArgs?.data.revokedAt).toBeInstanceOf(Date);
    expect(createArgs?.data).toMatchObject({
      userId: 'user-id',
      expiresAt: replacement.expiresAt,
    });
    expect(createArgs?.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createArgs?.data.tokenHash).not.toBe(replacement.token);
    expect(replacement.token).not.toBe('old-token');
  });

  it('rejects rotation when the old token is inactive or loses a race', async () => {
    transactionMocks.session.findFirst.mockResolvedValue(null);
    await expect(sessionService.rotate('inactive-token')).rejects.toThrow(
      'Unauthorized',
    );
    expect(transactionMocks.session.create).not.toHaveBeenCalled();

    transactionMocks.session.findFirst.mockResolvedValue({
      id: 'old-session-id',
      userId: 'user-id',
    });
    transactionMocks.session.updateMany.mockResolvedValue({ count: 0 });
    await expect(sessionService.rotate('raced-token')).rejects.toThrow(
      'Unauthorized',
    );
    expect(transactionMocks.session.create).not.toHaveBeenCalled();
  });
});
