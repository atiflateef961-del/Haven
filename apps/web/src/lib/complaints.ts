import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type Complaint = {
  id: string; title: string; description: string; status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  assignedStaffId: string | null; createdAt: string; updatedAt?: string;
  student?: { id: string; organizationId: string; studentNumber: string; firstName: string; lastName: string };
};
export type ComplaintStaff = { id: string; organizationId: string; employeeNumber: string; jobTitle: string; user: { firstName: string; lastName: string } };
export type ComplaintsResult = { status: "ok"; complaints: Complaint[]; staff: ComplaintStaff[]; canManage: boolean; canSubmit: boolean } | { status: "forbidden" | "unavailable" };

export async function getComplaints(): Promise<ComplaintsResult> {
  const session = (await cookies()).get("hms_session")?.value;
  if (!session) redirect("/login");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    const response = await fetch(`${apiUrl}/api/v1/complaints`, { headers: { Cookie: `hms_session=${encodeURIComponent(session)}` }, cache: "no-store" });
    if (response.status === 401) redirect("/login");
    if (response.status === 403) return { status: "forbidden" };
    if (!response.ok) return { status: "unavailable" };
    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null) return { status: "unavailable" };
    const result = payload as Record<string, unknown>;
    if (!Array.isArray(result.complaints) || !Array.isArray(result.staff) || typeof result.canManage !== "boolean" || typeof result.canSubmit !== "boolean") return { status: "unavailable" };
    const validComplaint = (item: unknown): item is Complaint => {
      if (typeof item !== "object" || item === null) return false;
      const value = item as Record<string, unknown>;
      const student = value.student as Record<string, unknown> | null | undefined;
      return typeof value.id === "string" && typeof value.title === "string" && typeof value.description === "string" &&
        ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(String(value.status)) &&
        (value.assignedStaffId === null || typeof value.assignedStaffId === "string") &&
        typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt)) &&
        (value.updatedAt === undefined || (typeof value.updatedAt === "string" && Number.isFinite(Date.parse(value.updatedAt)))) &&
        (student === undefined || (student !== null && typeof student.id === "string" && typeof student.organizationId === "string" &&
          typeof student.studentNumber === "string" && typeof student.firstName === "string" && typeof student.lastName === "string"));
    };
    const validStaff = (item: unknown): item is ComplaintStaff => {
      if (typeof item !== "object" || item === null) return false;
      const value = item as Record<string, unknown>; const user = value.user as Record<string, unknown> | null;
      return typeof value.id === "string" && typeof value.organizationId === "string" &&
        typeof value.employeeNumber === "string" && typeof value.jobTitle === "string" &&
        !!user && typeof user.firstName === "string" && typeof user.lastName === "string";
    };
    if (!result.complaints.every(validComplaint) || !result.staff.every(validStaff)) return { status: "unavailable" };
    return { status: "ok", complaints: result.complaints, staff: result.staff, canManage: result.canManage, canSubmit: result.canSubmit };
  } catch { return { status: "unavailable" }; }
}
