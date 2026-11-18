import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { BedsService } from './beds.service.js';

describe('BedsService', () => {
  const userRoleFindMany = vi.fn();
  const hostelFindFirst = vi.fn();
  const roomFindFirst = vi.fn();
  const floorFindFirst = vi.fn();
  const bedFindMany = vi.fn();
  const bedUpdateMany = vi.fn();
  const bedFindFirst = vi.fn();
  const bedCreate = vi.fn();
  const prisma = {
    userRole: { findMany: userRoleFindMany },
    hostel: { findFirst: hostelFindFirst },
    room: { findFirst: roomFindFirst },
    floor: { findFirst: floorFindFirst },
    bed: { findMany: bedFindMany, findFirst: bedFindFirst, create: bedCreate, updateMany: bedUpdateMany },
  };
  const service = new BedsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    vi.clearAllMocks();
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    hostelFindFirst.mockResolvedValue({ id: 'hostel-1' });
    roomFindFirst.mockResolvedValue({ id: 'room-1' });
    floorFindFirst.mockResolvedValue({ id: 'floor-1' });
    bedFindMany.mockResolvedValue([]);
    bedCreate.mockResolvedValue({ id: 'bed-1', roomId: 'room-1', label: 'A', isActive: true });
    bedUpdateMany.mockResolvedValue({ count: 1 });
    bedFindFirst.mockResolvedValue({ id: 'bed-1', roomId: 'room-1', label: 'B', isActive: true, allocations: [] });
  });

  it('lists beds in the authorized room and preserves inactive entries for management', async () => {
    bedFindMany.mockResolvedValue([
      { id: 'bed-1', roomId: 'room-1', label: 'A', isActive: true, allocations: [{ id: 'allocation-1' }] },
      { id: 'bed-2', roomId: 'room-1', label: 'B', isActive: true, allocations: [] },
    ]);
    await expect(service.listForUser('admin-1', 'hostel-1', 'building-1', 'floor-1', 'room-1'))
      .resolves.toEqual([
        { id: 'bed-1', roomId: 'room-1', label: 'A', isActive: true, isOccupied: true },
        { id: 'bed-2', roomId: 'room-1', label: 'B', isActive: true, isOccupied: false },
      ]);
    expect(roomFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'room-1', floorId: 'floor-1', archivedAt: null }),
    }));
    expect(bedFindMany).toHaveBeenCalledWith({
      where: { roomId: 'room-1' },
      select: {
        id: true, roomId: true, label: true, isActive: true,
        allocations: { where: { status: 'ACTIVE', endedAt: null }, select: { id: true }, take: 1 },
      },
      orderBy: { label: 'asc' },
    });
  });

  it('allows wardens to read beds in an assigned hostel', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: null, hostelId: 'hostel-1', role: { name: 'WARDEN' },
    }]);
    await service.listForUser('warden-1', 'hostel-1', 'building-1', 'floor-1', 'room-1');
    expect(bedFindMany).toHaveBeenCalled();
  });

  it('lists floor beds in one scoped query and derives occupancy without exposing allocations', async () => {
    bedFindMany.mockResolvedValue([
      { id: 'bed-1', roomId: 'room-1', label: 'A', isActive: true, allocations: [{ id: 'allocation-1' }] },
      { id: 'bed-2', roomId: 'room-2', label: 'A', isActive: true, allocations: [] },
    ]);
    await expect(service.listForFloorForUser('admin-1', 'hostel-1', 'building-1', 'floor-1'))
      .resolves.toEqual([
        { id: 'bed-1', roomId: 'room-1', label: 'A', isActive: true, isOccupied: true },
        { id: 'bed-2', roomId: 'room-2', label: 'A', isActive: true, isOccupied: false },
      ]);
    expect(floorFindFirst).toHaveBeenCalledWith({
      where: { id: 'floor-1', buildingId: 'building-1', building: { is: { id: 'building-1', hostelId: 'hostel-1' } } },
      select: { id: true },
    });
    expect(bedFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { room: { floorId: 'floor-1', archivedAt: null } },
      orderBy: [{ roomId: 'asc' }, { label: 'asc' }],
    }));
  });

  it('hides beds when the room is outside the requested parent path', async () => {
    roomFindFirst.mockResolvedValue(null);
    await expect(service.listForUser('admin-1', 'hostel-1', 'building-1', 'floor-1', 'room-other'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(bedFindMany).not.toHaveBeenCalled();
  });

  it('creates a bed inside an authorized room', async () => {
    await service.createForUser('admin-1', 'hostel-1', 'building-1', 'floor-1', 'room-1', { label: 'A' });
    expect(bedCreate).toHaveBeenCalledWith({
      data: { roomId: 'room-1', label: 'A' },
      select: { id: true, roomId: true, label: true, isActive: true },
    });
  });

  it('does not allow wardens to create beds', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: null, hostelId: 'hostel-1', role: { name: 'WARDEN' },
    }]);
    await expect(service.createForUser('warden-1', 'hostel-1', 'building-1', 'floor-1', 'room-1', { label: 'A' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(bedCreate).not.toHaveBeenCalled();
  });

  it('maps duplicate labels within a room to conflict', async () => {
    bedCreate.mockRejectedValue({ code: 'P2002' });
    await expect(service.createForUser('admin-1', 'hostel-1', 'building-1', 'floor-1', 'room-1', { label: 'A' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('renames a bed atomically within the authorized room and tenant scope', async () => {
    await expect(service.updateForUser('admin-1', 'hostel-1', 'building-1', 'floor-1', 'room-1', 'bed-1', {
      label: 'B',
    })).resolves.toEqual({ id: 'bed-1', roomId: 'room-1', label: 'B', isActive: true, isOccupied: false });
    expect(bedUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'bed-1', roomId: 'room-1',
        room: { is: expect.objectContaining({
          id: 'room-1', archivedAt: null,
          floor: { is: expect.objectContaining({
            id: 'floor-1', buildingId: 'building-1',
            building: { is: expect.objectContaining({
              id: 'building-1', hostelId: 'hostel-1',
              hostel: { is: expect.objectContaining({
                id: 'hostel-1', archivedAt: null,
                OR: [{ organizationId: { in: ['org-1'] } }],
              }) },
            }) },
          }) },
        }) },
      }),
      data: { label: 'B' },
    });
  });

  it('hides beds when the bed does not belong to the requested room', async () => {
    bedUpdateMany.mockResolvedValue({ count: 0 });
    await expect(service.updateForUser('admin-1', 'hostel-1', 'building-1', 'floor-1', 'room-1', 'bed-other', {
      label: 'B',
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(bedFindFirst).not.toHaveBeenCalled();
  });

  it('maps duplicate bed labels on update to a conflict', async () => {
    bedUpdateMany.mockRejectedValue({ code: 'P2002' });
    await expect(service.updateForUser('admin-1', 'hostel-1', 'building-1', 'floor-1', 'room-1', 'bed-1', {
      label: 'A',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('deactivates beds atomically only when there are no active allocations', async () => {
    await service.updateForUser('admin-1', 'hostel-1', 'building-1', 'floor-1', 'room-1', 'bed-1', {
      isActive: false,
    });
    expect(bedUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'bed-1', roomId: 'room-1',
        allocations: { none: { status: 'ACTIVE', endedAt: null } },
      }),
      data: { isActive: false },
    }));
  });

  it('returns a conflict when active allocations prevent bed deactivation', async () => {
    bedUpdateMany.mockResolvedValue({ count: 0 });
    bedFindFirst.mockResolvedValue({ id: 'bed-1' });
    await expect(service.updateForUser('admin-1', 'hostel-1', 'building-1', 'floor-1', 'room-1', 'bed-1', {
      isActive: false,
    })).rejects.toBeInstanceOf(ConflictException);
    expect(bedFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'bed-1', roomId: 'room-1',
        allocations: { some: { status: 'ACTIVE', endedAt: null } },
      }),
    }));
  });
});
