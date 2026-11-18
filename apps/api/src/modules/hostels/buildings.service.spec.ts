import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { BuildingsService } from './buildings.service.js';

describe('BuildingsService', () => {
  const userRoleFindMany = vi.fn();
  const hostelFindFirst = vi.fn();
  const buildingFindMany = vi.fn();
  const buildingCreate = vi.fn();
  const buildingUpdateMany = vi.fn();
  const buildingFindFirst = vi.fn();
  const floorFindMany = vi.fn();
  const floorCreate = vi.fn();
  const floorUpdateMany = vi.fn();
  const floorFindFirst = vi.fn();
  const prisma = {
    userRole: { findMany: userRoleFindMany },
    hostel: { findFirst: hostelFindFirst },
    building: {
      findMany: buildingFindMany,
      create: buildingCreate,
      updateMany: buildingUpdateMany,
      findFirst: buildingFindFirst,
    },
    floor: {
      findMany: floorFindMany,
      create: floorCreate,
      updateMany: floorUpdateMany,
      findFirst: floorFindFirst,
    },
  };
  const service = new BuildingsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    vi.clearAllMocks();
    userRoleFindMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    hostelFindFirst.mockResolvedValue({ id: 'hostel-1' });
    buildingFindMany.mockResolvedValue([]);
    buildingCreate.mockResolvedValue({ id: 'building-1', hostelId: 'hostel-1', name: 'North Wing' });
    buildingUpdateMany.mockResolvedValue({ count: 1 });
    buildingFindFirst.mockResolvedValue({ id: 'building-1', hostelId: 'hostel-1', name: 'Renamed Wing' });
    floorFindMany.mockResolvedValue([]);
    floorCreate.mockResolvedValue({ id: 'floor-1', buildingId: 'building-1', number: 1 });
    floorUpdateMany.mockResolvedValue({ count: 1 });
    floorFindFirst.mockResolvedValue({ id: 'floor-1', buildingId: 'building-1', number: 2 });
  });

  it('lists buildings only after verifying active hostel access', async () => {
    buildingFindMany.mockResolvedValue([{
      id: 'building-1', hostelId: 'hostel-1', name: 'North Wing',
      floors: [{ _count: { rooms: 2 } }, { _count: { rooms: 3 } }],
    }]);

    await expect(service.listForUser('admin-1', 'hostel-1')).resolves.toEqual([{
      id: 'building-1', hostelId: 'hostel-1', name: 'North Wing', roomCount: 5,
    }]);

    expect(hostelFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'hostel-1', archivedAt: null,
        organization: { is: { archivedAt: null } },
        OR: [{ organizationId: { in: ['org-1'] } }],
      }),
    }));
    expect(buildingFindMany).toHaveBeenCalledWith({
      where: { hostelId: 'hostel-1' },
      select: {
        id: true,
        hostelId: true,
        name: true,
        floors: { select: { _count: { select: { rooms: true } } } },
      },
      orderBy: { name: 'asc' },
    });
  });

  it('allows a warden to list buildings in an assigned active hostel', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: null, hostelId: 'hostel-1', role: { name: 'WARDEN' },
    }]);

    await service.listForUser('warden-1', 'hostel-1');

    expect(hostelFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: [{ id: { in: ['hostel-1'] } }] }),
    }));
  });

  it('returns zero rooms for a building without floors', async () => {
    buildingFindMany.mockResolvedValue([{
      id: 'building-1', hostelId: 'hostel-1', name: 'North Wing', floors: [],
    }]);

    await expect(service.listForUser('admin-1', 'hostel-1')).resolves.toMatchObject([
      { id: 'building-1', roomCount: 0 },
    ]);
  });

  it('does not list buildings for an inaccessible or archived hostel', async () => {
    hostelFindFirst.mockResolvedValue(null);

    await expect(service.listForUser('admin-1', 'hostel-2'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(buildingFindMany).not.toHaveBeenCalled();
  });

  it('creates a building inside an authorized hostel for an organization admin', async () => {
    await service.createForUser('admin-1', 'hostel-1', { name: 'North Wing' });

    expect(hostelFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'hostel-1', archivedAt: null,
        organization: { is: { archivedAt: null } },
        OR: [{ organizationId: { in: ['org-1'] } }],
      }),
    }));
    expect(buildingCreate).toHaveBeenCalledWith({
      data: { hostelId: 'hostel-1', name: 'North Wing' },
      select: { id: true, hostelId: true, name: true },
    });
  });

  it('does not let wardens create buildings', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: null, hostelId: 'hostel-1', role: { name: 'WARDEN' },
    }]);

    await expect(service.createForUser('warden-1', 'hostel-1', { name: 'North Wing' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(buildingCreate).not.toHaveBeenCalled();
  });

  it('maps duplicate names within a hostel to a conflict', async () => {
    buildingCreate.mockRejectedValue({ code: 'P2002' });

    await expect(service.createForUser('admin-1', 'hostel-1', { name: 'North Wing' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('updates a building atomically within its authorized hostel scope', async () => {
    await service.updateForUser('admin-1', 'hostel-1', 'building-1', { name: 'Renamed Wing' });

    expect(buildingUpdateMany).toHaveBeenCalledWith({
      where: {
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
      data: { name: 'Renamed Wing' },
    });
    expect(buildingFindFirst).toHaveBeenCalledWith({
      where: { id: 'building-1', hostelId: 'hostel-1' },
      select: { id: true, hostelId: true, name: true },
    });
  });

  it('does not update a building through a different hostel route', async () => {
    buildingUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.updateForUser('admin-1', 'hostel-2', 'building-1', { name: 'Moved Wing' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(buildingFindFirst).not.toHaveBeenCalled();
  });

  it('maps duplicate building name updates to a conflict', async () => {
    buildingUpdateMany.mockRejectedValue({ code: 'P2002' });

    await expect(service.updateForUser('admin-1', 'hostel-1', 'building-1', { name: 'South Wing' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('lists floors in a building under an accessible active hostel', async () => {
    floorFindMany.mockResolvedValue([{ id: 'floor-1', buildingId: 'building-1', number: 0 }]);

    await expect(service.listFloorsForUser('admin-1', 'hostel-1', 'building-1')).resolves.toEqual([
      { id: 'floor-1', buildingId: 'building-1', number: 0 },
    ]);
    expect(buildingFindFirst).toHaveBeenCalledWith({
      where: { id: 'building-1', hostelId: 'hostel-1' },
      select: { id: true },
    });
    expect(floorFindMany).toHaveBeenCalledWith({
      where: { buildingId: 'building-1' },
      select: { id: true, buildingId: true, number: true },
      orderBy: { number: 'asc' },
    });
  });

  it('allows wardens to view floors in their assigned hostel', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: null, hostelId: 'hostel-1', role: { name: 'WARDEN' },
    }]);

    await service.listFloorsForUser('warden-1', 'hostel-1', 'building-1');
    expect(floorFindMany).toHaveBeenCalled();
  });

  it('rejects floor listing when the building is not under the route hostel', async () => {
    buildingFindFirst.mockResolvedValue(null);

    await expect(service.listFloorsForUser('admin-1', 'hostel-1', 'building-other'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(floorFindMany).not.toHaveBeenCalled();
  });

  it('creates an integer floor in a building within the admin scope', async () => {
    await service.createFloorForUser('admin-1', 'hostel-1', 'building-1', { number: -1 });

    expect(buildingFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
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
    }));
    expect(floorCreate).toHaveBeenCalledWith({
      data: { buildingId: 'building-1', number: -1 },
      select: { id: true, buildingId: true, number: true },
    });
  });

  it('does not allow wardens to create floors', async () => {
    userRoleFindMany.mockResolvedValue([{
      organizationId: null, hostelId: 'hostel-1', role: { name: 'WARDEN' },
    }]);

    await expect(service.createFloorForUser('warden-1', 'hostel-1', 'building-1', { number: 0 }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(floorCreate).not.toHaveBeenCalled();
  });

  it('maps duplicate floor numbers within a building to a conflict', async () => {
    floorCreate.mockRejectedValue({ code: 'P2002' });

    await expect(service.createFloorForUser('admin-1', 'hostel-1', 'building-1', { number: 1 }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('updates a floor number atomically within the authorized building and hostel scope', async () => {
    await service.updateFloorForUser('admin-1', 'hostel-1', 'building-1', 'floor-1', { number: 2 });

    expect(floorUpdateMany).toHaveBeenCalledWith({
      where: {
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
      data: { number: 2 },
    });
    expect(floorFindFirst).toHaveBeenCalledWith({
      where: { id: 'floor-1', buildingId: 'building-1' },
      select: { id: true, buildingId: true, number: true },
    });
  });

  it('does not update a floor through a different building route', async () => {
    floorUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.updateFloorForUser('admin-1', 'hostel-1', 'building-other', 'floor-1', { number: 3 }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(floorFindFirst).not.toHaveBeenCalled();
  });

  it('maps duplicate floor number updates to a conflict', async () => {
    floorUpdateMany.mockRejectedValue({ code: 'P2002' });

    await expect(service.updateFloorForUser('admin-1', 'hostel-1', 'building-1', 'floor-1', { number: 1 }))
      .rejects.toBeInstanceOf(ConflictException);
  });
});
