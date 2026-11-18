import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type VisitorStudent = { id: string; studentNumber: string; firstName: string; lastName: string };
export type VisitorStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "COMPLETED";
export type VisitorVisit = {
  id: string;
  visitAt: string;
  purpose: string | null;
  status: VisitorStatus;
  visitor: { name: string; phone: string | null };
  student: VisitorStudent;
};
export type VisitorsResult = { status: "ok"; visits: VisitorVisit[]; students: VisitorStudent[] } | { status: "forbidden" | "unavailable" };

function isVisitorStudent(item: unknown): item is VisitorStudent {
  if (typeof item !== "object" || item === null) return false;
  const record = item as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.studentNumber === "string" &&
    typeof record.firstName === "string" && typeof record.lastName === "string";
}

function isVisitorVisit(item: unknown): item is VisitorVisit {
  if (typeof item !== "object" || item === null) return false;
  const value = item as Record<string, unknown>;
  const visitor = value.visitor as Record<string, unknown> | null;
  return typeof value.id === "string" && typeof value.visitAt === "string" &&
    Number.isFinite(Date.parse(value.visitAt)) &&
    ["PENDING", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED"].includes(String(value.status)) &&
    (value.purpose === null || typeof value.purpose === "string") &&
    typeof visitor?.name === "string" && (visitor.phone === null || typeof visitor.phone === "string") &&
    isVisitorStudent(value.student);
}

export async function getVisitors(): Promise<VisitorsResult> {
  const session = (await cookies()).get("hms_session")?.value;
  if (!session) redirect("/login");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/v1/visitors`, {
      headers: { Cookie: `hms_session=${encodeURIComponent(session)}` }, cache: "no-store",
    });
  } catch { return { status: "unavailable" }; }
  if (response.status === 401) redirect("/login");
  if (response.status === 403) return { status: "forbidden" };
  if (!response.ok) return { status: "unavailable" };
  let payload: unknown;
  try { payload = await response.json(); } catch { return { status: "unavailable" }; }
  if (typeof payload !== "object" || payload === null) return { status: "unavailable" };
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.visits) || !record.visits.every(isVisitorVisit) ||
    !Array.isArray(record.students) || !record.students.every(isVisitorStudent)) return { status: "unavailable" };
  return { status: "ok", visits: record.visits, students: record.students };
}
