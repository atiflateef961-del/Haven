import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { DashboardService } from './dashboard.service.js';

describe('DashboardService', () => {
  const prismaMocks = {
    userRole: { findMany: vi.fn() },
    organization: { findMany: vi.fn() },
    hostel: { findMany: vi.fn() },
    building: { count: vi.fn() },
    room: { count: vi.fn() },
    bed: { count: vi.fn() },
    bedAllocation: { count: vi.fn() },
    student: { count: vi.fn(), findMany: vi.fn() },
    payment: { aggregate: vi.fn() },
    auditLog: { findMany: vi.fn() },
    notification: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  };
  const service = new DashboardService(prismaMocks as unknown as PrismaService);

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.building.count.mockResolvedValue(3);
    prismaMocks.room.count.mockResolvedValue(12);
    prismaMocks.bed.count.mockResolvedValue(48);
    prismaMocks.bedAllocation.count.mockResolvedValue(31);
    prismaMocks.student.count.mockResolvedValue(35);
    prismaMocks.student.findMany.mockResolvedValue([
      { id: 'student-1', firstName: 'Amina', lastName: 'Khan', createdAt: new Date('2026-11-10T00:00:00.000Z') },
    ]);
    prismaMocks.auditLog.findMany.mockResolvedValue([
      { id: 'event-1', action: 'student.created', resourceType: 'Student', createdAt: new Date('2026-11-10T00:00:00.000Z') },
    ]);
    prismaMocks.organization.findMany.mockResolvedValue([
      { id: 'org-1', name: 'North House', currency: 'USD' },
    ]);
    prismaMocks.payment.aggregate.mockResolvedValue({ _sum: { amount: { toString: () => '125.50' } } });
    prismaMocks.hostel.findMany.mockResolvedValue([{ id: 'hostel-1', name: 'North Hall' }]);
    prismaMocks.$queryRaw.mockResolvedValue([{
      hostelId: 'hostel-1', hostelName: 'North Hall', beds: 48, occupiedBeds: 31,
    }]);
  });

  it('returns only the authenticated user\'s recent active notifications', async () => {
    const notifications = [{
      id: 'notification-1',
      title: 'Room inspection',
      body: 'Inspection begins at 10:00.',
      status: 'SENT',
      createdAt: new Date('2026-11-14T00:00:00.000Z'),
    }];
    prismaMocks.notification.findMany.mockResolvedValue(notifications);

    await expect(service.getRecentNotifications('user-1')).resolves.toBe(notifications);
    expect(prismaMocks.notification.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: { in: ['PENDING', 'SENT'] } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        body: true,
        status: true,
        createdAt: true,
      },
    });
  });

  it('returns summary counts only for the user\'s organization scope', async () => {
    prismaMocks.userRole.findMany.mockResolvedValue([{
      organizationId: 'org-1',
      hostelId: null,
      role: { name: 'HOSTEL_ADMIN' },
      hostel: null,
    }]);

    await expect(service.getSummary('user-1')).resolves.toEqual([{
      organizationId: 'org-1',
      organizationName: 'North House',
      currency: 'USD',
      hostels: 1,
      buildings: 3,
      rooms: 12,
      beds: 48,
      occupiedBeds: 31,
      availableBeds: 17,
      occupancyRate: 64.6,
      collectedLast30Days: '125.50',
      hostelOccupancy: [{
        hostelId: 'hostel-1', hostelName: 'North Hall', beds: 48,
        occupiedBeds: 31, occupancyRate: 64.6, availableBeds: 17,
      }],
      students: 35,
      recentRegistrations: [
        { id: 'student-1', firstName: 'Amina', lastName: 'Khan', createdAt: new Date('2026-11-10T00:00:00.000Z') },
      ],
      recentActivity: [
        { id: 'event-1', action: 'student.created', resourceType: 'Student', createdAt: new Date('2026-11-10T00:00:00.000Z') },
      ],
    }]);
    expect(prismaMocks.organization.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['org-1'] }, archivedAt: null },
    }));
    expect(prismaMocks.student.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', archivedAt: null },
    });
    expect(prismaMocks.payment.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'SUCCEEDED',
        currency: 'USD',
        receivedAt: { gte: expect.any(Date), lte: expect.any(Date) },
        invoice: { student: { organizationId: 'org-1', archivedAt: null } },
      }),
      _sum: { amount: true },
    }));
    expect(prismaMocks.room.count).toHaveBeenCalledWith({
      where: { archivedAt: null, floor: { building: { hostelId: { in: ['hostel-1'] } } } },
    });
    expect(prismaMocks.bed.count).toHaveBeenCalledWith({
      where: {
        isActive: true,
        room: { archivedAt: null, floor: { building: { hostelId: { in: ['hostel-1'] } } } },
      },
    });
    const occupancySql = prismaMocks.$queryRaw.mock.calls[0]?.[0] as TemplateStringsArray;
    expect([...occupancySql].join('')).toContain('AND r."archivedAt" IS NULL');
    expect(prismaMocks.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: 'org-1' }),
      select: { id: true, action: true, resourceType: true, createdAt: true },
    }));
  });

  it('limits hostel-scoped roles to their assigned hostel IDs', async () => {
    prismaMocks.userRole.findMany.mockResolvedValue([{
      organizationId: null,
      hostelId: 'hostel-1',
      role: { name: 'WARDEN' },
      hostel: { id: 'hostel-1', organizationId: 'org-1' },
    }]);

    const result = await service.getSummary('warden-1');

    expect(prismaMocks.hostel.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', archivedAt: null, id: { in: ['hostel-1'] } },
      select: { id: true, name: true },
    });
    expect(prismaMocks.student.count).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        archivedAt: null,
        allocations: {
          some: {
            status: 'ACTIVE',
            endedAt: null,
            bed: { room: { archivedAt: null, floor: { building: { hostelId: { in: ['hostel-1'] } } } } },
          },
        },
      },
    });
    expect(prismaMocks.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: 'org-1',
        allocations: expect.objectContaining({ some: expect.any(Object) }),
      }),
      take: 5,
    }));
    expect(prismaMocks.auditLog.findMany).not.toHaveBeenCalled();
    expect(prismaMocks.payment.aggregate).not.toHaveBeenCalled();
    expect(result[0]?.recentActivity).toBeNull();
    expect(result[0]?.collectedLast30Days).toBeNull();
  });

  it('does not expose registration names to finance-only roles', async () => {
    prismaMocks.userRole.findMany.mockResolvedValue([{
      organizationId: 'org-1',
      hostelId: null,
      role: { name: 'ACCOUNTANT' },
      hostel: null,
    }]);

    const result = await service.getSummary('accountant-1');

    expect(result[0]?.recentRegistrations).toEqual([]);
    expect(prismaMocks.student.findMany).not.toHaveBeenCalled();
  });

  it('denies users without a dashboard role assignment', async () => {
    prismaMocks.userRole.findMany.mockResolvedValue([]);

    await expect(service.getSummary('student-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaMocks.organization.findMany).not.toHaveBeenCalled();
  });

  it('reports occupancy as unavailable when there is no active bed capacity', async () => {
    prismaMocks.userRole.findMany.mockResolvedValue([{
      organizationId: 'org-1',
      hostelId: null,
      role: { name: 'HOSTEL_ADMIN' },
      hostel: null,
    }]);
    prismaMocks.bed.count.mockResolvedValue(0);
    prismaMocks.bedAllocation.count.mockResolvedValue(0);

    const result = await service.getSummary('user-1');

    expect(result[0]?.occupancyRate).toBeNull();
  });
});
