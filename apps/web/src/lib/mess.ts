import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type MessSchedule = { id: string; hostelId: string; mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK"; startsAt: string; endsAt: string; menu: string | null; hostel: { name: string }; attendance: { studentId: string; attendedAt: string }[] };
export type MessScheduleMutation = Pick<MessSchedule, "id" | "hostelId" | "mealType" | "startsAt" | "endsAt" | "menu">;
export type MessStudent = { id: string; studentNumber: string; firstName: string; lastName: string; hostelIds: string[] };
export type MessResult = { status: "ok"; schedules: MessSchedule[]; hostels: { id: string; name: string }[]; students: MessStudent[] } | { status: "forbidden" | "unavailable" };

function isMessSchedule(value: unknown): value is MessSchedule {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const hostel = record.hostel as Record<string, unknown> | null;
  return typeof record.id === "string" && typeof record.hostelId === "string" &&
    ["BREAKFAST", "LUNCH", "DINNER", "SNACK"].includes(String(record.mealType)) &&
    typeof record.startsAt === "string" && Number.isFinite(Date.parse(record.startsAt)) &&
    typeof record.endsAt === "string" && Number.isFinite(Date.parse(record.endsAt)) &&
    Date.parse(record.endsAt) > Date.parse(record.startsAt) &&
    (record.menu === null || typeof record.menu === "string") &&
    typeof hostel?.name === "string" && Array.isArray(record.attendance) &&
    record.attendance.every((attendance: unknown) => {
      if (typeof attendance !== "object" || attendance === null) return false;
      const row = attendance as Record<string, unknown>;
      return typeof row.studentId === "string" && typeof row.attendedAt === "string" &&
        Number.isFinite(Date.parse(row.attendedAt));
    });
}

function isMessHostel(value: unknown): value is { id: string; name: string } {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.name === "string";
}

function isMessStudent(value: unknown): value is MessStudent {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.studentNumber === "string" &&
    typeof record.firstName === "string" && typeof record.lastName === "string" &&
    Array.isArray(record.hostelIds) && record.hostelIds.length > 0 &&
    record.hostelIds.every((hostelId: unknown) => typeof hostelId === "string");
}

export async function getMess(): Promise<MessResult> {
  const session = (await cookies()).get("hms_session")?.value;
  if (!session) redirect("/login");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    const response = await fetch(`${apiUrl}/api/v1/mess-schedules`, { headers: { Cookie: `hms_session=${encodeURIComponent(session)}` }, cache: "no-store" });
    if (response.status === 401) redirect("/login");
    if (response.status === 403) return { status: "forbidden" };
    if (!response.ok) return { status: "unavailable" };
    const value: unknown = await response.json();
    if (typeof value !== "object" || value === null) return { status: "unavailable" };
    const result = value as Record<string, unknown>;
    if (!Array.isArray(result.schedules) || !result.schedules.every(isMessSchedule) ||
      !Array.isArray(result.hostels) || !result.hostels.every(isMessHostel) ||
      !Array.isArray(result.students) || !result.students.every(isMessStudent)) return { status: "unavailable" };
    return { status: "ok", schedules: result.schedules, hostels: result.hostels, students: result.students };
  } catch { return { status: "unavailable" }; }
}
