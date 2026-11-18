import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { CreateBedDto } from './create-bed.dto.js';
import type { UpdateBedDto } from './update-bed.dto.js';

type BedRoleAssignment = {
  organizationId: string | null;
  hostelId: string | null;
  role: { name: string };
};

@Injectable()
export class BedsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string, hostelId: string, buildingId: string, floorId: string, roomId: string) {
    const assignments = await this.getAssignments(userId, ['SUPER_ADMIN', 'HOSTEL_ADMIN', 'WARDEN']);
    const hostel = await this.findHostel(assignments, hostelId);
    if (!hostel) throw new NotFoundException('Room not found');
    const room = await this.findRoom(hostelId, buildingId, floorId, roomId);
    if (!room) throw new NotFoundException('Room not found');

    const beds = await this.prisma.bed.findMany({
      where: { roomId },
      select: {
        id: true,
        roomId: true,
        label: true,
        isActive: true,
        allocations: {
          where: { status: 'ACTIVE', endedAt: null },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { label: 'asc' },
    });
    return beds.map(({ allocations, ...bed }) => ({ ...bed, isOccupied: allocations.length > 0 }));
  }

  async listForFloorForUser(userId: string, hostelId: string, buildingId: string, floorId: string) {
    const assignments = await this.getAssignments(userId, ['SUPER_ADMIN', 'HOSTEL_ADMIN', 'WARDEN']);
    const hostel = await this.findHostel(assignments, hostelId);
    if (!hostel) throw new NotFoundException('Floor not found');
    const floor = await this.prisma.floor.findFirst({
      where: { id: floorId, buildingId, building: { is: { id: buildingId, hostelId } } },
      select: { id: true },
    });
    if (!floor) throw new NotFoundException('Floor not found');

    const beds = await this.prisma.bed.findMany({
      where: { room: { floorId, archivedAt: null } },
      select: {
        id: true,
        roomId: true,
        label: true,
        isActive: true,
        allocations: {
          where: { status: 'ACTIVE', endedAt: null },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: [{ roomId: 'asc' }, { label: 'asc' }],
    });
    return beds.map(({ allocations, ...bed }) => ({ ...bed, isOccupied: allocations.length > 0 }));
  }

  async createForUser(
    userId: string, hostelId: string, buildingId: string, floorId: string, roomId: string, input: CreateBedDto,
  ) {
    const assignments = await this.getAssignments(userId, ['SUPER_ADMIN', 'HOSTEL_ADMIN']);
    const hostel = await this.findHostel(assignments, hostelId, true);
    if (!hostel) throw new NotFoundException('Room not found');
    const room = await this.findRoom(hostelId, buildingId, floorId, roomId);
    if (!room) throw new NotFoundException('Room not found');

    try {
      const bed = await this.prisma.bed.create({
        data: { roomId, label: input.label },
        select: { id: true, roomId: true, label: true, isActive: true },
      });
      return { ...bed, isOccupied: false };
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('A bed with this label already exists in the room');
      }
      throw error;
    }
  }

  async updateForUser(
    userId: string,
    hostelId: string,
    buildingId: string,
    floorId: string,
    roomId: string,
    bedId: string,
    input: UpdateBedDto,
  ) {
    const assignments = await this.getAssignments(userId, ['SUPER_ADMIN', 'HOSTEL_ADMIN']);
    const hostel = await this.findHostel(assignments, hostelId, true);
    if (!hostel) throw new NotFoundException('Bed not found');
    const globalAccess = assignments.some((assignment) =>
      assignment.role.name === 'SUPER_ADMIN' && assignment.organizationId === null && assignment.hostelId === null,
    );
    const organizationIds = new Set(assignments
      .filter((assignment) => assignment.role.name === 'HOSTEL_ADMIN' &&
        assignment.organizationId !== null && assignment.hostelId === null)
      .map((assignment) => assignment.organizationId as string));
    const assignedHostelIds = new Set(assignments
      .filter((assignment) => assignment.role.name === 'HOSTEL_ADMIN' && assignment.hostelId !== null)
      .map((assignment) => assignment.hostelId as string));
    const scopeFilter = globalAccess ? {} : {
      OR: [
        ...(organizationIds.size ? [{ organizationId: { in: [...organizationIds] } }] : []),
        ...(assignedHostelIds.size ? [{ id: { in: [...assignedHostelIds] } }] : []),
      ],
    };
    const authorizedBedWhere = {
      id: bedId,
      roomId,
      room: { is: {
        id: roomId,
        archivedAt: null,
        floor: { is: {
          id: floorId,
          buildingId,
          building: { is: {
            id: buildingId,
            hostelId,
            hostel: { is: {
              id: hostelId,
              archivedAt: null,
              organization: { is: { archivedAt: null } },
              ...scopeFilter,
            } },
          } },
        } },
      } },
    };

    let updated: { count: number };
    try {
      updated = await this.prisma.bed.updateMany({
        where: {
          ...authorizedBedWhere,
          ...(input.isActive === false ? {
            allocations: { none: { status: 'ACTIVE', endedAt: null } },
          } : {}),
        },
        data: {
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('A bed with this label already exists in the room');
      }
      throw error;
    }
    if (updated.count === 0) {
      if (input.isActive === false) {
        const allocatedBed = await this.prisma.bed.findFirst({
          where: { ...authorizedBedWhere, allocations: { some: { status: 'ACTIVE', endedAt: null } } },
          select: { id: true },
        });
        if (allocatedBed) throw new ConflictException('A bed with an active student allocation cannot be deactivated');
      }
      throw new NotFoundException('Bed not found');
    }
    const bed = await this.prisma.bed.findFirst({
      where: { id: bedId, roomId },
      select: {
        id: true,
        roomId: true,
        label: true,
        isActive: true,
        allocations: { where: { status: 'ACTIVE', endedAt: null }, select: { id: true }, take: 1 },
      },
    });
    return bed ? { id: bed.id, roomId: bed.roomId, label: bed.label, isActive: bed.isActive, isOccupied: bed.allocations.length > 0 } : null;
  }

  private async findRoom(hostelId: string, buildingId: string, floorId: string, roomId: string) {
    return this.prisma.room.findFirst({
      where: {
        id: roomId,
        floorId,
        archivedAt: null,
        floor: { is: { id: floorId, buildingId, building: { is: {
          id: buildingId,
          hostelId,
          hostel: { is: { id: hostelId, archivedAt: null, organization: { is: { archivedAt: null } } } },
        } } } },
      },
      select: { id: true },
    });
  }

  private async getAssignments(userId: string, roleNames: string[]) {
    return await this.prisma.userRole.findMany({
      where: { userId, role: { name: { in: roleNames } } },
      select: { organizationId: true, hostelId: true, role: { select: { name: true } } },
    }) as BedRoleAssignment[];
  }

  private async findHostel(assignments: BedRoleAssignment[], hostelId: string, write = false) {
    const canUseAssignment = (assignment: BedRoleAssignment) =>
      assignment.role.name === 'SUPER_ADMIN' || assignment.role.name === 'HOSTEL_ADMIN' ||
      (!write && assignment.role.name === 'WARDEN');
    const globalAccess = assignments.some((assignment) =>
      canUseAssignment(assignment) && assignment.role.name === 'SUPER_ADMIN' &&
      assignment.organizationId === null && assignment.hostelId === null,
    );
    const organizationIds = new Set(assignments
      .filter((assignment) => canUseAssignment(assignment) && assignment.organizationId !== null && assignment.hostelId === null)
      .map((assignment) => assignment.organizationId as string));
    const assignedHostelIds = new Set(assignments
      .filter((assignment) => canUseAssignment(assignment) && assignment.hostelId !== null)
      .map((assignment) => assignment.hostelId as string));
    if (!globalAccess && organizationIds.size === 0 && assignedHostelIds.size === 0) return null;
    return this.prisma.hostel.findFirst({
      where: {
        id: hostelId,
        archivedAt: null,
        organization: { is: { archivedAt: null } },
        ...(globalAccess ? {} : { OR: [
          ...(organizationIds.size > 0 ? [{ organizationId: { in: [...organizationIds] } }] : []),
          ...(assignedHostelIds.size > 0 ? [{ id: { in: [...assignedHostelIds] } }] : []),
        ] }),
      },
      select: { id: true },
    });
  }
}
