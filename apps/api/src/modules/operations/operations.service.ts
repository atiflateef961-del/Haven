import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CreateComplaintDto, UpdateComplaintDto } from './complaint.dto.js';
import type { CreateMaintenanceDto, UpdateMaintenanceDto } from './maintenance.dto.js';
import type { CreateMessScheduleDto, UpdateMessScheduleDto } from './mess.dto.js';
import type { CreateVisitorDto } from './visitor.dto.js';

type Assignment = { organizationId: string | null; hostelId: string | null; role: { name: string }; hostel: { id: string; organizationId: string } | null };
type Scope = { global: boolean; organizationIds: string[]; organizationWideIds: string[]; hostelIds: string[] };

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  async createComplaint(userId: string, input: CreateComplaintDto) {
    const student = await this.prisma.student.findFirst({
      where: { userId, archivedAt: null, organization: { archivedAt: null } },
      select: { id: true, organizationId: true },
    });
    if (!student) throw new NotFoundException('Active student profile not found');
    const complaint = await this.prisma.complaint.create({
      data: { studentId: student.id, title: input.title, description: input.description },
      select: { id: true, title: true, description: true, status: true, createdAt: true },
    });
    const recipients = await this.prisma.userRole.findMany({
      where: { organizationId: student.organizationId, role: { name: { in: ['HOSTEL_ADMIN', 'WARDEN'] } } },
      select: { userId: true },
    });
    await Promise.all([...new Set(recipients.map((recipient) => recipient.userId))].map((recipientId) =>
      this.notifications.create({
        userId: recipientId, organizationId: student.organizationId,
        title: 'New student complaint', body: `${input.title} was submitted by a student.`,
      }),
    ));
    return complaint;
  }

  async listComplaints(userId: string) {
    let scope: Scope;
    try {
      scope = await this.getScope(userId);
    } catch (error) {
      if (!(error instanceof ForbiddenException)) throw error;
      const student = await this.prisma.student.findFirst({
        where: { userId, archivedAt: null, organization: { archivedAt: null } }, select: { id: true },
      });
      if (!student) throw error;
      const complaints = await this.prisma.complaint.findMany({
        where: { studentId: student.id }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 100,
        select: { id: true, title: true, description: true, status: true, assignedStaffId: true, createdAt: true, updatedAt: true },
      });
      return { complaints, staff: [], canManage: false, canSubmit: true };
    }
    const fullOrganizationIds = scope.global ? scope.organizationIds : scope.organizationWideIds;
    const staffScope = [
      ...(fullOrganizationIds.length ? [{ organizationId: { in: fullOrganizationIds } }] : []),
      ...(scope.hostelIds.length ? [{ hostelAssignments: { some: { hostelId: { in: scope.hostelIds } } } }] : []),
    ];
    const [complaints, staff] = await Promise.all([
      this.prisma.complaint.findMany({
        where: { student: { archivedAt: null, organization: { archivedAt: null }, ...this.studentScope(scope) } },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 100,
        select: {
          id: true, title: true, description: true, status: true, assignedStaffId: true, createdAt: true, updatedAt: true,
          student: { select: { id: true, organizationId: true, studentNumber: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.staff.findMany({
        where: { archivedAt: null, OR: staffScope }, orderBy: [{ employeeNumber: 'asc' }, { id: 'asc' }], take: 100,
        select: { id: true, organizationId: true, employeeNumber: true, jobTitle: true, user: { select: { firstName: true, lastName: true } } },
      }),
    ]);
    return { complaints, staff, canManage: true, canSubmit: false };
  }

  async updateComplaint(userId: string, complaintId: string, input: UpdateComplaintDto) {
    const scope = await this.getScope(userId);
    const where = { id: complaintId, student: { archivedAt: null, organization: { archivedAt: null }, ...this.studentScope(scope) } };
    const existing = await this.prisma.complaint.findFirst({
      where, select: { id: true, status: true, assignedStaffId: true, student: { select: { organizationId: true, userId: true } } },
    });
    if (!existing) throw new NotFoundException('Complaint not found');
    if (input.status && input.status !== existing.status) {
      const transitions: Record<string, string[]> = { OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'], IN_PROGRESS: ['RESOLVED', 'CLOSED'], RESOLVED: ['CLOSED'], CLOSED: [] };
      if (!transitions[existing.status]?.includes(input.status)) throw new ConflictException('This complaint status transition is not allowed');
    }
    if (input.assignedStaffId) {
      const assignee = await this.prisma.staff.findFirst({
        where: { id: input.assignedStaffId, archivedAt: null, organizationId: existing.student.organizationId }, select: { id: true },
      });
      if (!assignee) throw new NotFoundException('Staff member is not in the complaint organization');
    }
    const updated = await this.prisma.complaint.update({
      where: { id: complaintId },
      data: { status: input.status, assignedStaffId: input.assignedStaffId },
      select: { id: true, title: true, status: true, assignedStaffId: true, updatedAt: true },
    });
    if (existing.student.userId && (input.status || input.assignedStaffId !== undefined)) {
      const assigned = input.assignedStaffId !== undefined;
      await this.notifications.create({
        userId: existing.student.userId, organizationId: existing.student.organizationId,
        title: assigned ? 'Complaint assignment updated' : 'Complaint status updated',
        body: assigned ? 'A staff member updated the assignment for your complaint.' : `Your complaint status is now ${updated.status}.`,
      });
    }
    return updated;
  }

  async listMaintenance(userId: string) {
    const scope = await this.getScope(userId);
    const hostelIds = await this.getAllowedHostelIds(scope);
    if (hostelIds.length === 0) return { requests: [], hostels: [], staff: [], complaints: [] };
    const [requests, hostels, staff, complaints] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where: { hostelId: { in: hostelIds } }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 100,
        select: {
          id: true, hostelId: true, title: true, description: true, status: true, complaintId: true, assigneeId: true, createdAt: true, updatedAt: true,
          complaint: { select: { title: true, student: { select: { userId: true, firstName: true, lastName: true, studentNumber: true } } } },
          assignee: { select: { user: { select: { firstName: true, lastName: true } }, employeeNumber: true } },
          hostel: { select: { name: true } },
        },
      }),
      this.prisma.hostel.findMany({ where: { id: { in: hostelIds } }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, organizationId: true, name: true } }),
      this.prisma.staff.findMany({
        where: { archivedAt: null, organizationId: { in: scope.organizationIds }, hostelAssignments: { some: { hostelId: { in: hostelIds } } } },
        orderBy: [{ employeeNumber: 'asc' }, { id: 'asc' }], select: {
          id: true, employeeNumber: true,
          user: { select: { firstName: true, lastName: true } },
          hostelAssignments: { select: { hostelId: true } },
        },
      }),
      this.prisma.complaint.findMany({
        where: {
          student: {
            archivedAt: null,
            organization: { archivedAt: null, id: { in: scope.organizationIds } },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 100,
        select: { id: true, title: true, student: { select: { organizationId: true } } },
      }),
    ]);
    return { requests, hostels, staff, complaints };
  }

  async createMaintenance(userId: string, input: CreateMaintenanceDto) {
    const scope = await this.getScope(userId);
    const allowedHostelIds = await this.getAllowedHostelIds(scope);
    if (!allowedHostelIds.includes(input.hostelId)) throw new NotFoundException('Hostel is outside the assigned operations scope');
    const hostel = await this.prisma.hostel.findFirst({
      where: { id: input.hostelId, archivedAt: null }, select: { id: true, organizationId: true, name: true },
    });
    if (!hostel) throw new NotFoundException('Hostel is outside the assigned operations scope');
    let complaint = null as { id: string; student: { userId: string | null } } | null;
    if (input.complaintId) {
      complaint = await this.prisma.complaint.findFirst({
        where: { id: input.complaintId, student: { organizationId: hostel.organizationId, archivedAt: null } },
        select: { id: true, student: { select: { userId: true } } },
      });
      if (!complaint) throw new NotFoundException('Complaint is not in the selected hostel organization');
    }
    let assigneeId = input.assigneeId ?? null;
    if (assigneeId) {
      const assignee = await this.prisma.staff.findFirst({
        where: { id: assigneeId, archivedAt: null, organizationId: hostel.organizationId, hostelAssignments: { some: { hostelId: hostel.id } } },
        select: { id: true, userId: true },
      });
      if (!assignee) throw new NotFoundException('Staff member is not assigned to the selected hostel');
      assigneeId = assignee.id;
    }
    const request = await this.prisma.maintenanceRequest.create({
      data: { hostelId: hostel.id, complaintId: complaint?.id ?? null, assigneeId, title: input.title, description: input.description, status: assigneeId ? 'ASSIGNED' : 'OPEN' },
      select: { id: true, hostelId: true, title: true, status: true, complaintId: true, assigneeId: true, createdAt: true },
    });
    if (complaint?.student.userId) await this.notifications.create({
      userId: complaint.student.userId, organizationId: hostel.organizationId,
      title: 'Maintenance request created', body: `${input.title} has been recorded for your complaint.`,
    });
    if (assigneeId) {
      const assignee = await this.prisma.staff.findFirst({ where: { id: assigneeId, archivedAt: null }, select: { userId: true } });
      if (assignee) await this.notifications.create({
        userId: assignee.userId, organizationId: hostel.organizationId,
        title: 'Maintenance request assigned', body: `${input.title} was assigned to you.`,
      });
    }
    return request;
  }

  async updateMaintenance(userId: string, requestId: string, input: UpdateMaintenanceDto) {
    const scope = await this.getScope(userId);
    const hostelIds = await this.getAllowedHostelIds(scope);
    const existing = await this.prisma.maintenanceRequest.findFirst({
      where: { id: requestId, hostelId: { in: hostelIds } },
      select: {
        id: true, status: true, title: true, hostelId: true, assigneeId: true,
        hostel: { select: { organizationId: true } },
        complaint: { select: { student: { select: { userId: true } } } },
        assignee: { select: { userId: true } },
      },
    });
    if (!existing) throw new NotFoundException('Maintenance request not found');
    if (!existing.hostel || !existing.hostelId) throw new NotFoundException('Maintenance request has no active hostel scope');
    const requestHostel = existing.hostel;
    const requestHostelId = existing.hostelId;
    const status = input.status ?? (input.assigneeId ? 'ASSIGNED' : undefined);
    if (status && status !== existing.status) {
      const transitions: Record<string, string[]> = { OPEN: ['ASSIGNED', 'CANCELLED'], ASSIGNED: ['IN_PROGRESS', 'CANCELLED'], IN_PROGRESS: ['COMPLETED', 'CANCELLED'], COMPLETED: [], CANCELLED: [] };
      if (!transitions[existing.status]?.includes(status)) throw new ConflictException('This maintenance status transition is not allowed');
    }
    const assigneeId = input.assigneeId === undefined ? undefined : input.assigneeId;
    let assigneeUserId: string | null = existing.assignee?.userId ?? null;
    if (assigneeId) {
      const assignee = await this.prisma.staff.findFirst({
        where: { id: assigneeId, archivedAt: null, organizationId: requestHostel.organizationId, hostelAssignments: { some: { hostelId: requestHostelId } } }, select: { id: true, userId: true },
      });
      if (!assignee) throw new NotFoundException('Staff member is not assigned to this hostel');
      assigneeUserId = assignee.userId;
    }
    const updated = await this.prisma.maintenanceRequest.update({
      where: { id: requestId }, data: { status, assigneeId },
      select: { id: true, title: true, status: true, assigneeId: true, updatedAt: true },
    });
    const recipientIds = [...new Set([existing.complaint?.student.userId, input.assigneeId !== undefined ? assigneeUserId : null].filter((id): id is string => Boolean(id)))];
    await Promise.all(recipientIds.map((recipientId) => this.notifications.create({
      userId: recipientId, organizationId: requestHostel.organizationId,
      title: input.assigneeId !== undefined ? 'Maintenance assignment updated' : 'Maintenance status updated',
      body: `Maintenance request “${existing.title}” is now ${updated.status}.`,
    })));
    return updated;
  }

  async listMess(userId: string) {
    const scope = await this.getScope(userId);
    const hostelIds = await this.getAllowedHostelIds(scope);
    if (hostelIds.length === 0) return { schedules: [], hostels: [], students: [] };
    const [schedules, hostels, residentRecords] = await Promise.all([
      this.prisma.messSchedule.findMany({
        where: { hostelId: { in: hostelIds } }, orderBy: [{ startsAt: 'desc' }, { id: 'asc' }], take: 100,
        select: {
          id: true, hostelId: true, mealType: true, startsAt: true, endsAt: true, menu: true,
          hostel: { select: { name: true } },
          attendance: { select: { studentId: true, attendedAt: true } },
        },
      }),
      this.prisma.hostel.findMany({ where: { id: { in: hostelIds } }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true } }),
      this.prisma.student.findMany({
        where: {
          archivedAt: null, organization: { archivedAt: null }, ...this.studentScope(scope),
          allocations: { some: { status: 'ACTIVE', endedAt: null, bed: { room: { floor: { building: { hostelId: { in: hostelIds } } } } } } },
        }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }], take: 200,
        select: {
          id: true, studentNumber: true, firstName: true, lastName: true,
          allocations: {
            where: { status: 'ACTIVE', endedAt: null, bed: { room: { floor: { building: { hostelId: { in: hostelIds } } } } } },
            select: {
              bed: {
                select: {
                  room: {
                    select: {
                      floor: {
                        select: {
                          building: { select: { hostelId: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);
    const students = residentRecords.map(({ allocations, ...student }) => ({
      ...student,
      hostelIds: [...new Set(allocations.map(({ bed }) => bed.room.floor.building.hostelId))],
    }));
    return { schedules, hostels, students };
  }

  async createMessSchedule(userId: string, input: CreateMessScheduleDto) {
    const scope = await this.getScope(userId);
    const hostelIds = await this.getAllowedHostelIds(scope);
    if (!hostelIds.includes(input.hostelId)) throw new NotFoundException('Hostel is outside the assigned operations scope');
    return this.prisma.messSchedule.create({
      data: {
        hostelId: input.hostelId, mealType: input.mealType, startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt), menu: input.menu ?? null,
      },
      select: { id: true, hostelId: true, mealType: true, startsAt: true, endsAt: true, menu: true },
    });
  }

  async updateMessSchedule(userId: string, scheduleId: string, input: UpdateMessScheduleDto) {
    const scope = await this.getScope(userId);
    const hostelIds = await this.getAllowedHostelIds(scope);
    const existing = await this.prisma.messSchedule.findFirst({
      where: { id: scheduleId, hostelId: { in: hostelIds } }, select: { id: true, startsAt: true, endsAt: true },
    });
    if (!existing) throw new NotFoundException('Mess schedule not found');
    const startsAt = input.startsAt ? new Date(input.startsAt) : existing.startsAt;
    const endsAt = input.endsAt ? new Date(input.endsAt) : existing.endsAt;
    if (endsAt <= startsAt) throw new BadRequestException('End time must be after start time');
    return this.prisma.messSchedule.update({
      where: { id: scheduleId },
      data: { startsAt: input.startsAt ? startsAt : undefined, endsAt: input.endsAt ? endsAt : undefined, menu: input.menu },
      select: { id: true, hostelId: true, mealType: true, startsAt: true, endsAt: true, menu: true },
    });
  }

  async markMealAttendance(userId: string, scheduleId: string, studentId: string) {
    const scope = await this.getScope(userId);
    const hostelIds = await this.getAllowedHostelIds(scope);
    const schedule = await this.prisma.messSchedule.findFirst({
      where: { id: scheduleId, hostelId: { in: hostelIds } }, select: { id: true, hostelId: true },
    });
    if (!schedule) throw new NotFoundException('Mess schedule not found');
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId, archivedAt: null, organization: { archivedAt: null }, ...this.studentScope(scope),
        allocations: { some: { status: 'ACTIVE', endedAt: null, bed: { room: { floor: { building: { hostelId: schedule.hostelId } } } } } },
      }, select: { id: true },
    });
    if (!student) throw new NotFoundException('Student is not an active resident of this hostel');
    return this.prisma.mealAttendance.upsert({
      where: { studentId_messScheduleId: { studentId: student.id, messScheduleId: schedule.id } },
      create: { studentId: student.id, messScheduleId: schedule.id }, update: {},
      select: { id: true, studentId: true, messScheduleId: true, attendedAt: true },
    });
  }

  async createVisitor(userId: string, input: CreateVisitorDto) {
    const scope = await this.getScope(userId);
    const student = await this.prisma.student.findFirst({
      where: { id: input.studentId, archivedAt: null, organization: { archivedAt: null }, ...this.studentScope(scope) },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student is not available in your assigned hostel scope');
    return this.prisma.$transaction(async (transaction) => {
      const visitor = await transaction.visitor.create({
        data: { name: input.name, phone: input.phone ?? null }, select: { id: true },
      });
      return transaction.visitorRequest.create({
        data: {
          visitorId: visitor.id, studentId: student.id, purpose: input.purpose,
          visitAt: new Date(input.visitAt), status: 'APPROVED',
        },
        select: {
          id: true, visitAt: true, purpose: true, status: true,
          visitor: { select: { name: true, phone: true } },
          student: { select: { id: true, studentNumber: true, firstName: true, lastName: true } },
        },
      });
    });
  }

  async listVisitors(userId: string) {
    const scope = await this.getScope(userId);
    const [visits, students] = await Promise.all([this.prisma.visitorRequest.findMany({
      where: { student: { archivedAt: null, organization: { archivedAt: null }, ...this.studentScope(scope) } },
      orderBy: [{ visitAt: 'desc' }, { id: 'asc' }], take: 100,
      select: {
        id: true, visitAt: true, purpose: true, status: true,
        visitor: { select: { name: true, phone: true } },
        student: { select: { id: true, studentNumber: true, firstName: true, lastName: true } },
      },
    }), this.prisma.student.findMany({
      where: { archivedAt: null, organization: { archivedAt: null }, ...this.studentScope(scope) },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }], take: 100,
      select: { id: true, studentNumber: true, firstName: true, lastName: true },
    })]);
    return { visits, students };
  }

  private studentScope(scope: Scope) {
    if (scope.global) return { organizationId: { in: scope.organizationIds } };
    const or: Record<string, unknown>[] = [];
    if (scope.organizationWideIds.length > 0) or.push({ organizationId: { in: scope.organizationWideIds } });
    if (scope.hostelIds.length > 0) or.push({
      allocations: {
        some: {
          status: 'ACTIVE', endedAt: null,
          bed: { room: { floor: { building: { hostelId: { in: scope.hostelIds } } } } },
        },
      },
    });
    return { OR: or };
  }

  private async getAllowedHostelIds(scope: Scope) {
    const or: Record<string, unknown>[] = [];
    if (scope.global) or.push({ organizationId: { in: scope.organizationIds } });
    else {
      if (scope.organizationWideIds.length) or.push({ organizationId: { in: scope.organizationWideIds } });
      if (scope.hostelIds.length) or.push({ id: { in: scope.hostelIds } });
    }
    if (or.length === 0) return [];
    const hostels = await this.prisma.hostel.findMany({ where: { archivedAt: null, OR: or }, select: { id: true } });
    return hostels.map((hostel) => hostel.id);
  }

  private async getScope(userId: string): Promise<Scope> {
    const assignments = await this.prisma.userRole.findMany({
      where: { userId, role: { name: { in: ['SUPER_ADMIN', 'HOSTEL_ADMIN', 'WARDEN'] } } },
      select: { organizationId: true, hostelId: true, role: { select: { name: true } }, hostel: { select: { id: true, organizationId: true } } },
    }) as Assignment[];
    const global = assignments.some((item) => item.role.name === 'SUPER_ADMIN' && item.organizationId === null && item.hostelId === null);
    const organizationWideIds = [...new Set(assignments.filter((item) =>
      ['SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(item.role.name) && item.organizationId && !item.hostelId,
    ).map((item) => item.organizationId as string))];
    const hostelAssignments = assignments.filter((item) => item.role.name === 'WARDEN' && item.hostel);
    const hostelIds = [...new Set(hostelAssignments.map((item) => item.hostel!.id))];
    const organizationIds = [...new Set([
      ...organizationWideIds,
      ...hostelAssignments.map((item) => item.hostel!.organizationId),
    ])];
    if (!global && organizationIds.length === 0) throw new ForbiddenException('Visitor access is not assigned to this account');
    if (global) {
      const organizations = await this.prisma.organization.findMany({ where: { archivedAt: null }, select: { id: true } });
      return { global: true, organizationIds: organizations.map((item) => item.id), organizationWideIds: [], hostelIds: [] };
    }
    return { global: false, organizationIds, organizationWideIds, hostelIds };
  }
}
