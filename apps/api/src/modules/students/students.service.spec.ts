import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { StudentsService } from './students.service.js';

describe('StudentsService', () => {
  const userRoleFindMany = vi.fn();
  const studentFindMany = vi.fn();
  const studentCreate = vi.fn();
  const studentUpdateMany = vi.fn();
  const studentFindFirst = vi.fn();
  const organizationFindFirst = vi.fn();
  const organizationFindMany = vi.fn();
  const guardianFindMany = vi.fn();
  const guardianCreate = vi.fn();
  const guardianUpdateMany = vi.fn();
  const guardianFindFirst = vi.fn();
  const studentDocumentFindMany = vi.fn();
  const studentDocumentCreate = vi.fn();
  const studentDocumentFindFirst = vi.fn();
  const studentDocumentDeleteMany = vi.fn();
  const bedAllocationFindMany = vi.fn();
  const bookingCreate = vi.fn();
  const bookingFindMany = vi.fn();
  const bookingUpdateMany = vi.fn();
  const bookingFindFirst = vi.fn();
  const staffFindFirst = vi.fn();
  const attendanceUpsert = vi.fn();
  const documentStorageWrite = vi.fn();
  const documentStorageRead = vi.fn();
  const documentStorageRemove = vi.fn();
  const documentStorageRestore = vi.fn();
  const documentScannerScan = vi.fn();
  const service = new StudentsService({
    userRole: { findMany: userRoleFindMany },
    student: {
      findMany: studentFindMany,
      create: studentCreate,
      updateMany: studentUpdateMany,
      findFirst: studentFindFirst,
    },
    guardian: {
      findMany: guardianFindMany,
      create: guardianCreate,
      updateMany: guardianUpdateMany,
      findFirst: guardianFindFirst,
    },
    studentDocument: {
      findMany: studentDocumentFindMany,
      create: studentDocumentCreate,
      findFirst: studentDocumentFindFirst,
      deleteMany: studentDocumentDeleteMany,
    },
    bedAllocation: { findMany: bedAllocationFindMany },
    booking: { create: bookingCreate, findMany: bookingFindMany, updateMany: bookingUpdateMany, findFirst: bookingFindFirst },
    organization: { findFirst: organizationFindFirst, findMany: organizationFindMany },
    staff: { findFirst: staffFindFirst },
    attendance: { upsert: attendanceUpsert },
  } as unknown as PrismaService, {
    write: documentStorageWrite,
    read: documentStorageRead,
    remove: documentStorageRemove,
    restore: documentStorageRestore,
  } as never, { scan: documentScannerScan } as never);

  beforeEach(() => {
    vi.clearAllMocks();
    studentFindMany.mockResolvedValue([]);
    organizationFindFirst.mockResolvedValue({ id: 'org-1' });
    organizationFindMany.mockResolvedValue([{ id: 'org-1', name: 'North House' }]);
    studentCreate.mockResolvedValue({ id: 'student-1' });
    studentUpdateMany.mockResolvedValue({ count: 1 });
    studentFindFirst.mockResolvedValue({ id: 'student-1', firstName: 'Ada' });
    guardianFindMany.mockResolvedValue([]);
    guardianCreate.mockResolvedValue({ id: 'guardian-1' });
    guardianUpdateMany.mockResolvedValue({ count: 1 });
    guardianFindFirst.mockResolvedValue({ id: 'guardian-1', name: 'Parent' });
    studentDocumentFindMany.mockResolvedValue([]);
    studentDocumentCreate.mockResolvedValue({ id: 'document-1', documentType: 'identity', contentType: 'application/pdf', createdAt: new Date() });
    studentDocumentFindFirst.mockResolvedValue({ objectKey: 'private.pdf', contentType: 'application/pdf' });
    documentStorageWrite.mockResolvedValue('private.pdf');
    documentStorageRead.mockResolvedValue(Buffer.from('%PDF-1.7'));
    documentStorageRemove.mockResolvedValue(undefined);
    documentStorageRestore.mockResolvedValue(undefined);
    documentScannerScan.mockResolvedValue(undefined);
    studentDocumentDeleteMany.mockResolvedValue({ count: 1 });
    bedAllocationFindMany.mockResolvedValue([]);
    bookingCreate.mockResolvedValue({ id: 'booking-1', status: 'REQUESTED' });
    bookingFindMany.mockResolvedValue([]);
    bookingUpdateMany.mockResolvedValue({ count: 1 });
    bookingFindFirst.mockResolvedValue({ id: 'booking-1' });
    staffFindFirst.mockResolvedValue({ id: 'staff-1' });
    attendanceUpsert.mockResolvedValue({ id: 'attendance-1', studentId: 'student-1', status: 'PRESENT' });
  });

  it('upserts attendance by student and date within the user organization', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    studentFindFirst.mockResolvedValue({ id: 'student-1', organizationId: 'org-1' });

    await service.markAttendanceForUser('admin-1', 'student-1', {
      attendanceDate: '2026-11-15', status: 'LATE', note: 'Arrived after roll call',
    });

    expect(staffFindFirst).toHaveBeenCalledWith({
      where: { userId: 'admin-1', organizationId: 'org-1' }, select: { id: true },
    });
    expect(attendanceUpsert).toHaveBeenCalledWith({
      where: { studentId_attendanceDate: { studentId: 'student-1', attendanceDate: new Date('2026-11-15T00:00:00.000Z') } },
      create: expect.objectContaining({ studentId: 'student-1', status: 'LATE', staffId: 'staff-1' }),
      update: { status: 'LATE', note: 'Arrived after roll call', staffId: 'staff-1' },
      select: { id: true, studentId: true, attendanceDate: true, status: true, note: true },
    });
  });

  it('lists only active students in the administrator organizations', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);

    await expect(service.listForUser('admin-1', { page: 1, pageSize: 25 })).resolves.toEqual({
      students: [], page: 1, pageSize: 25, hasMore: false,
      creatableOrganizations: [{ id: 'org-1', name: 'North House' }],
    });
    expect(studentFindMany).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
        organization: { archivedAt: null },
        organizationId: { in: ['org-1'] },
      },
      select: {
        id: true,
        organizationId: true,
        studentNumber: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        dateOfBirth: true,
        educationInstitution: true,
        educationProgram: true,
        educationYear: true,
        status: true,
        createdAt: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
      skip: 0,
      take: 26,
    });
    expect(organizationFindMany).toHaveBeenCalledWith({
      where: { archivedAt: null, id: { in: ['org-1'] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  });

  it('returns only the authenticated user’s own active student profile without requiring admin roles', async () => {
    studentFindFirst.mockResolvedValueOnce({
      id: 'student-1', organizationId: 'org-1', studentNumber: 'S-1',
      firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com',
      phone: null, dateOfBirth: null,
    });
    await expect(service.getMyProfile('user-1')).resolves.toMatchObject({
      id: 'student-1', studentNumber: 'S-1', firstName: 'Ada', lastName: 'Lovelace',
    });
    expect(studentFindFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', archivedAt: null, organization: { archivedAt: null } },
      select: {
        id: true, organizationId: true, studentNumber: true,
        firstName: true, lastName: true, email: true, phone: true, dateOfBirth: true,
        educationInstitution: true, educationProgram: true, educationYear: true,
        status: true,
      },
    });
    expect(userRoleFindMany).not.toHaveBeenCalled();
  });

  it('creates a booking request only for the authenticated user active student profile', async () => {
    studentFindFirst.mockResolvedValueOnce({ id: 'student-1' });
    bookingCreate.mockResolvedValueOnce({
      id: 'booking-1', requestedFrom: new Date('2027-01-10T00:00:00.000Z'),
      requestedUntil: new Date('2027-02-01T00:00:00.000Z'), status: 'REQUESTED', notes: 'Accessible room',
    });
    await expect(service.createMyBooking('user-1', {
      requestedFrom: '2027-01-10', requestedUntil: '2027-02-01', notes: 'Accessible room',
    })).resolves.toMatchObject({ id: 'booking-1', status: 'REQUESTED' });
    expect(studentFindFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', archivedAt: null, organization: { archivedAt: null } },
      select: { id: true },
    });
    expect(bookingCreate).toHaveBeenCalledWith({
      data: {
        studentId: 'student-1',
        requestedFrom: new Date('2027-01-10T00:00:00.000Z'),
        requestedUntil: new Date('2027-02-01T00:00:00.000Z'),
        notes: 'Accessible room',
      },
      select: { id: true, requestedFrom: true, requestedUntil: true, status: true, notes: true, createdAt: true },
    });
    expect(userRoleFindMany).not.toHaveBeenCalled();
  });

  it('does not create a booking for an unlinked or archived student profile', async () => {
    studentFindFirst.mockResolvedValueOnce(null);
    await expect(service.createMyBooking('unlinked-user', { requestedFrom: '2027-01-10' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  it('lists only booking requests for the authenticated user with bounded pagination', async () => {
    studentFindFirst.mockResolvedValueOnce({ id: 'student-1' });
    bookingFindMany.mockResolvedValueOnce([{ id: 'booking-1' }, { id: 'booking-2' }]);
    await expect(service.listMyBookings('user-1', { page: 1, pageSize: 1 })).resolves.toEqual({
      bookings: [{ id: 'booking-1' }], page: 1, pageSize: 1, hasMore: true,
    });
    expect(bookingFindMany).toHaveBeenCalledWith({
      where: { studentId: 'student-1' },
      select: { id: true, requestedFrom: true, requestedUntil: true, status: true, notes: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: 0,
      take: 2,
    });
  });

  it('does not list bookings for an unlinked or archived profile', async () => {
    studentFindFirst.mockResolvedValueOnce(null);
    await expect(service.listMyBookings('unlinked-user', { page: 1, pageSize: 25 }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(bookingFindMany).not.toHaveBeenCalled();
  });

  it('cancels only a pending booking belonging to the signed-in active student', async () => {
    await expect(service.cancelMyBooking('user-1', 'booking-1')).resolves.toEqual({ id: 'booking-1', status: 'CANCELLED' });
    expect(bookingUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'booking-1', status: 'REQUESTED',
        student: { userId: 'user-1', archivedAt: null, organization: { archivedAt: null } },
      },
      data: { status: 'CANCELLED' },
    });
    expect(bookingFindFirst).not.toHaveBeenCalled();
  });

  it('hides another student booking and rejects cancellation after review', async () => {
    bookingUpdateMany.mockResolvedValueOnce({ count: 0 });
    bookingFindFirst.mockResolvedValueOnce(null);
    await expect(service.cancelMyBooking('user-2', 'booking-1')).rejects.toBeInstanceOf(NotFoundException);
    bookingUpdateMany.mockResolvedValueOnce({ count: 0 });
    bookingFindFirst.mockResolvedValueOnce({ id: 'booking-1' });
    await expect(service.cancelMyBooking('user-1', 'booking-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not return missing, archived, or archived-organization student profiles', async () => {
    studentFindFirst.mockResolvedValueOnce(null);
    await expect(service.getMyProfile('user-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(studentFindFirst.mock.calls.at(-1)?.[0].where).toEqual({
      userId: 'user-1', archivedAt: null, organization: { archivedAt: null },
    });
  });

  it('lists room history only for the authenticated student profile', async () => {
    studentFindFirst.mockResolvedValueOnce({ id: 'student-1' });
    await expect(service.getMyRoomHistory('user-1')).resolves.toEqual({ allocations: [] });
    expect(studentFindFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', archivedAt: null, organization: { archivedAt: null } },
      select: { id: true },
    });
    expect(bedAllocationFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { studentId: 'student-1' },
      orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
    }));
    expect(userRoleFindMany).not.toHaveBeenCalled();
  });

  it('does not list room history when the authenticated user has no active student profile', async () => {
    studentFindFirst.mockResolvedValueOnce(null);
    await expect(service.getMyRoomHistory('unlinked-user')).rejects.toBeInstanceOf(NotFoundException);
    expect(bedAllocationFindMany).not.toHaveBeenCalled();
  });

  it('updates contact fields only for the student linked to the authenticated user', async () => {
    await expect(service.updateMyProfile('user-1', { email: 'ADA@example.com', phone: null }))
      .resolves.toMatchObject({ id: 'student-1' });
    const scope = { userId: 'user-1', archivedAt: null, organization: { archivedAt: null } };
    expect(studentUpdateMany).toHaveBeenCalledWith({
      where: scope,
      data: { email: 'ada@example.com', phone: null },
    });
    expect(studentFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: scope }));
    expect(userRoleFindMany).not.toHaveBeenCalled();
  });

  it('does not update an unlinked, archived, or archived-organization profile', async () => {
    studentUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.updateMyProfile('unlinked-user', { phone: '12345' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(studentUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'unlinked-user', archivedAt: null, organization: { archivedAt: null } },
      data: { email: undefined, phone: '12345' },
    });
  });

  it('returns a bounded page and indicates whether more results are available', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    studentFindMany.mockResolvedValue(Array.from({ length: 3 }, (_, index) => ({ id: `s-${index}` })));

    await expect(service.listForUser('admin-1', { page: 2, pageSize: 2 })).resolves.toMatchObject({
      students: [{ id: 's-0' }, { id: 's-1' }],
      page: 2,
      pageSize: 2,
      hasMore: true,
    });
    expect(studentFindMany.mock.calls.at(-1)?.[0]).toMatchObject({ skip: 2, take: 3 });
  });

  it('allows a global super administrator to list across active organizations', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: null, hostelId: null, role: { name: 'SUPER_ADMIN' },
    }]);
    await service.listForUser('root', { page: 1, pageSize: 25 });
    expect(studentFindMany.mock.calls[0]?.[0].where).toEqual({
      archivedAt: null,
      organization: { archivedAt: null },
    });
    expect(organizationFindMany.mock.calls[0]?.[0].where).toEqual({ archivedAt: null });
  });

  it('denies accounts without organization-level student access', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: null, hostelId: 'hostel-1', role: { name: 'WARDEN' },
    }]);
    await expect(service.listForUser('warden', { page: 1, pageSize: 25 })).rejects.toBeInstanceOf(ForbiddenException);
    expect(studentFindMany).not.toHaveBeenCalled();
  });

  it('creates a student in the sole assigned organization and normalizes email', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    await expect(service.createForUser('admin-1', {
      studentNumber: 'S-100', firstName: 'Ada', lastName: 'Lovelace',
      email: 'ADA@example.com', phone: '12345', dateOfBirth: '2000-01-02',
      educationInstitution: 'Example University', educationProgram: 'Computer Science', educationYear: 'Year 2',
      status: 'SUSPENDED',
    })).resolves.toEqual({ id: 'student-1' });
    expect(organizationFindFirst).toHaveBeenCalledWith({
      where: { id: 'org-1', archivedAt: null }, select: { id: true },
    });
    expect(studentCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: 'org-1', email: 'ada@example.com',
        dateOfBirth: new Date('2000-01-02T00:00:00.000Z'),
        educationInstitution: 'Example University', educationProgram: 'Computer Science', educationYear: 'Year 2',
        status: 'SUSPENDED',
      }),
      select: expect.objectContaining({ id: true, studentNumber: true }),
    }));
  });

  it('requires an organization choice for a multi-organization admin and blocks cross-tenant creation', async () => {
    userRoleFindMany.mockResolvedValue([
      { organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' } },
      { organizationId: 'org-2', hostelId: null, role: { name: 'HOSTEL_ADMIN' } },
    ]);
    const input = { studentNumber: 'S-1', firstName: 'A', lastName: 'B' };
    await expect(service.createForUser('admin-1', input)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createForUser('admin-1', { ...input, organizationId: 'org-3' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(organizationFindFirst).not.toHaveBeenCalled();
  });

  it('requires explicit organization selection for a global admin and rejects archived organizations', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: null, hostelId: null, role: { name: 'SUPER_ADMIN' },
    }]);
    const input = { studentNumber: 'S-1', firstName: 'A', lastName: 'B' };
    await expect(service.createForUser('root', input)).rejects.toBeInstanceOf(BadRequestException);
    organizationFindFirst.mockResolvedValueOnce(null);
    await expect(service.createForUser('root', { ...input, organizationId: 'org-1' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(studentCreate).not.toHaveBeenCalled();
  });

  it('maps duplicate student numbers to a conflict', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    studentCreate.mockRejectedValue({ code: 'P2002' });
    await expect(service.createForUser('admin-1', {
      studentNumber: 'S-100', firstName: 'Ada', lastName: 'Lovelace',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates only a student in the active assigned organization', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    await expect(service.updateForUser('admin-1', 'student-1', {
      firstName: 'Ada Updated', email: null, dateOfBirth: null,
      educationInstitution: null, educationProgram: 'Mathematics', educationYear: 'Year 3', status: 'GRADUATED',
    })).resolves.toMatchObject({ id: 'student-1' });
    const expectedWhere = {
      id: 'student-1',
      archivedAt: null,
      organization: { archivedAt: null },
      organizationId: { in: ['org-1'] },
    };
    expect(studentUpdateMany).toHaveBeenCalledWith({
      where: expectedWhere,
      data: {
        firstName: 'Ada Updated', email: null, dateOfBirth: null,
        educationInstitution: null, educationProgram: 'Mathematics', educationYear: 'Year 3', status: 'GRADUATED',
      },
    });
    expect(studentFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expectedWhere }));
  });

  it('hides unassigned records, rejects hostel-only roles, and maps duplicate updates', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    studentUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.updateForUser('admin-1', 'other-student', { firstName: 'Nope' }))
      .rejects.toBeInstanceOf(NotFoundException);

    userRoleFindMany.mockResolvedValue([{
      organizationId: null, hostelId: 'hostel-1', role: { name: 'HOSTEL_ADMIN' },
    }]);
    await expect(service.updateForUser('hostel-admin', 'student-1', { firstName: 'Nope' }))
      .rejects.toBeInstanceOf(ForbiddenException);

    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    studentUpdateMany.mockRejectedValueOnce({ code: 'P2002' });
    await expect(service.updateForUser('admin-1', 'student-1', { studentNumber: 'DUPLICATE' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('lists guardians only after confirming the student is in the caller organization', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    await expect(service.listGuardiansForUser('admin-1', 'student-1'))
      .resolves.toEqual({ guardians: [] });
    expect(studentFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'student-1', archivedAt: null,
        organization: { archivedAt: null },
        organizationId: { in: ['org-1'] },
      },
      select: { id: true, organizationId: true },
    });
    expect(guardianFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { studentId: 'student-1' },
    }));
  });

  it('lists document metadata only after confirming the student is in the caller organization', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    studentDocumentFindMany.mockResolvedValue([{
      id: 'document-1', documentType: 'identity', contentType: 'application/pdf', createdAt: new Date(),
    }]);
    const result = await service.listDocumentsForUser('admin-1', 'student-1');
    expect(result.documents).toHaveLength(1);
    expect(studentDocumentFindMany).toHaveBeenCalledWith({
      where: { studentId: 'student-1' },
      select: { id: true, documentType: true, contentType: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    expect(studentDocumentFindMany.mock.calls[0][0].select).not.toHaveProperty('objectKey');
  });

  it('does not list document metadata for students outside the caller organization', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    studentFindFirst.mockResolvedValueOnce(null);
    await expect(service.listDocumentsForUser('admin-1', 'other-student'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(studentDocumentFindMany).not.toHaveBeenCalled();
  });

  it('lists room allocation history after checking the student organization scope', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    await expect(service.listRoomHistoryForUser('admin-1', 'student-1')).resolves.toEqual({ allocations: [] });
    expect(bedAllocationFindMany).toHaveBeenCalledWith({
      where: { studentId: 'student-1' },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        endedAt: true,
        status: true,
        bed: {
          select: {
            label: true,
            room: {
              select: {
                number: true,
                floor: {
                  select: {
                    number: true,
                    building: {
                      select: { name: true, hostel: { select: { name: true, code: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
    });
    studentFindFirst.mockResolvedValueOnce(null);
    await expect(service.listRoomHistoryForUser('admin-1', 'other-student'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(bedAllocationFindMany).toHaveBeenCalledTimes(1);
  });

  it('stores a document only for an accessible student and validates its signature', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    await service.uploadDocumentForUser('admin-1', 'student-1', 'Identity', {
      buffer: Buffer.from('%PDF-1.7 sample'), mimetype: 'application/pdf',
    });
    expect(documentStorageWrite).toHaveBeenCalledWith(Buffer.from('%PDF-1.7 sample'), 'pdf');
    expect(documentScannerScan).toHaveBeenCalledWith(Buffer.from('%PDF-1.7 sample'));
    expect(studentDocumentCreate).toHaveBeenCalledWith({
      data: { studentId: 'student-1', documentType: 'Identity', objectKey: 'private.pdf', contentType: 'application/pdf' },
      select: { id: true, documentType: true, contentType: true, createdAt: true },
    });
    await expect(service.uploadDocumentForUser('admin-1', 'student-1', 'Identity', {
      buffer: Buffer.from('<html>not a PDF'), mimetype: 'application/pdf',
    })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.uploadDocumentForUser('admin-1', 'student-1', 'Student photograph', {
      buffer: Buffer.from('%PDF-1.7 image spoof'), mimetype: 'application/pdf',
    })).rejects.toBeInstanceOf(BadRequestException);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await service.uploadDocumentForUser('admin-1', 'student-1', 'Student photograph', {
      buffer: png, mimetype: 'image/png',
    });
    expect(documentStorageWrite).toHaveBeenLastCalledWith(png, 'png');
  });

  it('does not store or record a document when malware scanning rejects it', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    documentScannerScan.mockRejectedValueOnce(new Error('malicious file'));
    await expect(service.uploadDocumentForUser('admin-1', 'student-1', 'Identity', {
      buffer: Buffer.from('%PDF-1.7 malicious'), mimetype: 'application/pdf',
    })).rejects.toThrow('malicious file');
    expect(documentStorageWrite).not.toHaveBeenCalled();
    expect(studentDocumentCreate).not.toHaveBeenCalled();
  });

  it('removes stored files if document metadata cannot be saved', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    studentDocumentCreate.mockRejectedValueOnce(new Error('database failure'));
    await expect(service.uploadDocumentForUser('admin-1', 'student-1', 'Identity', {
      buffer: Buffer.from('%PDF-1.7 sample'), mimetype: 'application/pdf',
    })).rejects.toThrow('database failure');
    expect(documentStorageRemove).toHaveBeenCalledWith('private.pdf');
  });

  it('reads documents only when they belong to an accessible student', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    await expect(service.readDocumentForUser('admin-1', 'student-1', 'document-1'))
      .resolves.toEqual({ buffer: Buffer.from('%PDF-1.7'), contentType: 'application/pdf' });
    expect(studentDocumentFindFirst).toHaveBeenCalledWith({
      where: { id: 'document-1', studentId: 'student-1' },
      select: { objectKey: true, contentType: true },
    });
    studentFindFirst.mockResolvedValueOnce(null);
    await expect(service.readDocumentForUser('admin-1', 'other-student', 'document-1'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes a document file and its metadata only within the accessible student scope', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    await expect(service.deleteDocumentForUser('admin-1', 'student-1', 'document-1'))
      .resolves.toEqual({ id: 'document-1', deleted: true });
    expect(documentStorageRemove).toHaveBeenCalledWith('private.pdf');
    expect(studentDocumentDeleteMany).toHaveBeenCalledWith({
      where: { id: 'document-1', studentId: 'student-1' },
    });
    studentFindFirst.mockResolvedValueOnce(null);
    await expect(service.deleteDocumentForUser('admin-1', 'other-student', 'document-1'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(studentDocumentDeleteMany).toHaveBeenCalledTimes(1);
  });

  it('restores the private file if metadata deletion fails', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    studentDocumentDeleteMany.mockRejectedValueOnce(new Error('database failure'));
    const file = Buffer.from('%PDF-1.7 private');
    documentStorageRead.mockResolvedValueOnce(file);
    await expect(service.deleteDocumentForUser('admin-1', 'student-1', 'document-1'))
      .rejects.toThrow('database failure');
    expect(documentStorageRestore).toHaveBeenCalledWith('private.pdf', file);
  });

  it('creates a guardian only for an accessible student and normalizes email', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: null, hostelId: null, role: { name: 'SUPER_ADMIN' },
    }]);
    await service.createGuardianForUser('root', 'student-1', {
      name: 'Parent', relationship: 'Mother', email: 'PARENT@example.com', phone: '12345',
    });
    expect(guardianCreate).toHaveBeenCalledWith({
      data: {
        studentId: 'student-1', name: 'Parent', relationship: 'Mother',
        email: 'parent@example.com', phone: '12345',
      },
      select: { id: true, name: true, relationship: true, email: true, phone: true },
    });
  });

  it('hides guardian records for students outside scope or archived organizations', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    studentFindFirst.mockResolvedValueOnce(null);
    await expect(service.listGuardiansForUser('admin-1', 'other-student'))
      .rejects.toBeInstanceOf(NotFoundException);
    studentFindFirst.mockResolvedValueOnce(null);
    await expect(service.createGuardianForUser('admin-1', 'other-student', {
      name: 'Parent', phone: '12345',
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(guardianFindMany).not.toHaveBeenCalled();
    expect(guardianCreate).not.toHaveBeenCalled();
  });

  it('archives an active student atomically only when no allocation is active', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    studentUpdateMany.mockResolvedValueOnce({ count: 1 });
    const result = await service.archiveForUser('admin-1', 'student-1');
    expect(studentUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'student-1',
        archivedAt: null,
        organization: { archivedAt: null },
        organizationId: { in: ['org-1'] },
        allocations: { none: { endedAt: null } },
      },
      data: { archivedAt: expect.any(Date) },
    });
    expect(result).toMatchObject({ id: 'student-1', archivedAt: expect.any(Date) });
  });

  it('reports active allocations as a conflict and hides out-of-scope students', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    studentUpdateMany.mockResolvedValueOnce({ count: 0 });
    studentFindFirst.mockResolvedValueOnce({ id: 'student-1' });
    await expect(service.archiveForUser('admin-1', 'student-1'))
      .rejects.toBeInstanceOf(ConflictException);

    studentUpdateMany.mockResolvedValueOnce({ count: 0 });
    studentFindFirst.mockResolvedValueOnce(null);
    await expect(service.archiveForUser('admin-1', 'other-student'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates a guardian only under the authorized student and normalizes email', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    await expect(service.updateGuardianForUser('admin-1', 'student-1', 'guardian-1', {
      email: 'PARENT@example.com', relationship: null,
    })).resolves.toMatchObject({ id: 'guardian-1' });
    expect(guardianUpdateMany).toHaveBeenCalledWith({
      where: { id: 'guardian-1', studentId: 'student-1' },
      data: { email: 'parent@example.com', relationship: null },
    });
    expect(guardianFindFirst).toHaveBeenCalledWith({
      where: { id: 'guardian-1', studentId: 'student-1' },
      select: { id: true, name: true, relationship: true, email: true, phone: true },
    });
  });

  it('hides guardian IDs that do not belong to the selected student', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    guardianUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.updateGuardianForUser('admin-1', 'student-1', 'other-guardian', {
      name: 'Changed',
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(guardianFindFirst).not.toHaveBeenCalled();
  });
});
