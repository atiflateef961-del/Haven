import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type Bed = {
  id: string;
  roomId: string;
  label: string;
  isActive: boolean;
  isOccupied: boolean;
};

export type FloorBedsResult =
  | { status: "ok"; beds: Bed[] }
  | { status: "not-found" | "unavailable" };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function isBed(value: unknown): value is Bed {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.roomId === "string" &&
    typeof record.label === "string" && typeof record.isActive === "boolean" &&
    typeof record.isOccupied === "boolean";
}

export async function getFloorBeds(hostelId: string, buildingId: string, floorId: string): Promise<FloorBedsResult> {
  const session = (await cookies()).get("hms_session")?.value;
  if (!session) redirect("/login");

  let response: Response;
  try {
    response = await fetch(
      `${apiUrl}/api/v1/hostels/${encodeURIComponent(hostelId)}/buildings/${encodeURIComponent(buildingId)}/floors/${encodeURIComponent(floorId)}/beds`,
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
    if (!Array.isArray(payload) || !payload.every(isBed)) return { status: "unavailable" };
    return { status: "ok", beds: payload };
  } catch {
    return { status: "unavailable" };
  }
}
