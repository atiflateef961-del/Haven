import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { BookingsService } from './bookings.service.js';

describe('BookingsService', () => {
  const userRoleFindMany = vi.fn();
  const bookingFindMany = vi.fn();
  const bookingFindFirst = vi.fn();
  const bookingUpdateMany = vi.fn();
  const bedFindFirst = vi.fn();
  const bedFindMany = vi.fn();
  const allocationFindFirst = vi.fn();
  const allocationCreate = vi.fn();
  const allocationUpdateMany = vi.fn();
  const checkInCreate = vi.fn();
  const checkOutCreate = vi.fn();
  const transaction = vi.fn();
  const service = new BookingsService({
    userRole: { findMany: userRoleFindMany },
    booking: { findMany: bookingFindMany, findFirst: bookingFindFirst, updateMany: bookingUpdateMany },
    bedAllocation: { create: allocationCreate, findFirst: allocationFindFirst, updateMany: allocationUpdateMany },
    checkIn: { create: checkInCreate },
    checkOut: { create: checkOutCreate },
    bed: { findFirst: bedFindFirst, findMany: bedFindMany },
    $transaction: transaction,
  } as unknown as PrismaService);

  beforeEach(() => {
    vi.clearAllMocks();
    userRoleFindMany.mockResolvedValue([]);
    bookingFindMany.mockResolvedValue([]);
    bookingFindFirst.mockResolvedValue(null);
    bookingUpdateMany.mockResolvedValue({ count: 1 });
    bedFindFirst.mockResolvedValue({ id: 'bed-1' });
    bedFindMany.mockResolvedValue([]);
    allocationFindFirst.mockResolvedValue(null);
    allocationCreate.mockResolvedValue({ id: 'allocation-1' });
    allocationUpdateMany.mockResolvedValue({ count: 1 });
    checkInCreate.mockResolvedValue({ id: 'check-in-1' });
    checkOutCreate.mockResolvedValue({ id: 'check-out-1' });
    transaction.mockImplementation((callback) => callback({
      booking: { findFirst: bookingFindFirst, updateMany: bookingUpdateMany },
      bed: { findFirst: bedFindFirst },
      bedAllocation: { create: allocationCreate, findFirst: allocationFindFirst, updateMany: allocationUpdateMany },
      checkIn: { create: checkInCreate },
      checkOut: { create: checkOutCreate },
    }));
  });

  it('records check-in only for an active allocation in the administrator organization', async () => {
    userRoleFindMany.mockResolvedValue([{ organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' } }]);
    allocationFindFirst.mockResolvedValue({ id: 'allocation-1' });
    await expect(service.checkInForUser('admin-1', 'allocation-1', { notes: 'Late arrival' })).resolves.toEqual({ id: 'check-in-1' });
    expect(allocationFindFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ id: 'allocation-1', status: 'ACTIVE', endedAt: null }), select: { id: true } });
    expect(checkInCreate).toHaveBeenCalledWith({ data: { allocationId: 'allocation-1', notes: 'Late arrival' }, select: expect.any(Object) });
  });

  it('checks out an active allocation and records its effective end in one transaction', async () => {
    userRoleFindMany.mockResolvedValue([{ organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' } }]);
    allocationFindFirst.mockResolvedValue({ id: 'allocation-1' });
    await expect(service.checkOutForUser('admin-1', 'allocation-1', {})).resolves.toEqual({ id: 'check-out-1' });
    expect(allocationUpdateMany).toHaveBeenCalledWith({ where: expect.objectContaining({ id: 'allocation-1', status: 'ACTIVE', endedAt: null }), data: expect.objectContaining({ status: 'COMPLETED', endedAt: expect.any(Date) }) });
    expect(checkOutCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ allocationId: 'allocation-1', checkedOutAt: expect.any(Date) }), select: expect.any(Object) });
  });

  it('preserves allocation history and creates a replacement when transferring beds', async () => {
    userRoleFindMany.mockResolvedValue([{ organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' } }]);
    allocationFindFirst.mockResolvedValue({
      id: 'allocation-1', bookingId: 'booking-1', studentId: 'student-1', bedId: 'bed-1',
      startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() + 86_400_000), student: { organizationId: 'org-1' },
    });
    bedFindFirst.mockResolvedValue({ id: 'bed-2' });
    await expect(service.transferForUser('admin-1', 'allocation-1', { bedId: 'bed-2' })).resolves.toEqual({
      previousAllocationId: 'allocation-1', allocation: { id: 'allocation-1' },
    });
    expect(allocationUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'allocation-1', status: 'ACTIVE' }),
      data: expect.objectContaining({ status: 'COMPLETED', endedAt: expect.any(Date) }),
    });
    expect(allocationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ bookingId: 'booking-1', studentId: 'student-1', bedId: 'bed-2', startsAt: expect.any(Date), endsAt: expect.any(Date) }),
      select: expect.any(Object),
    });
  });

  it('lists active organization booking requests with bounded student fields', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    bookingFindMany.mockResolvedValue([{ id: 'booking-1' }]);
    await expect(service.listForUser('admin-1', { page: 2, pageSize: 20 })).resolves.toEqual({
      bookings: [{ id: 'booking-1' }], page: 2, pageSize: 20, hasMore: false,
    });
    expect(bookingFindMany).toHaveBeenCalledWith({
      where: {
        student: {
          archivedAt: null,
          organization: { archivedAt: null, id: { in: ['org-1'] } },
        },
      },
      select: {
        id: true, requestedFrom: true, requestedUntil: true, status: true, notes: true, createdAt: true,
        student: {
          select: {
            id: true, studentNumber: true, firstName: true, lastName: true,
            organization: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: 20, take: 21,
    });
  });

  it('allows global administrators to review requests across active organizations', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: null, hostelId: null, role: { name: 'SUPER_ADMIN' },
    }]);
    await service.listForUser('root', { page: 1, pageSize: 25 });
    expect(bookingFindMany.mock.calls[0]?.[0].where).toEqual({
      student: { archivedAt: null, organization: { archivedAt: null } },
    });
  });

  it('denies hostel-only and unassigned accounts', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: null, hostelId: 'hostel-1', role: { name: 'WARDEN' },
    }]);
    await expect(service.listForUser('warden', { page: 1, pageSize: 25 }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(bookingFindMany).not.toHaveBeenCalled();
  });

  it('approves a scoped request and creates its allocation using organization-local dates', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    bookingFindFirst.mockResolvedValueOnce({
      id: 'booking-1', studentId: 'student-1',
      requestedFrom: new Date('2027-01-10T00:00:00.000Z'),
      requestedUntil: new Date('2027-02-01T00:00:00.000Z'),
      student: { organization: { id: 'org-1', timezone: 'America/Los_Angeles' } },
    });
    await expect(service.approveForUser('admin-1', 'booking-1', { bedId: 'bed-1' })).resolves.toMatchObject({
      bookingId: 'booking-1', status: 'APPROVED', allocation: { id: 'allocation-1' },
    });
    expect(bedFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'bed-1', isActive: true,
        room: expect.objectContaining({ floor: expect.objectContaining({ building: expect.objectContaining({
          hostel: expect.objectContaining({ organization: { id: 'org-1', archivedAt: null } }),
        }) }) }),
      }),
    }));
    expect(allocationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        bookingId: 'booking-1', studentId: 'student-1', bedId: 'bed-1',
        startsAt: new Date('2027-01-10T08:00:00.000Z'),
        endsAt: new Date('2027-02-01T08:00:00.000Z'),
      },
    }));
    expect(bookingUpdateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: 'REQUESTED' }, data: { status: 'APPROVED' },
    });
  });

  it('lists only active beds in the request organization that do not overlap its interval', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    bookingFindFirst.mockResolvedValueOnce({
      id: 'booking-1', studentId: 'student-1',
      requestedFrom: new Date('2027-01-10T00:00:00.000Z'),
      requestedUntil: new Date('2027-02-01T00:00:00.000Z'),
      student: { organization: { id: 'org-1', timezone: 'America/Los_Angeles' } },
    });
    bedFindMany.mockResolvedValueOnce([{ id: 'bed-1' }, { id: 'bed-2' }]);
    await expect(service.listAvailableBedsForUser('admin-1', 'booking-1', { page: 1, pageSize: 1 }))
      .resolves.toEqual({ beds: [{ id: 'bed-1' }], page: 1, pageSize: 1, hasMore: true });
    expect(allocationFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ studentId: 'student-1', startsAt: { lt: new Date('2027-02-01T08:00:00.000Z') } }),
    }));
    expect(bedFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        isActive: true,
        allocations: { none: expect.objectContaining({
          status: 'ACTIVE', endedAt: null, startsAt: { lt: new Date('2027-02-01T08:00:00.000Z') },
        }) },
        room: expect.objectContaining({ floor: expect.objectContaining({ building: expect.objectContaining({
          hostel: expect.objectContaining({ organization: { id: 'org-1', archivedAt: null } }),
        }) }) }),
      }),
      skip: 0, take: 2,
    }));
  });

  it('returns no available beds when the student already has an overlapping allocation', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    bookingFindFirst.mockResolvedValueOnce({
      id: 'booking-1', studentId: 'student-1', requestedFrom: new Date('2027-01-10T00:00:00.000Z'),
      requestedUntil: null, student: { organization: { id: 'org-1', timezone: 'UTC' } },
    });
    allocationFindFirst.mockResolvedValueOnce({ id: 'allocation-existing' });
    await expect(service.listAvailableBedsForUser('admin-1', 'booking-1', { page: 1, pageSize: 25 }))
      .resolves.toMatchObject({ beds: [], hasMore: false });
    expect(bedFindMany).not.toHaveBeenCalled();
  });

  it('hides requests outside the administrator scope and rejects overlap conflicts', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    bookingFindFirst.mockResolvedValueOnce(null);
    await expect(service.approveForUser('admin-1', 'other-booking', { bedId: 'bed-1' }))
      .rejects.toBeInstanceOf(NotFoundException);
    transaction.mockRejectedValueOnce({ code: '23P01' });
    await expect(service.approveForUser('admin-1', 'booking-1', { bedId: 'bed-1' }))
      .rejects.toBeInstanceOf(ConflictException);
    transaction.mockRejectedValueOnce({ code: 'P2004', meta: { database_error: 'conflicting key violates exclusion constraint' } });
    await expect(service.approveForUser('admin-1', 'booking-1', { bedId: 'bed-1' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects only pending requests within active organization scope', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    bookingFindFirst.mockResolvedValueOnce({ id: 'booking-1', status: 'REQUESTED' });
    await expect(service.rejectForUser('admin-1', 'booking-1')).resolves.toEqual({ id: 'booking-1', status: 'REJECTED' });
    expect(bookingUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'booking-1', status: 'REQUESTED' }),
      data: { status: 'REJECTED' },
    }));
  });
});
