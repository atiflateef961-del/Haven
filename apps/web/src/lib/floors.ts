import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type Floor = {
  id: string;
  buildingId: string;
  number: number;
};

export type FloorDirectoryResult =
  | { status: "ok"; floors: Floor[] }
  | { status: "not-found" | "unavailable" };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function isFloor(value: unknown): value is Floor {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" &&
    typeof record.buildingId === "string" &&
    typeof record.number === "number" && Number.isInteger(record.number);
}

export async function getFloors(hostelId: string, buildingId: string): Promise<FloorDirectoryResult> {
  const session = (await cookies()).get("hms_session")?.value;
  if (!session) redirect("/login");

  let response: Response;
  try {
    response = await fetch(
      `${apiUrl}/api/v1/hostels/${encodeURIComponent(hostelId)}/buildings/${encodeURIComponent(buildingId)}/floors`,
      {
        headers: { Cookie: `hms_session=${encodeURIComponent(session)}` },
        cache: "no-store",
      },
    );
  } catch {
    return { status: "unavailable" };
  }

  if (response.status === 401) redirect("/login");
  if (response.status === 404) return { status: "not-found" };
  if (!response.ok) return { status: "unavailable" };

  try {
    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || !payload.every(isFloor) ||
      payload.some((floor) => floor.buildingId !== buildingId)) {
      return { status: "unavailable" };
    }
    return { status: "ok", floors: payload };
  } catch {
    return { status: "unavailable" };
  }
}
