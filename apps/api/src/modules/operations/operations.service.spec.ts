import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { OperationsService } from './operations.service.js';

describe('OperationsService visitor log', () => {
  const mocks = {
    userRole: { findMany: vi.fn() },
    organization: { findMany: vi.fn() },
    student: { findFirst: vi.fn(), findMany: vi.fn() },
    visitorRequest: { findMany: vi.fn() },
    visitor: { create: vi.fn() },
    complaint: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    staff: { findMany: vi.fn(), findFirst: vi.fn() },
    hostel: { findMany: vi.fn(), findFirst: vi.fn() },
    maintenanceRequest: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    messSchedule: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    mealAttendance: { upsert: vi.fn() },
    $transaction: vi.fn(),
  };
  const notifications = { create: vi.fn() };
  const service = new OperationsService(mocks as unknown as PrismaService, notifications as never);
  const transaction = {
    visitor: { create: vi.fn() }, visitorRequest: { create: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userRole.findMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, hostel: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    mocks.student.findFirst.mockResolvedValue({ id: 'student-1' });
    mocks.student.findMany.mockResolvedValue([]);
    mocks.visitorRequest.findMany.mockResolvedValue([]);
    mocks.complaint.findMany.mockResolvedValue([]);
    mocks.staff.findMany.mockResolvedValue([]);
    mocks.hostel.findMany.mockResolvedValue([{ id: 'hostel-1' }]);
    mocks.hostel.findFirst.mockResolvedValue({ id: 'hostel-1', organizationId: 'org-1', name: 'North Hall' });
    mocks.maintenanceRequest.findMany.mockResolvedValue([]);
    mocks.messSchedule.findMany.mockResolvedValue([]);
    mocks.mealAttendance.upsert.mockResolvedValue({ id: 'meal-attendance-1' });
    notifications.create.mockResolvedValue({ id: 'notification-1' });
    transaction.visitor.create.mockResolvedValue({ id: 'visitor-1' });
    transaction.visitorRequest.create.mockResolvedValue({ id: 'visit-1', status: 'APPROVED' });
    mocks.$transaction.mockImplementation((run: (tx: typeof transaction) => unknown) => run(transaction));
  });

  it('records visitor identity and student visit together in one transaction', async () => {
    await expect(service.createVisitor('admin-1', {
      studentId: 'student-1', name: 'Sam Visitor', phone: '555-0101', purpose: 'Family visit',
      visitAt: '2026-11-15T18:00:00.000Z',
    })).resolves.toMatchObject({ id: 'visit-1' });
    expect(mocks.student.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'student-1', OR: [{ organizationId: { in: ['org-1'] } }] }),
    }));
    expect(mocks.$transaction).toHaveBeenCalledOnce();
    expect(transaction.visitor.create).toHaveBeenCalledWith({
      data: { name: 'Sam Visitor', phone: '555-0101' }, select: { id: true },
    });
    expect(transaction.visitorRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ visitorId: 'visitor-1', studentId: 'student-1', purpose: 'Family visit', status: 'APPROVED' }),
    }));
  });

  it('rejects a student outside the assigned organization before writing a visitor', async () => {
    mocks.student.findFirst.mockResolvedValue(null);
    await expect(service.createVisitor('admin-1', {
      studentId: 'other-student', name: 'Sam Visitor', purpose: 'Visit', visitAt: '2026-11-15T18:00:00.000Z',
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(mocks.$transaction).not.toHaveBeenCalled();
  });

  it('lists visits only for the authenticated organization scope', async () => {
    await service.listVisitors('admin-1');
    expect(mocks.visitorRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { student: expect.objectContaining({ OR: [{ organizationId: { in: ['org-1'] } }] }) }, take: 100,
    }));
    expect(mocks.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: [{ organizationId: { in: ['org-1'] } }] }),
    }));
  });

  it('provides organization IDs for complaint assignment choices', async () => {
    await service.listComplaints('admin-1');
    expect(mocks.complaint.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        student: { select: expect.objectContaining({ organizationId: true }) },
      }),
    }));
    expect(mocks.staff.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ organizationId: true }),
    }));
  });

  it('provides organization-scoped complaints and hostel assignments for maintenance choices', async () => {
    await service.listMaintenance('admin-1');
    expect(mocks.hostel.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      select: { id: true, organizationId: true, name: true },
    }));
    expect(mocks.staff.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        hostelAssignments: { select: { hostelId: true } },
      }),
    }));
    expect(mocks.complaint.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        student: { archivedAt: null, organization: { archivedAt: null, id: { in: ['org-1'] } } },
      },
      select: { id: true, title: true, student: { select: { organizationId: true } } },
    }));
  });

  it('creates a student complaint and notifies scoped staff', async () => {
    mocks.student.findFirst.mockResolvedValue({ id: 'student-1', organizationId: 'org-1' });
    mocks.complaint.create.mockResolvedValue({ id: 'complaint-1', title: 'Broken light', status: 'OPEN' });
    mocks.userRole.findMany.mockResolvedValue([{ userId: 'warden-1' }, { userId: 'warden-1' }]);
    await service.createComplaint('student-user', { title: 'Broken light', description: 'The room light is out.' });
    expect(mocks.complaint.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { studentId: 'student-1', title: 'Broken light', description: 'The room light is out.' },
    }));
    expect(notifications.create).toHaveBeenCalledOnce();
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'warden-1', organizationId: 'org-1', title: 'New student complaint',
    }));
  });

  it('notifies the student after a scoped complaint status change', async () => {
    mocks.userRole.findMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, hostel: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    mocks.complaint.findFirst.mockResolvedValue({
      id: 'complaint-1', status: 'OPEN', assignedStaffId: null,
      student: { organizationId: 'org-1', userId: 'student-user' },
    });
    mocks.complaint.update.mockResolvedValue({ id: 'complaint-1', title: 'Broken light', status: 'IN_PROGRESS' });
    await service.updateComplaint('admin-user', 'complaint-1', { status: 'IN_PROGRESS' });
    expect(mocks.complaint.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'IN_PROGRESS', assignedStaffId: undefined },
    }));
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'student-user', organizationId: 'org-1', title: 'Complaint status updated',
    }));
  });

  it('notifies the complaint student when maintenance reaches completed', async () => {
    mocks.userRole.findMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, hostel: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    mocks.maintenanceRequest.findFirst.mockResolvedValue({
      id: 'maintenance-1', status: 'IN_PROGRESS', title: 'Repair sink', hostelId: 'hostel-1', assigneeId: 'staff-1',
      hostel: { organizationId: 'org-1' }, complaint: { student: { userId: 'student-user' } },
      assignee: { userId: 'staff-user' },
    });
    mocks.maintenanceRequest.update.mockResolvedValue({ id: 'maintenance-1', title: 'Repair sink', status: 'COMPLETED', assigneeId: 'staff-1' });
    await service.updateMaintenance('admin-user', 'maintenance-1', { status: 'COMPLETED' });
    expect(mocks.maintenanceRequest.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'COMPLETED', assigneeId: undefined },
    }));
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'student-user', organizationId: 'org-1', title: 'Maintenance status updated',
    }));
  });

  it('links maintenance to a scoped complaint and notifies the student and assigned staff', async () => {
    mocks.userRole.findMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, hostel: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    mocks.hostel.findFirst.mockResolvedValue({ id: 'hostel-1', organizationId: 'org-1', name: 'North Hall' });
    mocks.complaint.findFirst.mockResolvedValue({ id: 'complaint-1', student: { userId: 'student-user' } });
    mocks.staff.findFirst.mockResolvedValue({ id: 'staff-1', userId: 'staff-user' });
    mocks.maintenanceRequest.create.mockResolvedValue({ id: 'maintenance-1', status: 'ASSIGNED' });
    await service.createMaintenance('admin-1', {
      hostelId: 'hostel-1', complaintId: 'complaint-1', assigneeId: 'staff-1', title: 'Repair sink', description: 'Replace the leaking pipe.',
    });
    expect(mocks.maintenanceRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ hostelId: 'hostel-1', complaintId: 'complaint-1', assigneeId: 'staff-1', status: 'ASSIGNED' }),
    }));
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'student-user', organizationId: 'org-1' }));
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'staff-user', organizationId: 'org-1' }));
  });

  it('marks resident meal attendance with the unique student and schedule key', async () => {
    mocks.userRole.findMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, hostel: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    mocks.messSchedule.findFirst.mockResolvedValue({ id: 'schedule-1', hostelId: 'hostel-1' });
    mocks.student.findFirst.mockResolvedValue({ id: 'student-1' });
    await service.markMealAttendance('admin-1', 'schedule-1', 'student-1');
    expect(mocks.student.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'student-1', allocations: { some: expect.objectContaining({ bed: { room: { floor: { building: { hostelId: 'hostel-1' } } } } }) } }),
    }));
    expect(mocks.mealAttendance.upsert).toHaveBeenCalledWith({
      where: { studentId_messScheduleId: { studentId: 'student-1', messScheduleId: 'schedule-1' } },
      create: { studentId: 'student-1', messScheduleId: 'schedule-1' }, update: {},
      select: { id: true, studentId: true, messScheduleId: true, attendedAt: true },
    });
  });

  it('returns each active resident with the hostels of their current allocations', async () => {
    mocks.student.findMany.mockResolvedValue([{
      id: 'student-1', studentNumber: 'ST-001', firstName: 'Alex', lastName: 'Resident',
      allocations: [{ bed: { room: { floor: { building: { hostelId: 'hostel-1' } } } } }],
    }]);
    const result = await service.listMess('admin-1');
    expect(result.students).toEqual([{
      id: 'student-1', studentNumber: 'ST-001', firstName: 'Alex', lastName: 'Resident', hostelIds: ['hostel-1'],
    }]);
    expect(mocks.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        allocations: expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE', endedAt: null,
            bed: { room: { floor: { building: { hostelId: { in: ['hostel-1'] } } } } },
          }),
        }),
      }),
    }));
  });

  it('creates a meal schedule only in the assigned hostel scope', async () => {
    mocks.userRole.findMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, hostel: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    mocks.messSchedule.create.mockResolvedValue({ id: 'schedule-1', hostelId: 'hostel-1', mealType: 'DINNER' });
    await service.createMessSchedule('admin-1', {
      hostelId: 'hostel-1', mealType: 'DINNER', startsAt: '2026-11-15T18:00:00.000Z',
      endsAt: '2026-11-15T19:00:00.000Z', menu: 'Rice and lentils',
    });
    expect(mocks.messSchedule.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ hostelId: 'hostel-1', mealType: 'DINNER', menu: 'Rice and lentils' }),
    }));
  });
});
