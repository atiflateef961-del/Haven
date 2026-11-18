import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { CreateRoomDto } from './create-room.dto.js';
import type { UpdateRoomDto } from './update-room.dto.js';

type RoomRoleAssignment = {
  organizationId: string | null;
  hostelId: string | null;
  role: { name: string };
};

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string, hostelId: string, buildingId: string, floorId: string) {
    const assignments = await this.getAssignments(userId, ['SUPER_ADMIN', 'HOSTEL_ADMIN', 'WARDEN']);
    const hostel = await this.findHostel(assignments, hostelId, false);
    if (!hostel) throw new NotFoundException('Floor not found');
    const floor = await this.prisma.floor.findFirst({
      where: { id: floorId, buildingId, building: { is: { id: buildingId, hostelId } } },
      select: { id: true },
    });
    if (!floor) throw new NotFoundException('Floor not found');

    return this.prisma.room.findMany({
      where: { floorId, archivedAt: null },
      select: { id: true, floorId: true, number: true, roomType: true, description: true },
      orderBy: { number: 'asc' },
    });
  }

  async listAvailabilityForUser(userId: string, hostelId: string) {
    const assignments = await this.getAssignments(userId, ['SUPER_ADMIN', 'HOSTEL_ADMIN', 'WARDEN']);
    const hostel = await this.findHostel(assignments, hostelId, false);
    if (!hostel) throw new NotFoundException('Hostel not found');

    const rooms = await this.prisma.room.findMany({
      where: {
        archivedAt: null,
        floor: { building: { hostelId } },
      },
      select: {
        id: true,
        number: true,
        roomType: true,
        floor: {
          select: {
            id: true,
            number: true,
            building: { select: { id: true, name: true } },
          },
        },
        beds: {
          where: { isActive: true },
          select: {
            id: true,
            allocations: {
              where: { status: 'ACTIVE', endedAt: null },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ floor: { building: { name: 'asc' } } }, { floor: { number: 'asc' } }, { number: 'asc' }],
    });

    return rooms.map(({ beds, ...room }) => {
      const occupiedBeds = beds.filter((bed) => bed.allocations.length > 0).length;
      const capacity = beds.length;
      const freeBeds = capacity - occupiedBeds;
      return {
        ...room,
        capacity,
        occupiedBeds,
        freeBeds,
        status: capacity === 0
          ? 'No beds' as const
          : occupiedBeds === 0
            ? 'Free' as const
            : freeBeds === 0
              ? 'Full' as const
              : 'Partly occupied' as const,
      };
    });
  }

  async createForUser(
    userId: string, hostelId: string, buildingId: string, floorId: string, input: CreateRoomDto,
  ) {
    const assignments = await this.getAssignments(userId, ['SUPER_ADMIN', 'HOSTEL_ADMIN']);
    const hostel = await this.findHostel(assignments, hostelId, true);
    if (!hostel) throw new NotFoundException('Floor not found');
    const floor = await this.prisma.floor.findFirst({
      where: { id: floorId, buildingId, building: { is: { id: buildingId, hostelId } } },
      select: { id: true },
    });
    if (!floor) throw new NotFoundException('Floor not found');

    try {
      return await this.prisma.room.create({
        data: {
          floorId,
          number: input.number,
          ...(input.roomType !== undefined ? { roomType: input.roomType } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
        },
        select: { id: true, floorId: true, number: true, roomType: true, description: true },
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('A room with this number already exists on the floor');
      }
      throw error;
    }
  }

  async updateForUser(
    userId: string, hostelId: string, buildingId: string, floorId: string, roomId: string, input: UpdateRoomDto,
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
      throw new NotFoundException('Room not found');
    }
    const scopeFilter = globalAccess ? {} : {
      OR: [
        ...(organizationIds.size > 0 ? [{ organizationId: { in: [...organizationIds] } }] : []),
        ...(assignedHostelIds.size > 0 ? [{ id: { in: [...assignedHostelIds] } }] : []),
      ],
    };
    const data = {
      ...(input.number !== undefined ? { number: input.number } : {}),
      ...(input.roomType !== undefined ? { roomType: input.roomType } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    };

    try {
      const updated = await this.prisma.room.updateMany({
        where: {
          id: roomId,
          floorId,
          archivedAt: null,
          floor: {
            is: {
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
          },
        },
        data,
      });
      if (updated.count === 0) throw new NotFoundException('Room not found');
      return await this.prisma.room.findFirst({
        where: { id: roomId, floorId },
        select: { id: true, floorId: true, number: true, roomType: true, description: true },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('A room with this number already exists on the floor');
      }
      throw error;
    }
  }

  async archiveForUser(
    userId: string, hostelId: string, buildingId: string, floorId: string, roomId: string,
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
      throw new NotFoundException('Room not found');
    }
    const scopeFilter = globalAccess ? {} : {
      OR: [
        ...(organizationIds.size > 0 ? [{ organizationId: { in: [...organizationIds] } }] : []),
        ...(assignedHostelIds.size > 0 ? [{ id: { in: [...assignedHostelIds] } }] : []),
      ],
    };
    const authorizedWhere = {
        id: roomId,
        floorId,
        archivedAt: null,
        floor: {
          is: {
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
        },
      };
    const archived = await this.prisma.room.updateMany({
      where: {
        ...authorizedWhere,
        beds: { none: { allocations: { some: { status: 'ACTIVE', endedAt: null } } } },
      },
      data: { archivedAt: new Date() },
    });
    if (archived.count === 0) {
      const room = await this.prisma.room.findFirst({ where: authorizedWhere, select: { id: true } });
      if (room) throw new ConflictException('A room with active student allocations cannot be archived');
      throw new NotFoundException('Room not found');
    }
    return { status: 'archived' as const };
  }

  private async getAssignments(userId: string, roleNames: string[]) {
    return await this.prisma.userRole.findMany({
      where: { userId, role: { name: { in: roleNames } } },
      select: {
        organizationId: true,
        hostelId: true,
        role: { select: { name: true } },
      },
    }) as RoomRoleAssignment[];
  }

  private async findHostel(assignments: RoomRoleAssignment[], hostelId: string, write: boolean) {
    const globalAccess = assignments.some((assignment) =>
      assignment.role.name === 'SUPER_ADMIN' &&
      assignment.organizationId === null && assignment.hostelId === null,
    );
    const organizationIds = new Set(assignments
      .filter((assignment) => {
        const permittedRole = assignment.role.name === 'HOSTEL_ADMIN' ||
          (!write && assignment.role.name === 'SUPER_ADMIN');
        return permittedRole && assignment.organizationId !== null && assignment.hostelId === null;
      })
      .map((assignment) => assignment.organizationId as string));
    const assignedHostelIds = new Set(assignments
      .filter((assignment) => assignment.hostelId !== null &&
        (!write || assignment.role.name === 'HOSTEL_ADMIN'))
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
}
