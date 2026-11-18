import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type Building = {
  id: string;
  hostelId: string;
  name: string;
  roomCount: number;
};

export type BuildingDirectoryResult =
  | { status: "ok"; buildings: Building[] }
  | { status: "not-found" | "unavailable" };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function isBuilding(value: unknown): value is Building {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" &&
    typeof record.hostelId === "string" &&
    typeof record.name === "string" &&
    typeof record.roomCount === "number" &&
    Number.isInteger(record.roomCount) && record.roomCount >= 0;
}

export async function getBuildings(hostelId: string): Promise<BuildingDirectoryResult> {
  const session = (await cookies()).get("hms_session")?.value;
  if (!session) redirect("/login");

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/v1/hostels/${encodeURIComponent(hostelId)}/buildings`, {
      headers: { Cookie: `hms_session=${encodeURIComponent(session)}` },
      cache: "no-store",
    });
  } catch {
    return { status: "unavailable" };
  }

  if (response.status === 401) redirect("/login");
  if (response.status === 404) return { status: "not-found" };
  if (!response.ok) return { status: "unavailable" };

  try {
    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || !payload.every(isBuilding) ||
      payload.some((building) => building.hostelId !== hostelId)) {
      return { status: "unavailable" };
    }
    return { status: "ok", buildings: payload };
  } catch {
    return { status: "unavailable" };
  }
}
