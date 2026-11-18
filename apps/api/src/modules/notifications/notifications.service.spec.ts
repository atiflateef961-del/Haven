import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from './notifications.service.js';

describe('NotificationsService', () => {
  const prisma = {
    notification: { create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    userRole: { findMany: vi.fn() },
    student: { findFirst: vi.fn() },
    organization: { findMany: vi.fn() },
  };
  const config = { get: vi.fn() };
  const service = new NotificationsService(prisma as unknown as PrismaService, config as never);

  beforeEach(() => {
    vi.clearAllMocks();
    config.get.mockReturnValue(undefined);
    prisma.userRole.findMany.mockResolvedValue([{ organizationId: 'org-1', hostel: null, role: { name: 'HOSTEL_ADMIN' } }]);
    prisma.student.findFirst.mockResolvedValue(null);
  });

  it('lists only the user notifications in assigned organizations', async () => {
    const rows = [{ id: 'notice-1', organizationId: 'org-1', title: 'Update', readAt: null }];
    prisma.notification.findMany.mockResolvedValue(rows);
    await expect(service.listForUser('user-1')).resolves.toEqual({ notifications: rows });
    expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1', organizationId: { in: ['org-1'] } }, take: 50,
    }));
  });

  it('marks only an unread notification owned by the user and in their organization', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });
    prisma.notification.findFirst.mockResolvedValue({ id: 'notice-1', readAt: new Date() });
    await service.markReadForUser('user-1', 'notice-1');
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'notice-1', userId: 'user-1', organizationId: { in: ['org-1'] }, readAt: null },
      data: { readAt: expect.any(Date) },
    }));
  });

  it('does not disclose notifications outside the caller scope', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    prisma.notification.findFirst.mockResolvedValue(null);
    await expect(service.markReadForUser('user-1', 'foreign-notice')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a notification attached to its organization and recipient', async () => {
    prisma.notification.create.mockResolvedValue({ id: 'notice-1', userId: 'user-1', organizationId: 'org-1', title: 'Visitor arrival', body: 'A visitor arrived.', createdAt: new Date(), user: { email: 'user@example.com' } });
    prisma.notification.update.mockResolvedValue({ id: 'notice-1', emailStatus: 'FAILED', emailError: 'Email provider is not configured' });
    await expect(service.create({ userId: 'user-1', organizationId: 'org-1', title: 'Visitor arrival', body: 'A visitor arrived.' }))
      .resolves.toMatchObject({ emailStatus: 'FAILED', emailError: 'Email provider is not configured' });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', organizationId: 'org-1', title: 'Visitor arrival', body: 'A visitor arrived.' },
      select: { id: true, userId: true, organizationId: true, title: true, body: true, createdAt: true, user: { select: { email: true } } },
    });
    expect(prisma.notification.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ emailError: 'Email provider is not configured' }) }));
  });

  it('records a successful provider response without exposing the key', async () => {
    config.get.mockImplementation((key: string) => ({ EMAIL_API_KEY: 'secret', EMAIL_FROM: 'noreply@example.com', EMAIL_API_URL: 'https://mail.example/api' })[key as 'EMAIL_API_KEY']);
    prisma.notification.findFirst.mockResolvedValue({ id: 'notice-1', title: 'Update', body: 'Details', user: { email: 'user@example.com' } });
    prisma.notification.update.mockResolvedValue({ id: 'notice-1', emailStatus: 'SENT' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    await service.sendEmailForAdmin('admin-1', 'notice-1');
    expect(fetchMock).toHaveBeenCalledWith('https://mail.example/api', expect.objectContaining({
      headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/json', 'Idempotency-Key': 'notification/notice-1' },
      body: JSON.stringify({ from: 'noreply@example.com', to: ['user@example.com'], subject: 'Update', text: 'Details' }),
    }));
    expect(prisma.notification.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ emailStatus: 'SENT', emailError: null }) }));
    vi.unstubAllGlobals();
  });

  it('records provider failures for administrator follow-up', async () => {
    config.get.mockImplementation((key: string) => ({ EMAIL_API_KEY: 'secret', EMAIL_FROM: 'noreply@example.com', EMAIL_API_URL: 'https://mail.example/api' })[key as 'EMAIL_API_KEY']);
    prisma.notification.findFirst.mockResolvedValue({ id: 'notice-1', title: 'Update', body: 'Details', user: { email: 'user@example.com' } });
    prisma.notification.update.mockResolvedValue({ id: 'notice-1', emailStatus: 'FAILED', emailError: 'Email provider returned HTTP 503' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await service.sendEmailForAdmin('admin-1', 'notice-1');
    expect(prisma.notification.update).toHaveBeenCalledWith(expect.objectContaining({ data: {
      emailStatus: 'FAILED', emailSentAt: null, emailError: 'Email provider returned HTTP 503',
    } }));
    vi.unstubAllGlobals();
  });

  it('records missing provider configuration without attempting network access', async () => {
    config.get.mockReturnValue(undefined);
    prisma.notification.findFirst.mockResolvedValue({ id: 'notice-1', title: 'Update', body: 'Details', user: { email: 'user@example.com' } });
    prisma.notification.update.mockResolvedValue({ id: 'notice-1', emailStatus: 'FAILED', emailError: 'Email provider is not configured' });
    await service.sendEmailForAdmin('admin-1', 'notice-1');
    expect(prisma.notification.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ emailStatus: 'FAILED', emailError: 'Email provider is not configured' }) }));
  });
});
