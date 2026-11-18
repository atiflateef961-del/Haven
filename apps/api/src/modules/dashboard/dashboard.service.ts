import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

const DASHBOARD_ROLES = ['SUPER_ADMIN', 'HOSTEL_ADMIN', 'WARDEN', 'ACCOUNTANT'];

type RoleAssignment = {
  organizationId: string | null;
  hostelId: string | null;
  role: { name: string };
  hostel: { id: string; organizationId: string } | null;
};

type DashboardScope = {
  organizationWide: boolean;
  hostelIds: Set<string>;
  canViewRecentRegistrations: boolean;
  canViewCollections: boolean;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  getRecentNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, status: { in: ['PENDING', 'SENT'] } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        body: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async getSummary(userId: string) {
    const assignments = await this.prisma.userRole.findMany({
      where: { userId, role: { name: { in: DASHBOARD_ROLES } } },
      select: {
        organizationId: true,
        hostelId: true,
        role: { select: { name: true } },
        hostel: { select: { id: true, organizationId: true } },
      },
    }) as RoleAssignment[];

    const globalAccess = assignments.some(
      (assignment) => assignment.role.name === 'SUPER_ADMIN' &&
        assignment.organizationId === null && assignment.hostelId === null,
    );
    const scopes = new Map<string, DashboardScope>();
    const collectionThrough = new Date();
    const collectionFrom = new Date(collectionThrough.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (const assignment of assignments) {
      const organizationId = assignment.organizationId ?? assignment.hostel?.organizationId;
      if (!organizationId) continue;

      const scope = scopes.get(organizationId) ?? {
        organizationWide: false,
        hostelIds: new Set<string>(),
        canViewRecentRegistrations: false,
        canViewCollections: false,
      };
      if (assignment.role.name === 'HOSTEL_ADMIN' || assignment.role.name === 'WARDEN') {
        scope.canViewRecentRegistrations = true;
      }
      if (assignment.role.name === 'HOSTEL_ADMIN' || assignment.role.name === 'ACCOUNTANT') {
        scope.canViewCollections = true;
      }
      if (assignment.organizationId === organizationId && assignment.hostelId === null) {
        scope.organizationWide = true;
      } else if (assignment.hostel) {
        scope.hostelIds.add(assignment.hostel.id);
      }
      scopes.set(organizationId, scope);
    }

    if (!globalAccess && scopes.size === 0) {
      throw new ForbiddenException('Dashboard access is not assigned to this account');
    }

    const organizations = await this.prisma.organization.findMany({
      where: globalAccess
        ? { archivedAt: null }
        : { id: { in: [...scopes.keys()] }, archivedAt: null },
      select: { id: true, name: true, currency: true },
      orderBy: { name: 'asc' },
    });

    return Promise.all(organizations.map(async (organization) => {
      const scope = scopes.get(organization.id);
      const hostels = await this.prisma.hostel.findMany({
        where: {
          organizationId: organization.id,
          archivedAt: null,
          ...(!globalAccess && scope && !scope.organizationWide
            ? { id: { in: [...scope.hostelIds] } }
            : {}),
        },
        select: { id: true, name: true },
      });
      const hostelIds = hostels.map((hostel) => hostel.id);
      const hostelOccupancy = hostelIds.length === 0
        ? []
        : await this.prisma.$queryRaw<Array<{
            hostelId: string;
            hostelName: string;
            beds: number;
            occupiedBeds: number;
          }>>`
            SELECT h."id" AS "hostelId",
                   h."name" AS "hostelName",
                   COUNT(DISTINCT b."id") FILTER (WHERE b."isActive")::int AS "beds",
                   COUNT(DISTINCT b."id") FILTER (
                     WHERE b."isActive" AND ba."id" IS NOT NULL
                   )::int AS "occupiedBeds"
            FROM "Hostel" h
            LEFT JOIN "Building" bu ON bu."hostelId" = h."id"
            LEFT JOIN "Floor" f ON f."buildingId" = bu."id"
            LEFT JOIN "Room" r ON r."floorId" = f."id" AND r."archivedAt" IS NULL
            LEFT JOIN "Bed" b ON b."roomId" = r."id"
            LEFT JOIN "BedAllocation" ba ON ba."bedId" = b."id"
              AND ba."status" = 'ACTIVE'::"AllocationStatus"
              AND ba."endedAt" IS NULL
            WHERE h."organizationId" = ${organization.id}
              AND h."id" = ANY(${hostelIds}::uuid[])
            GROUP BY h."id", h."name"
            ORDER BY h."name" ASC
          `;
      const studentScope = !globalAccess && scope && !scope.organizationWide
        ? {
            allocations: {
              some: {
                status: 'ACTIVE' as const,
                endedAt: null,
                bed: { room: { archivedAt: null, floor: { building: { hostelId: { in: hostelIds } } } } },
              },
            },
          }
        : {};

      const [buildings, rooms, beds, occupiedBeds, students] = await Promise.all([
        this.prisma.building.count({ where: { hostelId: { in: hostelIds } } }),
        this.prisma.room.count({
          where: { archivedAt: null, floor: { building: { hostelId: { in: hostelIds } } } },
        }),
        this.prisma.bed.count({
          where: {
            isActive: true,
            room: { archivedAt: null, floor: { building: { hostelId: { in: hostelIds } } } },
          },
        }),
        this.prisma.bedAllocation.count({
          where: {
            status: 'ACTIVE',
            endedAt: null,
            bed: {
              isActive: true,
              room: { archivedAt: null, floor: { building: { hostelId: { in: hostelIds } } } },
            },
          },
        }),
        this.prisma.student.count({
          where: { organizationId: organization.id, archivedAt: null, ...studentScope },
        }),
      ]);
      const canViewCollections = globalAccess || Boolean(scope?.organizationWide && scope.canViewCollections);
      const collection = canViewCollections
        ? await this.prisma.payment.aggregate({
            where: {
              status: 'SUCCEEDED',
              currency: organization.currency,
              receivedAt: { gte: collectionFrom, lte: collectionThrough },
              invoice: { student: { organizationId: organization.id, archivedAt: null } },
            },
            _sum: { amount: true },
          })
        : null;

      const recentRegistrations = scope?.canViewRecentRegistrations
        ? await this.prisma.student.findMany({
            where: {
              organizationId: organization.id,
              archivedAt: null,
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                lte: new Date(),
              },
              ...studentScope,
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { id: true, firstName: true, lastName: true, createdAt: true },
          })
        : [];
      const recentActivity = globalAccess || scope?.organizationWide
        ? await this.prisma.auditLog.findMany({
            where: {
              organizationId: organization.id,
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                lte: new Date(),
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { id: true, action: true, resourceType: true, createdAt: true },
          })
        : null;

      return {
        organizationId: organization.id,
        organizationName: organization.name,
        currency: organization.currency,
        hostels: hostels.length,
        buildings,
        rooms,
        beds,
        occupiedBeds,
        availableBeds: beds - occupiedBeds,
        occupancyRate: beds === 0
          ? null
          : Math.round((occupiedBeds / beds) * 1000) / 10,
        collectedLast30Days: collection?._sum.amount?.toString() ?? (canViewCollections ? '0.00' : null),
        hostelOccupancy: hostelOccupancy.map((hostel) => ({
          ...hostel,
          occupancyRate: hostel.beds === 0
            ? null
            : Math.round((hostel.occupiedBeds / hostel.beds) * 1000) / 10,
          availableBeds: hostel.beds - hostel.occupiedBeds,
        })),
        students,
        recentRegistrations,
        recentActivity,
      };
    }));
  }
}
