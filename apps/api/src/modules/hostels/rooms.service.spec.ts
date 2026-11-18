import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { RoomsService } from './rooms.service.js';

describe('RoomsService', () => {
  const userRoleFindMany = vi.fn();
  const hostelFindFirst = vi.fn();
  const floorFindFirst = vi.fn();
  const roomFindMany = vi.fn();
  const roomCreate = vi.fn();
  const roomUpdateMany = vi.fn();
  const roomFindFirst = vi.fn();
  const prisma = {
    userRole: { findMany: userRoleFindMany },
    hostel: { findFirst: hostelFindFirst },
    floor: { findFirst: floorFindFirst },
    room: {
      findMany: roomFindMany,
      create: roomCreate,
      updateMany: roomUpdateMany,
      findFirst: roomFindFirst,
    },
  };
  const service = new RoomsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    vi.clearAllMocks();
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    hostelFindFirst.mockResolvedValue({ id: 'hostel-1' });
    floorFindFirst.mockResolvedValue({ id: 'floor-1' });
    roomFindMany.mockResolvedValue([]);
    roomCreate.mockResolvedValue({
      id: 'room-1', floorId: 'floor-1', number: '101', roomType: 'Double', description: null,
    });
    roomUpdateMany.mockResolvedValue({ count: 1 });
    roomFindFirst.mockResolvedValue({
      id: 'room-1', floorId: 'floor-1', number: '102', roomType: null, description: null,
    });
  });

  it('lists rooms only under an accessible floor and active hostel', async () => {
    await service.listForUser('admin-1', 'hostel-1', 'building-1', 'floor-1');

    expect(hostelFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'hostel-1', archivedAt: null,
        organization: { is: { archivedAt: null } },
        OR: [{ organizationId: { in: ['org-1'] } }],
      }),
    }));
    expect(floorFindFirst).toHaveBeenCalledWith({
      where: { id: 'floor-1', buildingId: 'building-1', building: { is: { id: 'building-1', hostelId: 'hostel-1' } } },
      select: { id: true },
    });
    expect(roomFindMany).toHaveBeenCalledWith({
      where: { floorId: 'floor-1', archivedAt: null },
      select: { id: true, floorId: true, number: true, roomType: true, description: true },
      orderBy: { number: 'asc' },
    });
  });

  it('allows wardens to list rooms in an explicitly assigned hostel', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: null, hostelId: 'hostel-1', role: { name: 'WARDEN' },
    }]);

    await service.listForUser('warden-1', 'hostel-1', 'building-1', 'floor-1');
    expect(roomFindMany).toHaveBeenCalled();
  });

  it('does not list rooms when the floor is under a different building', async () => {
    floorFindFirst.mockResolvedValue(null);

    await expect(service.listForUser('admin-1', 'hostel-1', 'building-1', 'floor-2'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(roomFindMany).not.toHaveBeenCalled();
  });

  it('returns tenant-scoped room availability with capacity and occupancy status', async () => {
    roomFindMany.mockResolvedValue([
      { id: 'room-free', number: '101', roomType: 'Double', floor: { id: 'floor-1', number: 0, building: { id: 'building-1', name: 'North' } }, beds: [{ allocations: [] }, { allocations: [] }] },
      { id: 'room-partial', number: '102', roomType: 'Double', floor: { id: 'floor-1', number: 0, building: { id: 'building-1', name: 'North' } }, beds: [{ allocations: [{ id: 'allocation-1' }] }, { allocations: [] }] },
      { id: 'room-full', number: '103', roomType: 'Single', floor: { id: 'floor-2', number: 1, building: { id: 'building-1', name: 'North' } }, beds: [{ allocations: [{ id: 'allocation-2' }] }] },
      { id: 'room-no-beds', number: '104', roomType: null, floor: { id: 'floor-2', number: 1, building: { id: 'building-1', name: 'North' } }, beds: [] },
    ]);

    await expect(service.listAvailabilityForUser('admin-1', 'hostel-1')).resolves.toEqual([
      expect.objectContaining({ id: 'room-free', capacity: 2, occupiedBeds: 0, freeBeds: 2, status: 'Free' }),
      expect.objectContaining({ id: 'room-partial', capacity: 2, occupiedBeds: 1, freeBeds: 1, status: 'Partly occupied' }),
      expect.objectContaining({ id: 'room-full', capacity: 1, occupiedBeds: 1, freeBeds: 0, status: 'Full' }),
      expect.objectContaining({ id: 'room-no-beds', capacity: 0, occupiedBeds: 0, freeBeds: 0, status: 'No beds' }),
    ]);
    expect(roomFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { archivedAt: null, floor: { building: { hostelId: 'hostel-1' } } },
      select: expect.objectContaining({ floor: { select: expect.objectContaining({ id: true }) } }),
    }));
  });

  it('creates a room under a floor in an authorized hostel', async () => {
    await service.createForUser('admin-1', 'hostel-1', 'building-1', 'floor-1', {
      number: '101', roomType: 'Double', description: 'Near the east stairs',
    });

    expect(hostelFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: [{ organizationId: { in: ['org-1'] } }] }),
    }));
    expect(roomCreate).toHaveBeenCalledWith({
      data: { floorId: 'floor-1', number: '101', roomType: 'Double', description: 'Near the east stairs' },
      select: { id: true, floorId: true, number: true, roomType: true, description: true },
    });
  });

  it('does not allow wardens to create rooms', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: null, hostelId: 'hostel-1', role: { name: 'WARDEN' },
    }]);

    await expect(service.createForUser('warden-1', 'hostel-1', 'building-1', 'floor-1', { number: '101' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(roomCreate).not.toHaveBeenCalled();
  });

  it('maps duplicate room numbers on the floor to a conflict', async () => {
    roomCreate.mockRejectedValue({ code: 'P2002' });

    await expect(service.createForUser('admin-1', 'hostel-1', 'building-1', 'floor-1', { number: '101' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('updates a room atomically within its floor, building, and admin hostel scope', async () => {
    await service.updateForUser('admin-1', 'hostel-1', 'building-1', 'floor-1', 'room-1', {
      number: '102', roomType: null,
    });

    expect(roomUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'room-1',
        floorId: 'floor-1',
        archivedAt: null,
        floor: {
          is: {
            id: 'floor-1',
            buildingId: 'building-1',
            building: {
              is: {
                id: 'building-1',
                hostelId: 'hostel-1',
                hostel: {
                  is: {
                    id: 'hostel-1',
                    archivedAt: null,
                    organization: { is: { archivedAt: null } },
                    OR: [{ organizationId: { in: ['org-1'] } }],
                  },
                },
              },
            },
          },
        },
      },
      data: { number: '102', roomType: null },
    });
  });

  it('does not update a room through a different floor route', async () => {
    roomUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.updateForUser('admin-1', 'hostel-1', 'building-1', 'floor-other', 'room-1', {
      number: '103',
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(roomFindFirst).not.toHaveBeenCalled();
  });

  it('maps duplicate room number updates to a conflict', async () => {
    roomUpdateMany.mockRejectedValue({ code: 'P2002' });

    await expect(service.updateForUser('admin-1', 'hostel-1', 'building-1', 'floor-1', 'room-1', {
      number: '101',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('archives a room without deleting it and only when it has no active allocations', async () => {
    await expect(service.archiveForUser('admin-1', 'hostel-1', 'building-1', 'floor-1', 'room-1'))
      .resolves.toEqual({ status: 'archived' });

    expect(roomUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'room-1',
        floorId: 'floor-1',
        archivedAt: null,
        beds: { none: { allocations: { some: { status: 'ACTIVE', endedAt: null } } } },
      }),
      data: { archivedAt: expect.any(Date) },
    }));
  });

  it('does not archive a room with active student allocations', async () => {
    roomUpdateMany.mockResolvedValue({ count: 0 });
    roomFindFirst.mockResolvedValue({ id: 'room-1' });

    await expect(service.archiveForUser('admin-1', 'hostel-1', 'building-1', 'floor-1', 'room-1'))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('does not archive a room outside the caller scope or parent route', async () => {
    roomUpdateMany.mockResolvedValue({ count: 0 });
    roomFindFirst.mockResolvedValue(null);

    await expect(service.archiveForUser('admin-1', 'hostel-1', 'building-1', 'floor-1', 'room-2'))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
