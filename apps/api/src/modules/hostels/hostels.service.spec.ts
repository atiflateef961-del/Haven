import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { HostelsService } from './hostels.service.js';

describe('HostelsService', () => {
  const prismaMocks = {
    userRole: { findMany: vi.fn() },
    hostel: { findMany: vi.fn() },
    hostelCreate: vi.fn(),
    hostelUpdateMany: vi.fn(),
    hostelFindFirst: vi.fn(),
    organization: { findFirst: vi.fn(), findMany: vi.fn() },
  };
  const prisma = {
    userRole: prismaMocks.userRole,
    hostel: {
      findMany: prismaMocks.hostel.findMany,
      create: prismaMocks.hostelCreate,
      updateMany: prismaMocks.hostelUpdateMany,
      findFirst: prismaMocks.hostelFindFirst,
    },
    organization: prismaMocks.organization,
  };
  const service = new HostelsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.hostel.findMany.mockResolvedValue([]);
    prismaMocks.organization.findFirst.mockResolvedValue({ id: 'org-1', name: 'North House' });
    prismaMocks.organization.findMany.mockResolvedValue([{ id: 'org-1', name: 'North House' }]);
    prismaMocks.hostelCreate.mockResolvedValue({
      id: 'hostel-new', organizationId: 'org-1', name: 'North Hall', code: 'NH-1',
      address: '12 North Road', createdAt: new Date('2026-11-15T00:00:00.000Z'),
      organization: { name: 'North House' },
    });
    prismaMocks.hostelUpdateMany.mockResolvedValue({ count: 1 });
    prismaMocks.hostelFindFirst.mockResolvedValue({
      id: 'hostel-1', organizationId: 'org-1', name: 'Renamed Hall', code: 'NH-1',
      address: null, createdAt: new Date('2026-11-15T00:00:00.000Z'),
      organization: { name: 'North House' },
    });
  });

  it('lists only non-archived organization hostels for an organization hostel admin', async () => {
    prismaMocks.userRole.findMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);

    prismaMocks.hostel.findMany.mockResolvedValue([{
      id: 'hostel-1', organizationId: 'org-1', name: 'North Hall', code: 'NH', address: null,
      createdAt: new Date('2026-11-15T00:00:00.000Z'), organization: { name: 'North House' },
    }]);

    const result = await service.listForUser('user-1');

    expect(prismaMocks.hostel.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        organization: { archivedAt: null },
        archivedAt: null,
        OR: [{ organizationId: { in: ['org-1'] } }],
      },
      orderBy: [{ organization: { name: 'asc' } }, { name: 'asc' }],
    }));
    await expect(service.listForUser('admin-1')).resolves.toMatchObject({
      creatableOrganizations: [{ id: 'org-1', name: 'North House' }],
    });
    expect(result.manageableHostelIds).toEqual(['hostel-1']);
  });

  it('limits a warden to explicitly assigned hostels', async () => {
    prismaMocks.userRole.findMany.mockResolvedValue([{
      organizationId: null, hostelId: 'hostel-1', role: { name: 'WARDEN' },
    }]);

    await service.listForUser('warden-1');

    expect(prismaMocks.hostel.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        organization: { archivedAt: null },
        archivedAt: null,
        OR: [{ id: { in: ['hostel-1'] } }],
      },
    }));
    await expect(service.listForUser('warden-1')).resolves.toMatchObject({
      creatableOrganizations: [],
      manageableHostelIds: [],
    });
  });

  it('allows a global super admin to list all hostels in active organizations', async () => {
    prismaMocks.userRole.findMany.mockResolvedValue([{
      organizationId: null, hostelId: null, role: { name: 'SUPER_ADMIN' },
    }]);

    prismaMocks.hostel.findMany.mockResolvedValue([
      { id: 'hostel-1', organizationId: 'org-1' },
      { id: 'hostel-2', organizationId: 'org-2' },
    ]);

    const result = await service.listForUser('admin-1');

    expect(prismaMocks.hostel.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organization: { archivedAt: null }, archivedAt: null },
    }));
    expect(prismaMocks.organization.findMany).toHaveBeenCalledWith({
      where: { archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    expect(result.manageableHostelIds).toEqual(['hostel-1', 'hostel-2']);
  });

  it('marks only explicitly assigned hostels manageable for a hostel-scoped administrator', async () => {
    prismaMocks.userRole.findMany.mockResolvedValue([{
      organizationId: null, hostelId: 'hostel-1', role: { name: 'HOSTEL_ADMIN' },
    }]);
    prismaMocks.hostel.findMany.mockResolvedValue([
      { id: 'hostel-1', organizationId: 'org-1' },
    ]);

    await expect(service.listForUser('admin-1')).resolves.toMatchObject({
      manageableHostelIds: ['hostel-1'],
    });
  });

  it('rejects users without an eligible hostel assignment', async () => {
    prismaMocks.userRole.findMany.mockResolvedValue([]);

    await expect(service.listForUser('student-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaMocks.hostel.findMany).not.toHaveBeenCalled();
  });

  it('creates a hostel inside an organization administrator scope and normalizes its code', async () => {
    prismaMocks.userRole.findMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);

    await service.createForUser('admin-1', {
      name: 'North Hall', code: 'nh-1', address: '12 North Road',
    });

    expect(prismaMocks.organization.findFirst).toHaveBeenCalledWith({
      where: { id: 'org-1', archivedAt: null },
      select: { id: true, name: true },
    });
    expect(prismaMocks.hostelCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        organizationId: 'org-1', name: 'North Hall', code: 'NH-1', address: '12 North Road',
      },
    }));
  });

  it('requires global administrators to select an active organization', async () => {
    prismaMocks.userRole.findMany.mockResolvedValue([{
      organizationId: null, hostelId: null, role: { name: 'SUPER_ADMIN' },
    }]);

    await expect(service.createForUser('admin-1', {
      name: 'North Hall', code: 'nh-1',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMocks.hostelCreate).not.toHaveBeenCalled();
  });

  it('does not allow an organization administrator to create in another organization', async () => {
    prismaMocks.userRole.findMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);

    await expect(service.createForUser('admin-1', {
      organizationId: 'org-2', name: 'North Hall', code: 'nh-1',
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaMocks.organization.findFirst).not.toHaveBeenCalled();
  });

  it('rejects creation in an archived or missing organization', async () => {
    prismaMocks.userRole.findMany.mockResolvedValue([{
      organizationId: null, hostelId: null, role: { name: 'SUPER_ADMIN' },
    }]);
    prismaMocks.organization.findFirst.mockResolvedValue(null);

    await expect(service.createForUser('admin-1', {
      organizationId: 'org-1', name: 'North Hall', code: 'nh-1',
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(prismaMocks.hostelCreate).not.toHaveBeenCalled();
  });

  it('reports organization-local duplicate hostel codes as conflicts', async () => {
    prismaMocks.userRole.findMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    prismaMocks.hostelCreate.mockRejectedValue({ code: 'P2002' });

    await expect(service.createForUser('admin-1', {
      name: 'North Hall', code: 'nh-1',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates a hostel using the organization assignment in the database write scope', async () => {
    prismaMocks.userRole.findMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);

    await service.updateForUser('admin-1', 'hostel-1', {
      name: 'Renamed Hall', address: null,
    });

    expect(prismaMocks.hostelUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'hostel-1',
        archivedAt: null,
        organization: { is: { archivedAt: null } },
        OR: [{ organizationId: { in: ['org-1'] } }],
      },
      data: { name: 'Renamed Hall', address: null },
    });
    expect(prismaMocks.hostelFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'hostel-1' },
    }));
  });

  it('limits a hostel-scoped administrator to the assigned hostel', async () => {
    prismaMocks.userRole.findMany.mockResolvedValue([{
      organizationId: null, hostelId: 'hostel-1', role: { name: 'HOSTEL_ADMIN' },
    }]);

    await service.updateForUser('admin-1', 'hostel-1', { name: 'Renamed Hall' });

    expect(prismaMocks.hostelUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: [{ id: { in: ['hostel-1'] } }] }),
    }));
  });

  it('does not update a hostel outside the persisted scope', async () => {
    prismaMocks.userRole.findMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    prismaMocks.hostelUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.updateForUser('admin-1', 'hostel-2', {
      name: 'Other Hall',
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(prismaMocks.hostelFindFirst).not.toHaveBeenCalled();
  });

  it('maps duplicate code changes to a conflict', async () => {
    prismaMocks.userRole.findMany.mockResolvedValue([{
      organizationId: null, hostelId: null, role: { name: 'SUPER_ADMIN' },
    }]);
    prismaMocks.hostelUpdateMany.mockRejectedValue({ code: 'P2002' });

    await expect(service.updateForUser('admin-1', 'hostel-1', {
      code: 'duplicate',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('archives an authorized hostel without deleting its retained data', async () => {
    prismaMocks.userRole.findMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);

    await expect(service.archiveForUser('admin-1', 'hostel-1')).resolves.toEqual({
      status: 'archived',
    });
    expect(prismaMocks.hostelUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'hostel-1',
        archivedAt: null,
        organization: { is: { archivedAt: null } },
        OR: [{ organizationId: { in: ['org-1'] } }],
      },
      data: { archivedAt: expect.any(Date) },
    });
  });

  it('does not archive an out-of-scope or already archived hostel', async () => {
    prismaMocks.userRole.findMany.mockResolvedValue([{
      organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' },
    }]);
    prismaMocks.hostelUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.archiveForUser('admin-1', 'hostel-2'))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
