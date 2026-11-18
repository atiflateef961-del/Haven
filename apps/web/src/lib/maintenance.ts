import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type MaintenanceRequest = { id: string; hostelId: string; title: string; description: string; status: "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"; complaintId: string | null; assigneeId: string | null; createdAt: string; complaint: { title: string; student: { userId: string | null; firstName: string; lastName: string; studentNumber: string } } | null; assignee: { employeeNumber: string; user: { firstName: string; lastName: string } } | null; hostel: { name: string } };
export type MaintenanceOption = { id: string; organizationId: string; name: string };
export type MaintenanceStaff = { id: string; employeeNumber: string; user: { firstName: string; lastName: string }; hostelAssignments: { hostelId: string }[] };
export type MaintenanceComplaint = { id: string; title: string; organizationId: string };
export type MaintenanceResult = { status: "ok"; requests: MaintenanceRequest[]; hostels: MaintenanceOption[]; staff: MaintenanceStaff[]; complaints: MaintenanceComplaint[] } | { status: "forbidden" | "unavailable" };

function isMaintenanceRequest(value: unknown): value is MaintenanceRequest {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const hostel = record.hostel as Record<string, unknown> | null;
  const complaint = record.complaint as Record<string, unknown> | null;
  const assignee = record.assignee as Record<string, unknown> | null;
  const complaintStudent = complaint?.student as Record<string, unknown> | null;
  const assigneeUser = assignee?.user as Record<string, unknown> | null;
  return typeof record.id === "string" && typeof record.hostelId === "string" &&
    typeof record.title === "string" && typeof record.description === "string" &&
    ["OPEN", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(String(record.status)) &&
    (record.complaintId === null || typeof record.complaintId === "string") &&
    (record.assigneeId === null || typeof record.assigneeId === "string") &&
    typeof record.createdAt === "string" && Number.isFinite(Date.parse(record.createdAt)) &&
    typeof hostel?.name === "string" &&
    (complaint === null || (typeof complaint.title === "string" && typeof complaintStudent?.firstName === "string" &&
      typeof complaintStudent.lastName === "string" && typeof complaintStudent.studentNumber === "string" &&
      (complaintStudent.userId === null || typeof complaintStudent.userId === "string"))) &&
    (assignee === null || (typeof assignee.employeeNumber === "string" &&
      typeof assigneeUser?.firstName === "string" && typeof assigneeUser.lastName === "string"));
}

function isMaintenanceOption(value: unknown): value is MaintenanceOption {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.organizationId === "string" &&
    typeof record.name === "string";
}

function isMaintenanceStaff(value: unknown): value is MaintenanceStaff {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const user = record.user as Record<string, unknown> | null;
  return typeof record.id === "string" && typeof record.employeeNumber === "string" &&
    typeof user?.firstName === "string" && typeof user.lastName === "string" &&
    Array.isArray(record.hostelAssignments) && record.hostelAssignments.every((assignment: unknown) =>
      typeof assignment === "object" && assignment !== null &&
      typeof (assignment as Record<string, unknown>).hostelId === "string");
}

function isMaintenanceComplaint(value: unknown): value is MaintenanceComplaint {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const student = record.student as Record<string, unknown> | null;
  return typeof record.id === "string" && typeof record.title === "string" &&
    typeof student?.organizationId === "string";
}

export async function getMaintenance(): Promise<MaintenanceResult> {
  const session = (await cookies()).get("hms_session")?.value;
  if (!session) redirect("/login");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    const response = await fetch(`${apiUrl}/api/v1/maintenance`, { headers: { Cookie: `hms_session=${encodeURIComponent(session)}` }, cache: "no-store" });
    if (response.status === 401) redirect("/login");
    if (response.status === 403) return { status: "forbidden" };
    if (!response.ok) return { status: "unavailable" };
    const value: unknown = await response.json();
    if (typeof value !== "object" || value === null) return { status: "unavailable" };
    const record = value as Record<string, unknown>;
    if (
      !Array.isArray(record.requests) || !record.requests.every(isMaintenanceRequest) ||
      !Array.isArray(record.hostels) || !record.hostels.every(isMaintenanceOption) ||
      !Array.isArray(record.staff) || !record.staff.every(isMaintenanceStaff) ||
      !Array.isArray(record.complaints) || !record.complaints.every(isMaintenanceComplaint)
    ) return { status: "unavailable" };
    return {
      status: "ok",
      requests: record.requests,
      hostels: record.hostels,
      staff: record.staff,
      complaints: record.complaints,
    };
  } catch { return { status: "unavailable" }; }
}
