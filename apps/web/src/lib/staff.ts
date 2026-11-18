import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type ManagedStaff = { id: string; organizationId: string; userId: string; employeeNumber: string; jobTitle: string; user: { firstName: string; lastName: string; email: string }; hostelAssignments: { hostelId: string; hostel: { name: string } }[] };
export type StaffUser = { id: string; firstName: string; lastName: string; email: string; memberships: { organizationId: string }[] };
export type StaffData = { status: "ok"; staff: ManagedStaff[]; organizations: { id: string; name: string }[]; hostels: { id: string; organizationId: string; name: string }[]; users: StaffUser[]; canManage: boolean } | { status: "forbidden" | "unavailable" };

function isManagedStaff(value: unknown): value is ManagedStaff {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const user = record.user as Record<string, unknown> | null;
  return typeof record.id === "string" && typeof record.organizationId === "string" &&
    typeof record.userId === "string" && typeof record.employeeNumber === "string" &&
    typeof record.jobTitle === "string" && typeof user?.firstName === "string" &&
    typeof user.lastName === "string" && typeof user.email === "string" &&
    Array.isArray(record.hostelAssignments) && record.hostelAssignments.every((assignment: unknown) => {
      if (typeof assignment !== "object" || assignment === null) return false;
      const item = assignment as Record<string, unknown>;
      const hostel = item.hostel as Record<string, unknown> | null;
      return typeof item.hostelId === "string" && typeof hostel?.name === "string";
    });
}

function isOrganization(value: unknown): value is { id: string; name: string } {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.name === "string";
}

function isHostel(value: unknown): value is { id: string; organizationId: string; name: string } {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.organizationId === "string" &&
    typeof record.name === "string";
}

function isStaffUser(value: unknown): value is StaffUser {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.firstName === "string" &&
    typeof record.lastName === "string" && typeof record.email === "string" &&
    Array.isArray(record.memberships) && record.memberships.every((membership: unknown) => {
      if (typeof membership !== "object" || membership === null) return false;
      return typeof (membership as Record<string, unknown>).organizationId === "string";
    });
}

export async function getStaff(): Promise<StaffData> {
  const session = (await cookies()).get("hms_session")?.value;
  if (!session) redirect("/login");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    const response = await fetch(`${apiUrl}/api/v1/staff`, { headers: { Cookie: `hms_session=${encodeURIComponent(session)}` }, cache: "no-store" });
    if (response.status === 401) redirect("/login");
    if (response.status === 403) return { status: "forbidden" };
    if (!response.ok) return { status: "unavailable" };
    const value: unknown = await response.json();
    if (typeof value !== "object" || value === null) return { status: "unavailable" };
    const result = value as Record<string, unknown>;
    if (
      !Array.isArray(result.staff) || !result.staff.every(isManagedStaff) ||
      !Array.isArray(result.organizations) || !result.organizations.every(isOrganization) ||
      !Array.isArray(result.hostels) || !result.hostels.every(isHostel) ||
      !Array.isArray(result.users) || !result.users.every(isStaffUser) ||
      typeof result.canManage !== "boolean"
    ) return { status: "unavailable" };
    return {
      status: "ok",
      staff: result.staff,
      organizations: result.organizations,
      hostels: result.hostels,
      users: result.users,
      canManage: result.canManage,
    };
  } catch { return { status: "unavailable" }; }
}
