import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { CreateHostelDto } from './create-hostel.dto.js';
import type { UpdateHostelDto } from './update-hostel.dto.js';

type HostelRoleAssignment = {
  organizationId: string | null;
  hostelId: string | null;
  role: { name: string };
};

@Injectable()
export class HostelsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    const assignments = await this.prisma.userRole.findMany({
      where: {
        userId,
        role: { name: { in: ['SUPER_ADMIN', 'HOSTEL_ADMIN', 'WARDEN'] } },
      },
      select: {
        organizationId: true,
        hostelId: true,
        role: { select: { name: true } },
      },
    }) as HostelRoleAssignment[];

    const globalAccess = assignments.some((assignment) =>
      assignment.role.name === 'SUPER_ADMIN' &&
      assignment.organizationId === null && assignment.hostelId === null,
    );
    const organizationIds = new Set<string>();
    const hostelIds = new Set<string>();

    for (const assignment of assignments) {
      if (
        (assignment.role.name === 'HOSTEL_ADMIN' || assignment.role.name === 'SUPER_ADMIN') &&
        assignment.organizationId && !assignment.hostelId
      ) {
        organizationIds.add(assignment.organizationId);
      } else if (assignment.hostelId) {
        hostelIds.add(assignment.hostelId);
      }
    }

    if (!globalAccess && organizationIds.size === 0 && hostelIds.size === 0) {
      throw new ForbiddenException('Hostel access is not assigned to this account');
    }

    const hostels = await this.prisma.hostel.findMany({
      where: {
        organization: { archivedAt: null },
        archivedAt: null,
        ...(globalAccess
          ? {}
          : {
              OR: [
                ...(organizationIds.size > 0
                  ? [{ organizationId: { in: [...organizationIds] } }]
                  : []),
                ...(hostelIds.size > 0
                  ? [{ id: { in: [...hostelIds] } }]
                  : []),
              ],
            }),
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        code: true,
        address: true,
        createdAt: true,
        organization: { select: { name: true } },
      },
      orderBy: [{ organization: { name: 'asc' } }, { name: 'asc' }],
    });
    const creatableOrganizationIds = new Set(assignments
      .filter((assignment) =>
        assignment.role.name === 'HOSTEL_ADMIN' &&
        assignment.organizationId !== null && assignment.hostelId === null,
      )
      .map((assignment) => assignment.organizationId as string));
    const creatableOrganizations = globalAccess || creatableOrganizationIds.size > 0
      ? await this.prisma.organization.findMany({
          where: {
            archivedAt: null,
            ...(globalAccess ? {} : { id: { in: [...creatableOrganizationIds] } }),
          },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : [];

    const manageableOrganizationIds = new Set(assignments
      .filter((assignment) =>
        assignment.role.name === 'HOSTEL_ADMIN' &&
        assignment.organizationId !== null && assignment.hostelId === null,
      )
      .map((assignment) => assignment.organizationId as string));
    const manageableAssignedHostelIds = new Set(assignments
      .filter((assignment) =>
        assignment.role.name === 'HOSTEL_ADMIN' && assignment.hostelId !== null,
      )
      .map((assignment) => assignment.hostelId as string));
    const manageableHostelIds = hostels
      .filter((hostel) => globalAccess ||
        manageableOrganizationIds.has(hostel.organizationId) ||
        manageableAssignedHostelIds.has(hostel.id))
      .map((hostel) => hostel.id);

    return { hostels, creatableOrganizations, manageableHostelIds };
  }

  async createForUser(userId: string, input: CreateHostelDto) {
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
    }) as HostelRoleAssignment[];

    const globalAccess = assignments.some((assignment) =>
      assignment.role.name === 'SUPER_ADMIN' &&
      assignment.organizationId === null && assignment.hostelId === null,
    );
    const organizationIds = new Set(assignments
      .filter((assignment) =>
        assignment.role.name === 'HOSTEL_ADMIN' &&
        assignment.organizationId !== null && assignment.hostelId === null,
      )
      .map((assignment) => assignment.organizationId as string));

    let organizationId = input.organizationId;
    if (!globalAccess) {
      if (organizationIds.size === 0) {
        throw new ForbiddenException('Hostel creation is not assigned to this account');
      }
      if (!organizationId && organizationIds.size === 1) {
        organizationId = [...organizationIds][0];
      }
      if (!organizationId) {
        throw new BadRequestException('organizationId is required when more than one organization is assigned');
      }
      if (!organizationIds.has(organizationId)) {
        throw new ForbiddenException('Hostel creation is not assigned to this organization');
      }
    }

    if (!organizationId) {
      throw new BadRequestException('organizationId is required for a global administrator');
    }

    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, archivedAt: null },
      select: { id: true, name: true },
    });
    if (!organization) throw new NotFoundException('Active organization not found');

    try {
      return await this.prisma.hostel.create({
        data: {
          organizationId: organization.id,
          name: input.name,
          code: input.code.toUpperCase(),
          address: input.address,
        },
        select: {
          id: true,
          organizationId: true,
          name: true,
          code: true,
          address: true,
          createdAt: true,
          organization: { select: { name: true } },
        },
      });
    } catch (error) {
      if (
        typeof error === 'object' && error !== null && 'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A hostel with this code already exists in the organization');
      }
      throw error;
    }
  }

  async updateForUser(userId: string, hostelId: string, input: UpdateHostelDto) {
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
    }) as HostelRoleAssignment[];

    const globalAccess = assignments.some((assignment) =>
      assignment.role.name === 'SUPER_ADMIN' &&
      assignment.organizationId === null && assignment.hostelId === null,
    );
    const organizationIds = new Set<string>();
    const assignedHostelIds = new Set<string>();
    for (const assignment of assignments) {
      if (assignment.role.name !== 'HOSTEL_ADMIN') continue;
      if (assignment.organizationId && !assignment.hostelId) {
        organizationIds.add(assignment.organizationId);
      } else if (assignment.hostelId) {
        assignedHostelIds.add(assignment.hostelId);
      }
    }

    if (!globalAccess && organizationIds.size === 0 && assignedHostelIds.size === 0) {
      throw new NotFoundException('Hostel not found');
    }

    const scopeFilter = globalAccess
      ? {}
      : {
          OR: [
            ...(organizationIds.size > 0
              ? [{ organizationId: { in: [...organizationIds] } }]
              : []),
            ...(assignedHostelIds.size > 0
              ? [{ id: { in: [...assignedHostelIds] } }]
              : []),
          ],
        };
    const where = {
      id: hostelId,
      archivedAt: null,
      organization: { is: { archivedAt: null } },
      ...scopeFilter,
    };
    const data = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code.toUpperCase() } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
    };

    try {
      const updated = await this.prisma.hostel.updateMany({ where, data });
      if (updated.count === 0) throw new NotFoundException('Hostel not found');

      return await this.prisma.hostel.findFirst({
        where: { id: hostelId },
        select: {
          id: true,
          organizationId: true,
          name: true,
          code: true,
          address: true,
          createdAt: true,
          organization: { select: { name: true } },
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (
        typeof error === 'object' && error !== null && 'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A hostel with this code already exists in the organization');
      }
      throw error;
    }
  }

  async archiveForUser(userId: string, hostelId: string) {
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
    }) as HostelRoleAssignment[];

    const globalAccess = assignments.some((assignment) =>
      assignment.role.name === 'SUPER_ADMIN' &&
      assignment.organizationId === null && assignment.hostelId === null,
    );
    const organizationIds = new Set<string>();
    const assignedHostelIds = new Set<string>();
    for (const assignment of assignments) {
      if (assignment.role.name !== 'HOSTEL_ADMIN') continue;
      if (assignment.organizationId && !assignment.hostelId) {
        organizationIds.add(assignment.organizationId);
      } else if (assignment.hostelId) {
        assignedHostelIds.add(assignment.hostelId);
      }
    }

    if (!globalAccess && organizationIds.size === 0 && assignedHostelIds.size === 0) {
      throw new NotFoundException('Hostel not found');
    }

    const scopeFilter = globalAccess
      ? {}
      : {
          OR: [
            ...(organizationIds.size > 0
              ? [{ organizationId: { in: [...organizationIds] } }]
              : []),
            ...(assignedHostelIds.size > 0
              ? [{ id: { in: [...assignedHostelIds] } }]
              : []),
          ],
        };
    const archived = await this.prisma.hostel.updateMany({
      where: {
        id: hostelId,
        archivedAt: null,
        organization: { is: { archivedAt: null } },
        ...scopeFilter,
      },
      data: { archivedAt: new Date() },
    });
    if (archived.count === 0) throw new NotFoundException('Hostel not found');
    return { status: 'archived' as const };
  }
}
