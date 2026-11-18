import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { StaffManagementService } from './staff-management.service.js';

describe('StaffManagementService', () => {
  const prisma = {
    userRole: { findMany: vi.fn() }, organization: { findMany: vi.fn() }, hostel: { findMany: vi.fn() },
    user: { findMany: vi.fn(), findFirst: vi.fn() }, staff: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(), staffHostel: { deleteMany: vi.fn(), createMany: vi.fn() },
  };
  const notifications = { create: vi.fn() };
  const transaction = { staffHostel: prisma.staffHostel, staff: { update: prisma.staff.update } };
  const service = new StaffManagementService(prisma as unknown as PrismaService, notifications as unknown as NotificationsService);

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.userRole.findMany.mockResolvedValue([{ organizationId: 'org-1', hostelId: null, hostel: null, role: { name: 'HOSTEL_ADMIN' } }]);
    prisma.organization.findMany.mockResolvedValue([{ id: 'org-1' }]);
    prisma.hostel.findMany.mockResolvedValue([{ id: 'hostel-1' }]);
    prisma.staff.findMany.mockResolvedValue([]);
    prisma.user.findFirst.mockResolvedValue({ id: 'user-2' });
    prisma.staff.create.mockResolvedValue({ id: 'staff-1', organizationId: 'org-1', userId: 'user-2', employeeNumber: 'E-1', jobTitle: 'Warden' });
    prisma.staff.update.mockResolvedValue({ id: 'staff-1', organizationId: 'org-1', userId: 'user-2', employeeNumber: 'E-1', jobTitle: 'Warden' });
    prisma.$transaction.mockImplementation((run: (tx: typeof transaction) => unknown) => run(transaction));
    prisma.staffHostel.deleteMany.mockResolvedValue({ count: 1 });
    prisma.staffHostel.createMany.mockResolvedValue({ count: 1 });
    notifications.create.mockResolvedValue({ id: 'notice-1' });
  });

  it('creates staff from an active organization member and records hostel assignment', async () => {
    await service.create('admin-1', {
      organizationId: 'org-1', userId: 'user-2', employeeNumber: 'E-1', jobTitle: 'Warden', hostelIds: ['hostel-1'],
    });
    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-2', status: 'ACTIVE', staff: null, memberships: { some: { organizationId: 'org-1' } } },
    }));
    expect(prisma.staff.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: 'org-1', userId: 'user-2', employeeNumber: 'E-1', jobTitle: 'Warden' }),
    }));
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-2', organizationId: 'org-1' }));
  });

  it('replaces hostel assignments transactionally when a profile is updated', async () => {
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1', organizationId: 'org-1', userId: 'user-2' });
    await service.update('admin-1', 'staff-1', { jobTitle: 'Senior warden', hostelIds: ['hostel-1'] });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.staffHostel.deleteMany).toHaveBeenCalledWith({ where: { staffId: 'staff-1' } });
    expect(prisma.staffHostel.createMany).toHaveBeenCalledWith({ data: [{ staffId: 'staff-1', hostelId: 'hostel-1' }], skipDuplicates: true });
  });

  it('does not allow a hostel-only warden to manage organization staff', async () => {
    prisma.userRole.findMany.mockResolvedValue([{
      organizationId: null, hostelId: 'hostel-1', hostel: { id: 'hostel-1', organizationId: 'org-1' }, role: { name: 'WARDEN' },
    }]);
    await expect(service.create('warden-1', {
      organizationId: 'org-1', userId: 'user-2', employeeNumber: 'E-1', jobTitle: 'Warden', hostelIds: ['hostel-1'],
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists only active staff in the assigned organization', async () => {
    await service.list('admin-1');
    expect(prisma.staff.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { archivedAt: null, OR: [{ organizationId: { in: ['org-1'] } }] }, take: 200,
    }));
  });

  it('archives only an active staff profile in the assigned organization', async () => {
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1', organizationId: 'org-1' });
    prisma.staff.update.mockResolvedValue({ id: 'staff-1' });
    await expect(service.archive('admin-1', 'staff-1')).resolves.toMatchObject({ id: 'staff-1', archivedAt: expect.any(Date) });
    expect(prisma.staff.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'staff-1' }, data: { archivedAt: expect.any(Date) },
    }));
  });
});
