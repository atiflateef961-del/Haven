import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type Student = {
  id: string;
  organizationId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  educationInstitution: string | null;
  educationProgram: string | null;
  educationYear: string | null;
  gender?: "Male" | "Female" | "Other" | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "GRADUATED";
  createdAt: string;
};

export type StudentSelfProfile = Omit<Student, "createdAt">;

export type StudentSelfProfileResult =
  | { status: "ok"; profile: StudentSelfProfile }
  | { status: "no-profile" | "unavailable" };

export type StudentPageResult =
  | {
      status: "ok";
      students: Student[];
      page: number;
      pageSize: number;
      hasMore: boolean;
      creatableOrganizations: { id: string; name: string }[];
    }
  | { status: "forbidden" | "unavailable" };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function isStudent(value: unknown): value is Student {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" &&
    typeof record.organizationId === "string" &&
    typeof record.studentNumber === "string" &&
    typeof record.firstName === "string" &&
    typeof record.lastName === "string" &&
    (record.email === null || typeof record.email === "string") &&
    (record.phone === null || typeof record.phone === "string") &&
    (record.dateOfBirth === null || (typeof record.dateOfBirth === "string" && Number.isFinite(Date.parse(record.dateOfBirth)))) &&
    (record.educationInstitution === null || typeof record.educationInstitution === "string") &&
    (record.educationProgram === null || typeof record.educationProgram === "string") &&
    (record.educationYear === null || typeof record.educationYear === "string") &&
    ["ACTIVE", "INACTIVE", "SUSPENDED", "GRADUATED"].includes(String(record.status)) &&
    typeof record.createdAt === "string" && Number.isFinite(Date.parse(record.createdAt));
}

export async function getStudents(page: number): Promise<StudentPageResult> {
  const session = (await cookies()).get("hms_session")?.value;
  if (!session) redirect("/login");

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/v1/students?page=${page}&pageSize=25`, {
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
    if (!Array.isArray(record.students) || !record.students.every(isStudent) ||
      record.students.length > 25 || record.page !== page || record.pageSize !== 25 ||
      typeof record.hasMore !== "boolean" || !Array.isArray(record.creatableOrganizations) ||
      !record.creatableOrganizations.every((organization: unknown) => {
        if (typeof organization !== "object" || organization === null) return false;
        const item = organization as Record<string, unknown>;
        return typeof item.id === "string" && typeof item.name === "string";
      })) return { status: "unavailable" };
    return {
      status: "ok",
      students: record.students,
      page: record.page,
      pageSize: record.pageSize,
      hasMore: record.hasMore,
      creatableOrganizations: record.creatableOrganizations as { id: string; name: string }[],
    };
  } catch {
    return { status: "unavailable" };
  }
}

function isStudentSelfProfile(value: unknown): value is StudentSelfProfile {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.organizationId === "string" &&
    typeof record.studentNumber === "string" && typeof record.firstName === "string" &&
    typeof record.lastName === "string" &&
    (record.email === null || typeof record.email === "string") &&
    (record.phone === null || typeof record.phone === "string") &&
    (record.dateOfBirth === null || (typeof record.dateOfBirth === "string" && Number.isFinite(Date.parse(record.dateOfBirth)))) &&
    (record.educationInstitution === null || typeof record.educationInstitution === "string") &&
    (record.educationProgram === null || typeof record.educationProgram === "string") &&
    (record.educationYear === null || typeof record.educationYear === "string") &&
    ["ACTIVE", "INACTIVE", "SUSPENDED", "GRADUATED"].includes(String(record.status));
}

export async function getMyStudentProfile(): Promise<StudentSelfProfileResult> {
  const session = (await cookies()).get("hms_session")?.value;
  if (!session) redirect("/login");

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/v1/students/me`, {
      headers: { Cookie: `hms_session=${encodeURIComponent(session)}` },
      cache: "no-store",
    });
  } catch {
    return { status: "unavailable" };
  }

  if (response.status === 401) redirect("/login");
  if (response.status === 404) return { status: "no-profile" };
  if (!response.ok) return { status: "unavailable" };

  try {
    const payload: unknown = await response.json();
    if (!isStudentSelfProfile(payload)) return { status: "unavailable" };
    return { status: "ok", profile: payload };
  } catch {
    return { status: "unavailable" };
  }
}
