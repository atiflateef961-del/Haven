import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { CreateStudentDto } from './create-student.dto.js';
import type { StudentsListDto } from './students-list.dto.js';
import type { UpdateStudentDto } from './update-student.dto.js';
import type { CreateGuardianDto, UpdateGuardianDto } from './guardian.dto.js';
import type { UpdateStudentSelfDto } from './update-student-self.dto.js';
import { StudentDocumentStorageService } from './student-document-storage.service.js';
import { StudentDocumentScannerService } from './student-document-scanner.service.js';
import type { CreateStudentBookingDto } from './create-student-booking.dto.js';
import type { AttendanceDto } from './attendance.dto.js';

type ValidatedDocument = { extension: 'pdf' | 'jpg' | 'png'; contentType: string };

function validateDocument(buffer: Buffer, declaredType: string): ValidatedDocument {
  const pdf = buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  const jpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (pdf && declaredType === 'application/pdf') return { extension: 'pdf', contentType: 'application/pdf' };
  if (jpeg && declaredType === 'image/jpeg') return { extension: 'jpg', contentType: 'image/jpeg' };
  if (png && declaredType === 'image/png') return { extension: 'png', contentType: 'image/png' };
  throw new BadRequestException('Upload must be a valid PDF, JPEG, or PNG file');
}

type StudentRoleAssignment = {
  organizationId: string | null;
  hostelId: string | null;
  role: { name: string };
};

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentStorage: StudentDocumentStorageService,
    private readonly documentScanner: StudentDocumentScannerService,
  ) {}

  async getMyProfile(userId: string) {
    const student = await this.prisma.student.findFirst({
      where: {
        userId,
        archivedAt: null,
        organization: { archivedAt: null },
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
      },
    });
    if (!student) throw new NotFoundException('Student profile not found');
    return student;
  }

  async createMyBooking(userId: string, input: CreateStudentBookingDto) {
    const student = await this.prisma.student.findFirst({
      where: { userId, archivedAt: null, organization: { archivedAt: null } },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student profile not found');

    return this.prisma.booking.create({
      data: {
        studentId: student.id,
        requestedFrom: new Date(`${input.requestedFrom}T00:00:00.000Z`),
        requestedUntil: input.requestedUntil ? new Date(`${input.requestedUntil}T00:00:00.000Z`) : null,
        notes: input.notes,
      },
      select: {
        id: true,
        requestedFrom: true,
        requestedUntil: true,
        status: true,
        notes: true,
        createdAt: true,
      },
    });
  }

  async listMyBookings(userId: string, pagination: StudentsListDto) {
    const student = await this.prisma.student.findFirst({
      where: { userId, archivedAt: null, organization: { archivedAt: null } },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student profile not found');

    const bookings = await this.prisma.booking.findMany({
      where: { studentId: student.id },
      select: {
        id: true,
        requestedFrom: true,
        requestedUntil: true,
        status: true,
        notes: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize + 1,
    });
    const hasMore = bookings.length > pagination.pageSize;
    return {
      bookings: bookings.slice(0, pagination.pageSize),
      page: pagination.page,
      pageSize: pagination.pageSize,
      hasMore,
    };
  }

  async cancelMyBooking(userId: string, bookingId: string) {
    const where = {
      id: bookingId,
      status: 'REQUESTED' as const,
      student: { userId, archivedAt: null, organization: { archivedAt: null } },
    };
    const result = await this.prisma.booking.updateMany({
      where,
      data: { status: 'CANCELLED' },
    });
    if (result.count === 1) return { id: bookingId, status: 'CANCELLED' as const };

    const existing = await this.prisma.booking.findFirst({
      where: { id: bookingId, student: { userId, archivedAt: null, organization: { archivedAt: null } } },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Booking request not found');
    throw new ConflictException('Only a pending booking request can be cancelled');
  }

  async updateMyProfile(userId: string, input: UpdateStudentSelfDto) {
    const scope = {
      userId,
      archivedAt: null,
      organization: { archivedAt: null },
    };
    const result = await this.prisma.student.updateMany({
      where: scope,
      data: {
        email: input.email === undefined ? undefined : input.email?.toLowerCase() ?? null,
        phone: input.phone,
      },
    });
    if (result.count !== 1) throw new NotFoundException('Student profile not found');

    const student = await this.prisma.student.findFirst({
      where: scope,
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
      },
    });
    if (!student) throw new NotFoundException('Student profile not found');
    return student;
  }

  async getMyRoomHistory(userId: string) {
    const student = await this.prisma.student.findFirst({
      where: { userId, archivedAt: null, organization: { archivedAt: null } },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student profile not found');

    const allocations = await this.prisma.bedAllocation.findMany({
      where: { studentId: student.id },
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
                      select: {
                        name: true,
                        hostel: { select: { name: true, code: true } },
                      },
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
    return { allocations };
  }

  async listForUser(userId: string, pagination: StudentsListDto) {
    const assignments = await this.prisma.userRole.findMany({
      where: {
        userId,
        role: { name: { in: ['SUPER_ADMIN', 'HOSTEL_ADMIN'] } },
      },
      select: {
        organizationId: true,
        hostelId: true,
        role: { select: { name: true } },
      },
    }) as StudentRoleAssignment[];

    const globalAccess = assignments.some((assignment) =>
      assignment.role.name === 'SUPER_ADMIN' &&
      assignment.organizationId === null && assignment.hostelId === null,
    );
    const organizationIds = [...new Set(assignments
      .filter((assignment) =>
        ['SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(assignment.role.name) &&
        assignment.organizationId !== null && assignment.hostelId === null,
      )
      .map((assignment) => assignment.organizationId as string))];

    if (!globalAccess && organizationIds.length === 0) {
      throw new ForbiddenException('Student access is not assigned to this account');
    }

    const rows = await this.prisma.student.findMany({
      where: {
        archivedAt: null,
        organization: { archivedAt: null },
        ...(globalAccess ? {} : { organizationId: { in: organizationIds } }),
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
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize + 1,
    });

    const hasMore = rows.length > pagination.pageSize;
    const creatableOrganizations = await this.prisma.organization.findMany({
      where: {
        archivedAt: null,
        ...(globalAccess ? {} : { id: { in: organizationIds } }),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return {
      students: hasMore ? rows.slice(0, pagination.pageSize) : rows,
      page: pagination.page,
      pageSize: pagination.pageSize,
      hasMore,
      creatableOrganizations,
    };
  }

  async createForUser(userId: string, input: CreateStudentDto) {
    const assignments = await this.prisma.userRole.findMany({
      where: {
        userId,
        role: { name: { in: ['SUPER_ADMIN', 'HOSTEL_ADMIN'] } },
      },
      select: {
        organizationId: true,
        hostelId: true,
        role: { select: { name: true } },
      },
    }) as StudentRoleAssignment[];

    const globalAccess = assignments.some((assignment) =>
      assignment.role.name === 'SUPER_ADMIN' &&
      assignment.organizationId === null && assignment.hostelId === null,
    );
    const organizationIds = new Set(assignments
      .filter((assignment) =>
        ['SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(assignment.role.name) &&
        assignment.organizationId !== null && assignment.hostelId === null,
      )
      .map((assignment) => assignment.organizationId as string));

    let organizationId = input.organizationId;
    if (!globalAccess) {
      if (organizationIds.size === 0) {
        throw new ForbiddenException('Student creation is not assigned to this account');
      }
      if (!organizationId && organizationIds.size === 1) {
        organizationId = [...organizationIds][0];
      }
      if (!organizationId) {
        throw new BadRequestException('organizationId is required when multiple organizations are assigned');
      }
      if (!organizationIds.has(organizationId)) {
        throw new ForbiddenException('Student creation is not assigned to this organization');
      }
    }
    if (!organizationId) {
      throw new BadRequestException('organizationId is required for a global administrator');
    }

    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, archivedAt: null },
      select: { id: true },
    });
    if (!organization) throw new NotFoundException('Active organization not found');

    try {
      return await this.prisma.student.create({
        data: {
          organizationId: organization.id,
          studentNumber: input.studentNumber,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email?.toLowerCase(),
          phone: input.phone,
          dateOfBirth: input.dateOfBirth ? new Date(`${input.dateOfBirth}T00:00:00.000Z`) : undefined,
          educationInstitution: input.educationInstitution,
          educationProgram: input.educationProgram,
          educationYear: input.educationYear,
          status: input.status,
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
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('A student with this number already exists in the organization');
      }
      throw error;
    }
  }

  async updateForUser(userId: string, studentId: string, input: UpdateStudentDto) {
    const assignments = await this.prisma.userRole.findMany({
      where: {
        userId,
        role: { name: { in: ['SUPER_ADMIN', 'HOSTEL_ADMIN'] } },
      },
      select: {
        organizationId: true,
        hostelId: true,
        role: { select: { name: true } },
      },
    }) as StudentRoleAssignment[];

    const globalAccess = assignments.some((assignment) =>
      assignment.role.name === 'SUPER_ADMIN' &&
      assignment.organizationId === null && assignment.hostelId === null,
    );
    const organizationIds = [...new Set(assignments
      .filter((assignment) =>
        ['SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(assignment.role.name) &&
        assignment.organizationId !== null && assignment.hostelId === null,
      )
      .map((assignment) => assignment.organizationId as string))];

    if (!globalAccess && organizationIds.length === 0) {
      throw new ForbiddenException('Student updates are not assigned to this account');
    }

    const scope = {
      id: studentId,
      archivedAt: null,
      organization: { archivedAt: null },
      ...(globalAccess ? {} : { organizationId: { in: organizationIds } }),
    };
    try {
      const result = await this.prisma.student.updateMany({
        where: scope,
        data: {
          ...input,
          email: input.email === undefined ? undefined : input.email?.toLowerCase() ?? null,
          dateOfBirth: input.dateOfBirth === undefined
            ? undefined
            : input.dateOfBirth === null ? null : new Date(`${input.dateOfBirth}T00:00:00.000Z`),
        },
      });
      if (result.count !== 1) throw new NotFoundException('Student not found');
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('A student with this number already exists in the organization');
      }
      throw error;
    }

    const student = await this.prisma.student.findFirst({
      where: scope,
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
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async markAttendanceForUser(userId: string, studentId: string, input: AttendanceDto) {
    const student = await this.getAccessibleStudentScope(userId, studentId);
    const attendanceDate = new Date(`${input.attendanceDate}T00:00:00.000Z`);
    const staff = await this.prisma.staff.findFirst({
      where: { userId, organizationId: student.organizationId },
      select: { id: true },
    });
    return this.prisma.attendance.upsert({
      where: { studentId_attendanceDate: { studentId, attendanceDate } },
      create: {
        studentId,
        attendanceDate,
        status: input.status,
        note: input.note ?? null,
        staffId: staff?.id ?? null,
      },
      update: { status: input.status, note: input.note ?? null, staffId: staff?.id ?? null },
      select: { id: true, studentId: true, attendanceDate: true, status: true, note: true },
    });
  }

  async listGuardiansForUser(userId: string, studentId: string) {
    const scope = await this.getAccessibleStudentScope(userId, studentId);
    const guardians = await this.prisma.guardian.findMany({
      where: { studentId: scope.id },
      select: { id: true, name: true, relationship: true, email: true, phone: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return { guardians };
  }

  async listDocumentsForUser(userId: string, studentId: string) {
    const scope = await this.getAccessibleStudentScope(userId, studentId);
    const documents = await this.prisma.studentDocument.findMany({
      where: { studentId: scope.id },
      select: { id: true, documentType: true, contentType: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return { documents };
  }

  async listRoomHistoryForUser(userId: string, studentId: string) {
    const student = await this.getAccessibleStudentScope(userId, studentId);
    const allocations = await this.prisma.bedAllocation.findMany({
      where: { studentId: student.id },
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
                      select: {
                        name: true,
                        hostel: { select: { name: true, code: true } },
                      },
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
    return { allocations };
  }

  async uploadDocumentForUser(
    userId: string,
    studentId: string,
    documentType: string,
    file: { buffer: Buffer; mimetype: string },
  ) {
    const student = await this.getAccessibleStudentScope(userId, studentId);
    const validated = validateDocument(file.buffer, file.mimetype);
    await this.documentScanner.scan(file.buffer);
    if (documentType.trim().toLowerCase() === 'student photograph' &&
      !['image/jpeg', 'image/png'].includes(validated.contentType)) {
      throw new BadRequestException('Student photographs must be JPEG or PNG images');
    }
    const objectKey = await this.documentStorage.write(file.buffer, validated.extension);
    try {
      return await this.prisma.studentDocument.create({
        data: {
          studentId: student.id,
          documentType: documentType.trim(),
          objectKey,
          contentType: validated.contentType,
        },
        select: { id: true, documentType: true, contentType: true, createdAt: true },
      });
    } catch (error) {
      await this.documentStorage.remove(objectKey);
      throw error;
    }
  }

  async readDocumentForUser(userId: string, studentId: string, documentId: string) {
    const student = await this.getAccessibleStudentScope(userId, studentId);
    const document = await this.prisma.studentDocument.findFirst({
      where: { id: documentId, studentId: student.id },
      select: { objectKey: true, contentType: true },
    });
    if (!document || !document.contentType) throw new NotFoundException('Student document not found');
    const buffer = await this.documentStorage.read(document.objectKey);
    return { buffer, contentType: document.contentType };
  }

  async deleteDocumentForUser(userId: string, studentId: string, documentId: string) {
    const student = await this.getAccessibleStudentScope(userId, studentId);
    const where = { id: documentId, studentId: student.id };
    const document = await this.prisma.studentDocument.findFirst({
      where,
      select: { objectKey: true },
    });
    if (!document) throw new NotFoundException('Student document not found');

    let originalFile: Buffer | null = null;
    try {
      originalFile = await this.documentStorage.read(document.objectKey);
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
    }
    await this.documentStorage.remove(document.objectKey);

    let result: { count: number };
    try {
      result = await this.prisma.studentDocument.deleteMany({ where });
    } catch (error) {
      if (originalFile) {
        try {
          await this.documentStorage.restore(document.objectKey, originalFile);
        } catch {
          throw new InternalServerErrorException('Document deletion could not be completed safely');
        }
      }
      throw error;
    }
    if (result.count !== 1) throw new NotFoundException('Student document not found');
    return { id: documentId, deleted: true };
  }

  async createGuardianForUser(userId: string, studentId: string, input: CreateGuardianDto) {
    const scope = await this.getAccessibleStudentScope(userId, studentId);
    return this.prisma.guardian.create({
      data: {
        studentId: scope.id,
        name: input.name,
        relationship: input.relationship,
        email: input.email?.toLowerCase(),
        phone: input.phone,
      },
      select: { id: true, name: true, relationship: true, email: true, phone: true },
    });
  }

  async updateGuardianForUser(
    userId: string,
    studentId: string,
    guardianId: string,
    input: UpdateGuardianDto,
  ) {
    const scope = await this.getAccessibleStudentScope(userId, studentId);
    const where = { id: guardianId, studentId: scope.id };
    const result = await this.prisma.guardian.updateMany({ where, data: {
      ...input,
      email: input.email === undefined ? undefined : input.email?.toLowerCase() ?? null,
    } });
    if (result.count !== 1) throw new NotFoundException('Guardian not found');

    const guardian = await this.prisma.guardian.findFirst({
      where,
      select: { id: true, name: true, relationship: true, email: true, phone: true },
    });
    if (!guardian) throw new NotFoundException('Guardian not found');
    return guardian;
  }

  private async getAccessibleStudentScope(userId: string, studentId: string) {
    const assignments = await this.prisma.userRole.findMany({
      where: {
        userId,
        role: { name: { in: ['SUPER_ADMIN', 'HOSTEL_ADMIN'] } },
      },
      select: {
        organizationId: true,
        hostelId: true,
        role: { select: { name: true } },
      },
    }) as StudentRoleAssignment[];
    const globalAccess = assignments.some((assignment) =>
      assignment.role.name === 'SUPER_ADMIN' &&
      assignment.organizationId === null && assignment.hostelId === null,
    );
    const organizationIds = [...new Set(assignments
      .filter((assignment) =>
        ['SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(assignment.role.name) &&
        assignment.organizationId !== null && assignment.hostelId === null,
      )
      .map((assignment) => assignment.organizationId as string))];

    if (!globalAccess && organizationIds.length === 0) {
      throw new ForbiddenException('Student access is not assigned to this account');
    }

    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        archivedAt: null,
        organization: { archivedAt: null },
        ...(globalAccess ? {} : { organizationId: { in: organizationIds } }),
      },
      select: { id: true, organizationId: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async archiveForUser(userId: string, studentId: string) {
    const assignments = await this.prisma.userRole.findMany({
      where: {
        userId,
        role: { name: { in: ['SUPER_ADMIN', 'HOSTEL_ADMIN'] } },
      },
      select: {
        organizationId: true,
        hostelId: true,
        role: { select: { name: true } },
      },
    }) as StudentRoleAssignment[];
    const globalAccess = assignments.some((assignment) =>
      assignment.role.name === 'SUPER_ADMIN' &&
      assignment.organizationId === null && assignment.hostelId === null,
    );
    const organizationIds = [...new Set(assignments
      .filter((assignment) =>
        ['SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(assignment.role.name) &&
        assignment.organizationId !== null && assignment.hostelId === null,
      )
      .map((assignment) => assignment.organizationId as string))];
    if (!globalAccess && organizationIds.length === 0) {
      throw new ForbiddenException('Student archiving is not assigned to this account');
    }

    const scope = {
      id: studentId,
      archivedAt: null,
      organization: { archivedAt: null },
      ...(globalAccess ? {} : { organizationId: { in: organizationIds } }),
    };
    const archivedAt = new Date();
    const result = await this.prisma.student.updateMany({
      where: { ...scope, allocations: { none: { endedAt: null } } },
      data: { archivedAt },
    });
    if (result.count !== 1) {
      const student = await this.prisma.student.findFirst({
        where: scope,
        select: { id: true },
      });
      if (!student) throw new NotFoundException('Student not found');
      throw new ConflictException('A student with an active bed allocation cannot be archived');
    }

    return { id: studentId, archivedAt };
  }
}
