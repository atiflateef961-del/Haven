import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type OrganizationSummary = {
  organizationId: string;
  organizationName: string;
  currency: string;
  hostels: number;
  buildings: number;
  rooms: number;
  beds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRate: number | null;
  collectedLast30Days: string | null;
  hostelOccupancy: {
    hostelId: string;
    hostelName: string;
    beds: number;
    occupiedBeds: number;
    availableBeds: number;
    occupancyRate: number | null;
  }[];
  students: number;
  recentRegistrations: {
    id: string;
    firstName: string;
    lastName: string;
    createdAt: string;
  }[];
  recentActivity: {
    id: string;
    action: string;
    resourceType: string;
    createdAt: string;
  }[] | null;
};

export type DashboardSummaryResult =
  | { status: "ok"; organizations: OrganizationSummary[] }
  | { status: "forbidden" | "unavailable" };

export type DashboardNotification = {
  id: string;
  organizationId: string | null;
  title: string;
  body: string;
  status: "PENDING" | "SENT" | "FAILED";
  readAt: string | null;
  emailStatus: "SENT" | "FAILED" | null;
  createdAt: string;
};

export type DashboardEmailFailure = { id: string; title: string; email: string; emailError: string | null; createdAt: string };

export type DashboardNotificationsResult =
  | { status: "ok"; notifications: DashboardNotification[]; emailFailures: DashboardEmailFailure[] }
  | { status: "unavailable" };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isAccurateOccupancyRate(value: unknown, beds: number, occupiedBeds: number) {
  if (beds === 0) return value === null;
  return typeof value === "number" && Number.isFinite(value) &&
    value === Math.round((occupiedBeds / beds) * 1000) / 10;
}

function isHostelOccupancy(value: unknown): value is OrganizationSummary["hostelOccupancy"][number] {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const beds = record.beds;
  const occupiedBeds = record.occupiedBeds;
  const availableBeds = record.availableBeds;
  return typeof record.hostelId === "string" && record.hostelId.length > 0 &&
    typeof record.hostelName === "string" && record.hostelName.length > 0 &&
    isNonNegativeInteger(beds) && isNonNegativeInteger(occupiedBeds) &&
    isNonNegativeInteger(availableBeds) && occupiedBeds <= beds &&
    availableBeds === beds - occupiedBeds &&
    isAccurateOccupancyRate(record.occupancyRate, beds, occupiedBeds);
}

function isOrganizationSummary(value: unknown): value is OrganizationSummary {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const hostels = record.hostels;
  const buildings = record.buildings;
  const rooms = record.rooms;
  const beds = record.beds;
  const occupiedBeds = record.occupiedBeds;
  const availableBeds = record.availableBeds;
  const students = record.students;
  return typeof record.organizationId === "string" && record.organizationId.length > 0 &&
    typeof record.organizationName === "string" && record.organizationName.length > 0 &&
    typeof record.currency === "string" && /^[A-Z]{3}$/.test(record.currency) &&
    isNonNegativeInteger(hostels) && isNonNegativeInteger(buildings) &&
    isNonNegativeInteger(rooms) && isNonNegativeInteger(beds) &&
    isNonNegativeInteger(occupiedBeds) && isNonNegativeInteger(availableBeds) &&
    occupiedBeds <= beds && availableBeds === beds - occupiedBeds &&
    isAccurateOccupancyRate(record.occupancyRate, beds, occupiedBeds) &&
    (record.collectedLast30Days === null ||
      (typeof record.collectedLast30Days === "string" && /^\d{1,10}\.\d{2}$/.test(record.collectedLast30Days))) &&
    Array.isArray(record.hostelOccupancy) && record.hostelOccupancy.every(isHostelOccupancy) &&
    isNonNegativeInteger(students) &&
    Array.isArray(record.recentRegistrations) && record.recentRegistrations.length <= 5 &&
    record.recentRegistrations.every((registration: unknown) => {
      if (typeof registration !== "object" || registration === null) return false;
      const item = registration as Record<string, unknown>;
      return typeof item.id === "string" &&
        typeof item.firstName === "string" &&
        typeof item.lastName === "string" &&
        typeof item.createdAt === "string" &&
        Number.isFinite(Date.parse(item.createdAt));
    }) &&
    (record.recentActivity === null ||
      (Array.isArray(record.recentActivity) && record.recentActivity.length <= 5 &&
        record.recentActivity.every((activity: unknown) => {
          if (typeof activity !== "object" || activity === null) return false;
          const item = activity as Record<string, unknown>;
          return typeof item.id === "string" &&
            typeof item.action === "string" &&
            typeof item.resourceType === "string" &&
            typeof item.createdAt === "string" &&
            Number.isFinite(Date.parse(item.createdAt));
        })));
}

export async function getDashboardSummary(): Promise<DashboardSummaryResult> {
  const session = (await cookies()).get("hms_session")?.value;
  if (!session) redirect("/login");

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/v1/dashboard/summary`, {
      headers: { Cookie: `hms_session=${encodeURIComponent(session)}` },
      cache: "no-store",
    });
  } catch {
    return { status: "unavailable" };
  }

  if (response.status === 401) redirect("/login");
  if (response.status === 403) return { status: "forbidden" };
  if (!response.ok) return { status: "unavailable" };

  try {
    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || !payload.every(isOrganizationSummary)) {
      return { status: "unavailable" };
    }
    return { status: "ok", organizations: payload };
  } catch {
    return { status: "unavailable" };
  }
}

export async function getDashboardNotifications(): Promise<DashboardNotificationsResult> {
  const session = (await cookies()).get("hms_session")?.value;
  if (!session) redirect("/login");

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/v1/dashboard/notifications`, {
      headers: { Cookie: `hms_session=${encodeURIComponent(session)}` },
      cache: "no-store",
    });
  } catch {
    return { status: "unavailable" };
  }

  if (response.status === 401) redirect("/login");
  if (!response.ok) return { status: "unavailable" };

  try {
    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null || !Array.isArray((payload as { notifications?: unknown }).notifications)) return { status: "unavailable" };
    const raw = (payload as { notifications: unknown[] }).notifications;
    const notifications = raw.filter((value): value is DashboardNotification => {
      if (typeof value !== "object" || value === null) return false;
      const item = value as Record<string, unknown>;
      return typeof item.id === "string" &&
        (item.organizationId === null || typeof item.organizationId === "string") &&
        typeof item.title === "string" &&
        typeof item.body === "string" &&
        (item.status === "PENDING" || item.status === "SENT" || item.status === "FAILED") &&
        (item.readAt === null || (typeof item.readAt === "string" && Number.isFinite(Date.parse(item.readAt)))) &&
        (item.emailStatus === null || item.emailStatus === "SENT" || item.emailStatus === "FAILED") &&
        typeof item.createdAt === "string" &&
        Number.isFinite(Date.parse(item.createdAt));
    });
    if (notifications.length !== raw.length) return { status: "unavailable" };
    let emailFailures: DashboardEmailFailure[] = [];
    try {
      const failuresResponse = await fetch(`${apiUrl}/api/v1/notifications/email-failures`, {
        headers: { Cookie: `hms_session=${encodeURIComponent(session)}` }, cache: "no-store",
      });
      if (failuresResponse.ok) {
        const failurePayload: unknown = await failuresResponse.json();
        if (typeof failurePayload !== "object" || failurePayload === null || !Array.isArray((failurePayload as { failures?: unknown }).failures)) return { status: "unavailable" };
        const rawFailures = (failurePayload as { failures: unknown[] }).failures;
        if (!rawFailures.every((value) => {
          if (typeof value !== "object" || value === null) return false;
          const item = value as Record<string, unknown>;
          return typeof item.id === "string" && typeof item.title === "string" &&
            (item.emailError === null || typeof item.emailError === "string") &&
            typeof item.createdAt === "string" && Number.isFinite(Date.parse(item.createdAt)) &&
            typeof item.user === "object" && item.user !== null &&
            typeof (item.user as Record<string, unknown>).email === "string";
        })) return { status: "unavailable" };
        emailFailures = rawFailures.map((value) => {
          const item = value as Record<string, unknown>;
          return {
            id: item.id as string, title: item.title as string,
            email: (item.user as Record<string, unknown>).email as string,
            emailError: item.emailError as string | null, createdAt: item.createdAt as string,
          };
        });
      }
    } catch {
      // The personal notification list remains available if the optional admin report is unavailable.
    }
    return { status: "ok", notifications, emailFailures };
  } catch {
    return { status: "unavailable" };
  }
}
