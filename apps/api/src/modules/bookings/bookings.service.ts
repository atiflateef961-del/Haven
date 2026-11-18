import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { StudentsListDto } from '../students/students-list.dto.js';
import type { ApproveBookingDto } from './approve-booking.dto.js';
import type { AllocationEventDto, TransferAllocationDto } from './allocation-event.dto.js';
import { localDateStart } from './booking-date.js';

type BookingRoleAssignment = {
  organizationId: string | null;
  hostelId: string | null;
  role: { name: string };
};

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string, pagination: StudentsListDto) {
    const assignments = await this.prisma.userRole.findMany({
      where: { userId, role: { name: { in: ['SUPER_ADMIN', 'HOSTEL_ADMIN'] } } },
      select: { organizationId: true, hostelId: true, role: { select: { name: true } } },
    }) as BookingRoleAssignment[];

    const globalAccess = assignments.some((assignment) =>
      assignment.role.name === 'SUPER_ADMIN' && assignment.organizationId === null && assignment.hostelId === null,
    );
    const organizationIds = [...new Set(assignments.filter((assignment) =>
      ['SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(assignment.role.name) &&
      assignment.organizationId !== null && assignment.hostelId === null,
    ).map((assignment) => assignment.organizationId as string))];

    if (!globalAccess && organizationIds.length === 0) {
      throw new ForbiddenException('Booking review is not assigned to this account');
    }

    const rows = await this.prisma.booking.findMany({
      where: {
        student: {
          archivedAt: null,
          organization: {
            archivedAt: null,
            ...(globalAccess ? {} : { id: { in: organizationIds } }),
          },
        },
      },
      select: {
        id: true,
        requestedFrom: true,
        requestedUntil: true,
        status: true,
        notes: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            studentNumber: true,
            firstName: true,
            lastName: true,
            organization: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize + 1,
    });
    const hasMore = rows.length > pagination.pageSize;
    return {
      bookings: rows.slice(0, pagination.pageSize),
      page: pagination.page,
      pageSize: pagination.pageSize,
      hasMore,
    };
  }

  async approveForUser(userId: string, bookingId: string, input: ApproveBookingDto) {
    const scope = await this.getOrganizationScope(userId);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const booking = await transaction.booking.findFirst({
          where: {
            id: bookingId,
            status: 'REQUESTED',
            student: {
              archivedAt: null,
              organization: {
                archivedAt: null,
                ...(scope.globalAccess ? {} : { id: { in: scope.organizationIds } }),
              },
            },
          },
          select: {
            id: true,
            studentId: true,
            requestedFrom: true,
            requestedUntil: true,
            student: { select: { organization: { select: { id: true, timezone: true } } } },
          },
        });
        if (!booking) throw new NotFoundException('Booking request not found');

        const bed = await transaction.bed.findFirst({
          where: {
            id: input.bedId,
            isActive: true,
            room: {
              archivedAt: null,
              floor: {
                building: {
                  hostel: {
                    archivedAt: null,
                    organization: {
                      id: booking.student.organization.id,
                      archivedAt: null,
                    },
                  },
                },
              },
            },
          },
          select: { id: true },
        });
        if (!bed) throw new NotFoundException('Active bed not found');

        const startsAt = localDateStart(booking.requestedFrom, booking.student.organization.timezone);
        const endsAt = booking.requestedUntil
          ? localDateStart(booking.requestedUntil, booking.student.organization.timezone)
          : null;
        const allocation = await transaction.bedAllocation.create({
          data: {
            bookingId: booking.id,
            studentId: booking.studentId,
            bedId: bed.id,
            startsAt,
            endsAt,
          },
          select: { id: true, studentId: true, bedId: true, startsAt: true, endsAt: true, status: true },
        });
        const updated = await transaction.booking.updateMany({
          where: { id: booking.id, status: 'REQUESTED' },
          data: { status: 'APPROVED' },
        });
        if (updated.count !== 1) throw new ConflictException('Booking request has already been reviewed');
        return { bookingId: booking.id, status: 'APPROVED' as const, allocation };
      });
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      if (isAllocationOverlapError(error)) {
        throw new ConflictException('The requested bed or student has an overlapping active allocation');
      }
      throw error;
    }
  }

  async listAvailableBedsForUser(userId: string, bookingId: string, pagination: StudentsListDto) {
    const scope = await this.getOrganizationScope(userId);
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        status: 'REQUESTED',
        student: {
          archivedAt: null,
          organization: {
            archivedAt: null,
            ...(scope.globalAccess ? {} : { id: { in: scope.organizationIds } }),
          },
        },
      },
      select: {
        id: true,
        studentId: true,
        requestedFrom: true,
        requestedUntil: true,
        student: { select: { organization: { select: { id: true, timezone: true } } } },
      },
    });
    if (!booking) throw new NotFoundException('Booking request not found');

    const startsAt = localDateStart(booking.requestedFrom, booking.student.organization.timezone);
    const endsAt = booking.requestedUntil
      ? localDateStart(booking.requestedUntil, booking.student.organization.timezone)
      : null;
    const intervalOverlap = {
      status: 'ACTIVE' as const,
      endedAt: null,
      ...(endsAt ? { startsAt: { lt: endsAt } } : {}),
      OR: [{ endsAt: null }, { endsAt: { gt: startsAt } }],
    };
    const studentConflict = await this.prisma.bedAllocation.findFirst({
      where: { studentId: booking.studentId, ...intervalOverlap },
      select: { id: true },
    });
    if (studentConflict) {
      return { beds: [], page: pagination.page, pageSize: pagination.pageSize, hasMore: false };
    }

    const rows = await this.prisma.bed.findMany({
      where: {
        isActive: true,
        room: {
          archivedAt: null,
          floor: {
            building: {
              hostel: {
                archivedAt: null,
                organization: { id: booking.student.organization.id, archivedAt: null },
              },
            },
          },
        },
        allocations: { none: intervalOverlap },
      },
      select: {
        id: true,
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
      orderBy: [{ room: { number: 'asc' } }, { label: 'asc' }, { id: 'asc' }],
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize + 1,
    });
    const hasMore = rows.length > pagination.pageSize;
    return {
      beds: rows.slice(0, pagination.pageSize),
      page: pagination.page,
      pageSize: pagination.pageSize,
      hasMore,
    };
  }

  async rejectForUser(userId: string, bookingId: string) {
    const scope = await this.getOrganizationScope(userId);
    const bookingWhere = {
      id: bookingId,
      student: {
        archivedAt: null,
        organization: {
          archivedAt: null,
          ...(scope.globalAccess ? {} : { id: { in: scope.organizationIds } }),
        },
      },
    };
    const booking = await this.prisma.booking.findFirst({ where: bookingWhere, select: { id: true, status: true } });
    if (!booking) throw new NotFoundException('Booking request not found');
    if (booking.status !== 'REQUESTED') throw new ConflictException('Booking request has already been reviewed');
    const updated = await this.prisma.booking.updateMany({
      where: { ...bookingWhere, status: 'REQUESTED' },
      data: { status: 'REJECTED' },
    });
    if (updated.count !== 1) throw new ConflictException('Booking request has already been reviewed');
    return { id: booking.id, status: 'REJECTED' as const };
  }

  async checkInForUser(userId: string, allocationId: string, input: AllocationEventDto) {
    const scope = await this.getOrganizationScope(userId);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const allocation = await transaction.bedAllocation.findFirst({
          where: { id: allocationId, status: 'ACTIVE', endedAt: null, student: { archivedAt: null, organization: { archivedAt: null, ...(scope.globalAccess ? {} : { id: { in: scope.organizationIds } }) } } },
          select: { id: true },
        });
        if (!allocation) throw new NotFoundException('Active allocation not found');
        return transaction.checkIn.create({ data: { allocationId, notes: input.notes }, select: { id: true, allocationId: true, checkedInAt: true, notes: true } });
      });
    } catch (error) {
      if (isUniqueConflict(error)) throw new ConflictException('Allocation has already been checked in');
      throw error;
    }
  }

  async checkOutForUser(userId: string, allocationId: string, input: AllocationEventDto) {
    const scope = await this.getOrganizationScope(userId);
    const where = { id: allocationId, status: 'ACTIVE' as const, endedAt: null, student: { archivedAt: null, organization: { archivedAt: null, ...(scope.globalAccess ? {} : { id: { in: scope.organizationIds } }) } } };
    return this.prisma.$transaction(async (transaction) => {
      const allocation = await transaction.bedAllocation.findFirst({ where, select: { id: true } });
      if (!allocation) throw new NotFoundException('Active allocation not found');
      const checkedOutAt = new Date();
      const updated = await transaction.bedAllocation.updateMany({ where, data: { endedAt: checkedOutAt, status: 'COMPLETED' } });
      if (updated.count !== 1) throw new ConflictException('Allocation has already ended');
      return transaction.checkOut.create({ data: { allocationId, checkedOutAt, notes: input.notes }, select: { id: true, allocationId: true, checkedOutAt: true, notes: true } });
    });
  }

  async transferForUser(userId: string, allocationId: string, input: TransferAllocationDto) {
    const scope = await this.getOrganizationScope(userId);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const where = { id: allocationId, status: 'ACTIVE' as const, endedAt: null, student: { archivedAt: null, organization: { archivedAt: null, ...(scope.globalAccess ? {} : { id: { in: scope.organizationIds } }) } } };
        const current = await transaction.bedAllocation.findFirst({
          where,
          select: { id: true, bookingId: true, studentId: true, bedId: true, startsAt: true, endsAt: true, student: { select: { organizationId: true } } },
        });
        if (!current) throw new NotFoundException('Active allocation not found');
        if (current.bedId === input.bedId) throw new ConflictException('Choose a different bed for the transfer');
        const target = await transaction.bed.findFirst({
          where: { id: input.bedId, isActive: true, room: { archivedAt: null, floor: { building: { hostel: { archivedAt: null, organization: { id: current.student.organizationId, archivedAt: null } } } } } },
          select: { id: true },
        });
        if (!target) throw new NotFoundException('Active bed not found');

        const now = new Date();
        const futureAllocation = current.startsAt > now;
        const nextStartsAt = futureAllocation ? current.startsAt : now;
        if (current.endsAt && current.endsAt <= nextStartsAt) throw new ConflictException('Allocation has no remaining interval to transfer');
        const updated = await transaction.bedAllocation.updateMany({ where, data: futureAllocation
          ? { status: 'CANCELLED' }
          : { status: 'COMPLETED', endedAt: now },
        });
        if (updated.count !== 1) throw new ConflictException('Allocation has already changed');
        const replacement = await transaction.bedAllocation.create({
          data: { bookingId: current.bookingId, studentId: current.studentId, bedId: target.id, startsAt: nextStartsAt, endsAt: current.endsAt },
          select: { id: true, studentId: true, bedId: true, startsAt: true, endsAt: true, status: true },
        });
        return { previousAllocationId: current.id, allocation: replacement };
      });
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      if (isAllocationOverlapError(error)) throw new ConflictException('The target bed or student has an overlapping active allocation');
      throw error;
    }
  }

  private async getOrganizationScope(userId: string) {
    const assignments = await this.prisma.userRole.findMany({
      where: { userId, role: { name: { in: ['SUPER_ADMIN', 'HOSTEL_ADMIN'] } } },
      select: { organizationId: true, hostelId: true, role: { select: { name: true } } },
    }) as BookingRoleAssignment[];
    const globalAccess = assignments.some((assignment) =>
      assignment.role.name === 'SUPER_ADMIN' && assignment.organizationId === null && assignment.hostelId === null,
    );
    const organizationIds = [...new Set(assignments.filter((assignment) =>
      ['SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(assignment.role.name) &&
      assignment.organizationId !== null && assignment.hostelId === null,
    ).map((assignment) => assignment.organizationId as string))];
    if (!globalAccess && organizationIds.length === 0) {
      throw new ForbiddenException('Booking review is not assigned to this account');
    }
    return { globalAccess, organizationIds };
  }
}

function isAllocationOverlapError(error: unknown) {
  if (typeof error !== 'object' || error === null) return false;
  const record = error as { code?: unknown; meta?: { code?: unknown; message?: unknown; database_error?: unknown } };
  const details = [record.meta?.message, record.meta?.database_error]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
  return record.code === '23P01' || record.meta?.code === '23P01' ||
    (record.code === 'P2004' && (details.includes('23P01') || details.toLowerCase().includes('exclusion constraint')));
}

function isUniqueConflict(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2002';
}
