import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CreateStaffDto, UpdateStaffDto } from './staff.dto.js';

type RoleAssignment = { organizationId: string | null; hostelId: string | null; role: { name: string }; hostel: { id: string; organizationId: string } | null };
type StaffScope = { global: boolean; canManage: boolean; organizationIds: string[]; organizationWideIds: string[]; hostelIds: string[] };

@Injectable()
export class StaffManagementService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  async list(userId: string) {
    const scope = await this.getScope(userId);
    const staffScope = [
      ...(scope.global || scope.organizationWideIds.length ? [{ organizationId: { in: scope.global ? scope.organizationIds : scope.organizationWideIds } }] : []),
      ...(scope.hostelIds.length ? [{ hostelAssignments: { some: { hostelId: { in: scope.hostelIds } } } }] : []),
    ];
    const [staff, organizations, hostels, users] = await Promise.all([
      this.prisma.staff.findMany({
        where: { archivedAt: null, OR: staffScope }, orderBy: [{ employeeNumber: 'asc' }, { id: 'asc' }], take: 200,
        select: {
          id: true, organizationId: true, userId: true, employeeNumber: true, jobTitle: true,
          user: { select: { firstName: true, lastName: true, email: true } },
          hostelAssignments: { select: { hostelId: true, hostel: { select: { name: true } } } },
        },
      }),
      this.prisma.organization.findMany({ where: { id: { in: scope.canManage ? (scope.global ? scope.organizationIds : scope.organizationWideIds) : [] }, archivedAt: null }, orderBy: [{ name: 'asc' }], select: { id: true, name: true } }),
      this.prisma.hostel.findMany({
        where: { organizationId: { in: scope.organizationIds }, archivedAt: null, OR: [
          ...(scope.global || scope.organizationWideIds.length ? [{ organizationId: { in: scope.global ? scope.organizationIds : scope.organizationWideIds } }] : []),
          ...(scope.hostelIds.length ? [{ id: { in: scope.hostelIds } }] : []),
        ] }, orderBy: [{ name: 'asc' }], select: { id: true, organizationId: true, name: true },
      }),
      scope.canManage ? this.prisma.user.findMany({
        where: { status: 'ACTIVE', staff: null, memberships: { some: { organizationId: { in: scope.global ? scope.organizationIds : scope.organizationWideIds } } } },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }], take: 200,
        select: { id: true, firstName: true, lastName: true, email: true, memberships: { select: { organizationId: true } } },
      }) : Promise.resolve([]),
    ]);
    return { staff, organizations, hostels, users, canManage: scope.canManage };
  }

  async create(userId: string, input: CreateStaffDto) {
    const scope = await this.getScope(userId);
    this.assertManager(scope);
    if (!scope.global && !scope.organizationWideIds.includes(input.organizationId)) throw new ForbiddenException('Staff creation is not assigned to this organization');
    const hostels = await this.prisma.hostel.findMany({
      where: { id: { in: input.hostelIds }, organizationId: input.organizationId, archivedAt: null }, select: { id: true },
    });
    if (hostels.length !== input.hostelIds.length) throw new NotFoundException('One or more selected hostels are not in this organization');
    const account = await this.prisma.user.findFirst({
      where: { id: input.userId, status: 'ACTIVE', staff: null, memberships: { some: { organizationId: input.organizationId } } }, select: { id: true },
    });
    if (!account) throw new NotFoundException('Select an active organization member without a staff profile');
    try {
      const staff = await this.prisma.staff.create({
        data: {
          organizationId: input.organizationId, userId: account.id,
          employeeNumber: input.employeeNumber, jobTitle: input.jobTitle,
          hostelAssignments: { create: input.hostelIds.map((hostelId) => ({ hostel: { connect: { id: hostelId } } })) },
        },
        select: { id: true, organizationId: true, userId: true, employeeNumber: true, jobTitle: true },
      });
      await this.notifications.create({ userId: staff.userId, organizationId: staff.organizationId, title: 'Staff profile created', body: `Your staff profile is active as ${staff.jobTitle}.` });
      return staff;
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw new ConflictException('The account or employee number already has a staff profile');
      throw error;
    }
  }

  async update(userId: string, staffId: string, input: UpdateStaffDto) {
    const scope = await this.getScope(userId);
    this.assertManager(scope);
    const existing = await this.prisma.staff.findFirst({
      where: { id: staffId, archivedAt: null, organizationId: { in: scope.global ? scope.organizationIds : scope.organizationWideIds } },
      select: { id: true, organizationId: true, userId: true },
    });
    if (!existing) throw new NotFoundException('Staff profile not found');
    if (input.hostelIds) {
      const hostels = await this.prisma.hostel.findMany({ where: { id: { in: input.hostelIds }, organizationId: existing.organizationId, archivedAt: null }, select: { id: true } });
      if (hostels.length !== input.hostelIds.length) throw new NotFoundException('One or more selected hostels are not in this organization');
    }
    let updated: { id: string; organizationId: string; userId: string; employeeNumber: string; jobTitle: string };
    try {
      updated = await this.prisma.$transaction(async (transaction) => {
        if (input.hostelIds) {
          await transaction.staffHostel.deleteMany({ where: { staffId } });
          if (input.hostelIds.length) await transaction.staffHostel.createMany({ data: input.hostelIds.map((hostelId) => ({ staffId, hostelId })), skipDuplicates: true });
        }
        return transaction.staff.update({
          where: { id: staffId }, data: { employeeNumber: input.employeeNumber, jobTitle: input.jobTitle },
          select: { id: true, organizationId: true, userId: true, employeeNumber: true, jobTitle: true },
        });
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw new ConflictException('That employee number is already in use in the organization');
      throw error;
    }
    await this.notifications.create({ userId: existing.userId, organizationId: existing.organizationId, title: 'Staff profile updated', body: 'Your staff profile or hostel assignments were updated.' });
    return updated;
  }

  async archive(userId: string, staffId: string) {
    const scope = await this.getScope(userId);
    this.assertManager(scope);
    const existing = await this.prisma.staff.findFirst({
      where: { id: staffId, archivedAt: null, organizationId: { in: scope.global ? scope.organizationIds : scope.organizationWideIds } },
      select: { id: true, organizationId: true },
    });
    if (!existing) throw new NotFoundException('Staff profile not found');
    const archivedAt = new Date();
    await this.prisma.staff.update({ where: { id: staffId }, data: { archivedAt }, select: { id: true } });
    return { id: staffId, archivedAt };
  }

  private assertManager(scope: StaffScope) {
    if (!scope.canManage) throw new ForbiddenException('Staff management requires an organization administrator role');
  }

  private async getScope(userId: string): Promise<StaffScope> {
    const assignments = await this.prisma.userRole.findMany({
      where: { userId, role: { name: { in: ['SUPER_ADMIN', 'HOSTEL_ADMIN', 'WARDEN'] } } },
      select: { organizationId: true, hostelId: true, role: { select: { name: true } }, hostel: { select: { id: true, organizationId: true } } },
    }) as RoleAssignment[];
    const global = assignments.some((item) => item.role.name === 'SUPER_ADMIN' && item.organizationId === null && item.hostelId === null);
    const organizationWideIds = [...new Set(assignments.filter((item) => ['SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(item.role.name) && item.organizationId && !item.hostelId).map((item) => item.organizationId as string))];
    const hostelAssignments = assignments.filter((item) => item.hostel);
    const hostelIds = [...new Set(hostelAssignments.map((item) => item.hostel!.id))];
    let organizationIds = [...new Set([...organizationWideIds, ...hostelAssignments.map((item) => item.hostel!.organizationId)])];
    if (global) organizationIds = (await this.prisma.organization.findMany({ where: { archivedAt: null }, select: { id: true } })).map((item) => item.id);
    if (!global && organizationIds.length === 0) throw new ForbiddenException('Staff access is not assigned to this account');
    return { global, canManage: global || organizationWideIds.length > 0, organizationIds, organizationWideIds, hostelIds };
  }
}
