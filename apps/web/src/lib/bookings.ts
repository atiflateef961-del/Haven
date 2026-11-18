import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type BookingReview = {
  id: string;
  requestedFrom: string;
  requestedUntil: string | null;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "CANCELLED" | "FULFILLED";
  notes: string | null;
  createdAt: string;
  student: {
    id: string;
    studentNumber: string;
    firstName: string;
    lastName: string;
    organization: { id: string; name: string };
  };
};

export type BookingReviewResult =
  | { status: "ok"; bookings: BookingReview[]; page: number; hasMore: boolean }
  | { status: "forbidden" | "unavailable" };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function isDate(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isBookingReview(value: unknown): value is BookingReview {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const student = record.student as Record<string, unknown> | null;
  const organization = student?.organization as Record<string, unknown> | null;
  return typeof record.id === "string" && isDate(record.requestedFrom) &&
    (record.requestedUntil === null || isDate(record.requestedUntil)) &&
    ["REQUESTED", "APPROVED", "REJECTED", "CANCELLED", "FULFILLED"].includes(String(record.status)) &&
    (record.notes === null || typeof record.notes === "string") && isDate(record.createdAt) &&
    typeof student?.id === "string" && typeof student.studentNumber === "string" &&
    typeof student.firstName === "string" && typeof student.lastName === "string" &&
    typeof organization?.id === "string" && typeof organization.name === "string";
}

export async function getBookingRequests(page: number): Promise<BookingReviewResult> {
  const session = (await cookies()).get("hms_session")?.value;
  if (!session) redirect("/login");

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/v1/bookings?page=${page}&pageSize=25`, {
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
    if (typeof payload !== "object" || payload === null) return { status: "unavailable" };
    const record = payload as Record<string, unknown>;
    if (!Array.isArray(record.bookings) || !record.bookings.every(isBookingReview) || record.bookings.length > 25 ||
      record.page !== page || record.pageSize !== 25 || typeof record.hasMore !== "boolean") return { status: "unavailable" };
    return { status: "ok", bookings: record.bookings, page, hasMore: record.hasMore };
  } catch {
    return { status: "unavailable" };
  }
}
