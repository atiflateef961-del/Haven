import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { CreateBuildingDto } from './create-building.dto.js';
import type { UpdateBuildingDto } from './update-building.dto.js';
import type { CreateFloorDto } from './create-floor.dto.js';
import type { UpdateFloorDto } from './update-floor.dto.js';

type BuildingRoleAssignment = {
  organizationId: string | null;
  hostelId: string | null;
  role: { name: string };
};

@Injectable()
export class BuildingsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string, hostelId: string) {
    const assignments = await this.getAssignments(userId, ['SUPER_ADMIN', 'HOSTEL_ADMIN', 'WARDEN']);
    const hostel = await this.findHostelInReadScope(assignments, hostelId);
    if (!hostel) throw new NotFoundException('Hostel not found');

    const buildings = await this.prisma.building.findMany({
      where: { hostelId },
      select: {
        id: true,
        hostelId: true,
        name: true,
        floors: { select: { _count: { select: { rooms: true } } } },
      },
      orderBy: { name: 'asc' },
    });
    return buildings.map((building) => ({
      id: building.id,
      hostelId: building.hostelId,
      name: building.name,
      roomCount: building.floors.reduce((total, floor) => total + floor._count.rooms, 0),
    }));
  }

  async createForUser(userId: string, hostelId: string, input: CreateBuildingDto) {
    const assignments = await this.getAssignments(userId, ['SUPER_ADMIN', 'HOSTEL_ADMIN']);
    const globalAccess = assignments.some((assignment) =>
      assignment.role.name === 'SUPER_ADMIN' &&
      assignment.organizationId === null && assignment.hostelId === null,
    );
    const organizationIds = new Set(assignments
      .filter((assignment) => assignment.role.name === 'HOSTEL_ADMIN' &&
        assignment.organizationId !== null && assignment.hostelId === null)
      .map((assignment) => assignment.organizationId as string));
    const assignedHostelIds = new Set(assignments
      .filter((assignment) => assignment.role.name === 'HOSTEL_ADMIN' && assignment.hostelId !== null)
      .map((assignment) => assignment.hostelId as string));
    if (!globalAccess && organizationIds.size === 0 && assignedHostelIds.size === 0) {
      throw new NotFoundException('Hostel not found');
    }

    const scopeFilter = globalAccess ? {} : {
      OR: [
        ...(organizationIds.size > 0 ? [{ organizationId: { in: [...organizationIds] } }] : []),
        ...(assignedHostelIds.size > 0 ? [{ id: { in: [...assignedHostelIds] } }] : []),
      ],
    };
    const hostel = await this.prisma.hostel.findFirst({
      where: {
        id: hostelId,
        archivedAt: null,
        organization: { is: { archivedAt: null } },
        ...scopeFilter,
      },
      select: { id: true },
    });
    if (!hostel) throw new NotFoundException('Hostel not found');

    try {
      return await this.prisma.building.create({
        data: { hostelId, name: input.name },
        select: { id: true, hostelId: true, name: true },
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('A building with this name already exists in the hostel');
      }
      throw error;
    }
  }

  async updateForUser(userId: string, hostelId: string, buildingId: string, input: UpdateBuildingDto) {
    const assignments = await this.getAssignments(userId, ['SUPER_ADMIN', 'HOSTEL_ADMIN']);
    const globalAccess = assignments.some((assignment) =>
      assignment.role.name === 'SUPER_ADMIN' &&
      assignment.organizationId === null && assignment.hostelId === null,
    );
    const organizationIds = new Set(assignments
      .filter((assignment) => assignment.role.name === 'HOSTEL_ADMIN' &&
        assignment.organizationId !== null && assignment.hostelId === null)
      .map((assignment) => assignment.organizationId as string));
    const assignedHostelIds = new Set(assignments
      .filter((assignment) => assignment.role.name === 'HOSTEL_ADMIN' && assignment.hostelId !== null)
      .map((assignment) => assignment.hostelId as string));
    if (!globalAccess && organizationIds.size === 0 && assignedHostelIds.size === 0) {
      throw new NotFoundException('Building not found');
    }

    const scopeFilter = globalAccess ? {} : {
      OR: [
        ...(organizationIds.size > 0 ? [{ organizationId: { in: [...organizationIds] } }] : []),
        ...(assignedHostelIds.size > 0 ? [{ id: { in: [...assignedHostelIds] } }] : []),
      ],
    };
    try {
      const updated = await this.prisma.building.updateMany({
        where: {
          id: buildingId,
          hostelId,
          hostel: {
            is: {
              id: hostelId,
              archivedAt: null,
              organization: { is: { archivedAt: null } },
              ...scopeFilter,
            },
          },
        },
        data: { name: input.name },
      });
      if (updated.count === 0) throw new NotFoundException('Building not found');

      return await this.prisma.building.findFirst({
        where: { id: buildingId, hostelId },
        select: { id: true, hostelId: true, name: true },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('A building with this name already exists in the hostel');
      }
      throw error;
    }
  }

  async listFloorsForUser(userId: string, hostelId: string, buildingId: string) {
    const assignments = await this.getAssignments(userId, ['SUPER_ADMIN', 'HOSTEL_ADMIN', 'WARDEN']);
    const hostel = await this.findHostelInReadScope(assignments, hostelId);
    if (!hostel) throw new NotFoundException('Building not found');
    const building = await this.prisma.building.findFirst({
      where: { id: buildingId, hostelId },
      select: { id: true },
    });
    if (!building) throw new NotFoundException('Building not found');

    return this.prisma.floor.findMany({
      where: { buildingId },
      select: { id: true, buildingId: true, number: true },
      orderBy: { number: 'asc' },
    });
  }

  async createFloorForUser(userId: string, hostelId: string, buildingId: string, input: CreateFloorDto) {
    const assignments = await this.getAssignments(userId, ['SUPER_ADMIN', 'HOSTEL_ADMIN']);
    const building = await this.findBuildingInManageScope(assignments, hostelId, buildingId);
    if (!building) throw new NotFoundException('Building not found');

    try {
      return await this.prisma.floor.create({
        data: { buildingId, number: input.number },
        select: { id: true, buildingId: true, number: true },
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('A floor with this number already exists in the building');
      }
      throw error;
    }
  }

  async updateFloorForUser(
    userId: string, hostelId: string, buildingId: string, floorId: string, input: UpdateFloorDto,
  ) {
    const assignments = await this.getAssignments(userId, ['SUPER_ADMIN', 'HOSTEL_ADMIN']);
    const globalAccess = assignments.some((assignment) =>
      assignment.role.name === 'SUPER_ADMIN' &&
      assignment.organizationId === null && assignment.hostelId === null,
    );
    const organizationIds = new Set(assignments
      .filter((assignment) => assignment.role.name === 'HOSTEL_ADMIN' &&
        assignment.organizationId !== null && assignment.hostelId === null)
      .map((assignment) => assignment.organizationId as string));
    const assignedHostelIds = new Set(assignments
      .filter((assignment) => assignment.role.name === 'HOSTEL_ADMIN' && assignment.hostelId !== null)
      .map((assignment) => assignment.hostelId as string));
    if (!globalAccess && organizationIds.size === 0 && assignedHostelIds.size === 0) {
      throw new NotFoundException('Floor not found');
    }
    const scopeFilter = globalAccess ? {} : {
      OR: [
        ...(organizationIds.size > 0 ? [{ organizationId: { in: [...organizationIds] } }] : []),
        ...(assignedHostelIds.size > 0 ? [{ id: { in: [...assignedHostelIds] } }] : []),
      ],
    };

    try {
      const updated = await this.prisma.floor.updateMany({
        where: {
          id: floorId,
          buildingId,
          building: {
            is: {
              id: buildingId,
              hostelId,
              hostel: {
                is: {
                  id: hostelId,
                  archivedAt: null,
                  organization: { is: { archivedAt: null } },
                  ...scopeFilter,
                },
              },
            },
          },
        },
        data: { number: input.number },
      });
      if (updated.count === 0) throw new NotFoundException('Floor not found');
      return await this.prisma.floor.findFirst({
        where: { id: floorId, buildingId },
        select: { id: true, buildingId: true, number: true },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('A floor with this number already exists in the building');
      }
      throw error;
    }
  }

  private async getAssignments(userId: string, roleNames: string[]) {
    return await this.prisma.userRole.findMany({
      where: { userId, role: { name: { in: roleNames } } },
      select: {
        organizationId: true,
        hostelId: true,
        role: { select: { name: true } },
      },
    }) as BuildingRoleAssignment[];
  }

  private async findHostelInReadScope(assignments: BuildingRoleAssignment[], hostelId: string) {
    const globalAccess = assignments.some((assignment) =>
      assignment.role.name === 'SUPER_ADMIN' &&
      assignment.organizationId === null && assignment.hostelId === null,
    );
    const organizationIds = new Set(assignments
      .filter((assignment) => ['SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(assignment.role.name) &&
        assignment.organizationId !== null && assignment.hostelId === null)
      .map((assignment) => assignment.organizationId as string));
    const assignedHostelIds = new Set(assignments
      .filter((assignment) => assignment.hostelId !== null)
      .map((assignment) => assignment.hostelId as string));
    if (!globalAccess && organizationIds.size === 0 && assignedHostelIds.size === 0) return null;

    return this.prisma.hostel.findFirst({
      where: {
        id: hostelId,
        archivedAt: null,
        organization: { is: { archivedAt: null } },
        ...(globalAccess ? {} : {
          OR: [
            ...(organizationIds.size > 0 ? [{ organizationId: { in: [...organizationIds] } }] : []),
            ...(assignedHostelIds.size > 0 ? [{ id: { in: [...assignedHostelIds] } }] : []),
          ],
        }),
      },
      select: { id: true },
    });
  }

  private async findBuildingInManageScope(
    assignments: BuildingRoleAssignment[], hostelId: string, buildingId: string,
  ) {
    const globalAccess = assignments.some((assignment) =>
      assignment.role.name === 'SUPER_ADMIN' &&
      assignment.organizationId === null && assignment.hostelId === null,
    );
    const organizationIds = new Set(assignments
      .filter((assignment) => assignment.role.name === 'HOSTEL_ADMIN' &&
        assignment.organizationId !== null && assignment.hostelId === null)
      .map((assignment) => assignment.organizationId as string));
    const assignedHostelIds = new Set(assignments
      .filter((assignment) => assignment.role.name === 'HOSTEL_ADMIN' && assignment.hostelId !== null)
      .map((assignment) => assignment.hostelId as string));
    if (!globalAccess && organizationIds.size === 0 && assignedHostelIds.size === 0) return null;

    const scopeFilter = globalAccess ? {} : {
      OR: [
        ...(organizationIds.size > 0 ? [{ organizationId: { in: [...organizationIds] } }] : []),
        ...(assignedHostelIds.size > 0 ? [{ id: { in: [...assignedHostelIds] } }] : []),
      ],
    };
    return this.prisma.building.findFirst({
      where: {
        id: buildingId,
        hostelId,
        hostel: {
          is: {
            id: hostelId,
            archivedAt: null,
            organization: { is: { archivedAt: null } },
            ...scopeFilter,
          },
        },
      },
      select: { id: true },
    });
  }
}
