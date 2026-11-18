import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type Hostel = {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  address: string | null;
  createdAt: string;
  organization: { name: string };
};

export type HostelDirectoryResult =
  | {
      status: "ok";
      hostels: Hostel[];
      creatableOrganizations: { id: string; name: string }[];
      manageableHostelIds: string[];
    }
  | { status: "forbidden" | "unavailable" };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function isHostel(value: unknown): value is Hostel {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.organization !== "object" || record.organization === null) return false;
  const organization = record.organization as Record<string, unknown>;
  return typeof record.id === "string" &&
    typeof record.organizationId === "string" &&
    typeof record.name === "string" &&
    typeof record.code === "string" &&
    (record.address === null || typeof record.address === "string") &&
    typeof record.createdAt === "string" &&
    Number.isFinite(Date.parse(record.createdAt)) &&
    typeof organization.name === "string";
}

export async function getHostelDirectory(): Promise<HostelDirectoryResult> {
  const session = (await cookies()).get("hms_session")?.value;
  if (!session) redirect("/login");

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/v1/hostels`, {
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
    if (
      !Array.isArray(record.hostels) || !record.hostels.every(isHostel) ||
      !Array.isArray(record.creatableOrganizations) ||
      !record.creatableOrganizations.every((organization: unknown) => {
        if (typeof organization !== "object" || organization === null) return false;
        const item = organization as Record<string, unknown>;
        return typeof item.id === "string" && typeof item.name === "string";
      }) ||
      !Array.isArray(record.manageableHostelIds) ||
      !record.manageableHostelIds.every((id: unknown) => typeof id === "string")
    ) return { status: "unavailable" };

    return {
      status: "ok",
      hostels: record.hostels,
      creatableOrganizations: record.creatableOrganizations as { id: string; name: string }[],
      manageableHostelIds: record.manageableHostelIds as string[],
    };
  } catch {
    return { status: "unavailable" };
  }
}
