import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type Room = {
  id: string;
  floorId: string;
  number: string;
  roomType: string | null;
  description: string | null;
};

export type RoomDirectoryResult =
  | { status: "ok"; rooms: Room[] }
  | { status: "not-found" | "unavailable" };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function isRoom(value: unknown): value is Room {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.floorId === "string" &&
    typeof record.number === "string" &&
    (record.roomType === null || typeof record.roomType === "string") &&
    (record.description === null || typeof record.description === "string");
}

export async function getRooms(
  hostelId: string,
  buildingId: string,
  floorId: string,
): Promise<RoomDirectoryResult> {
  const session = (await cookies()).get("hms_session")?.value;
  if (!session) redirect("/login");

  let response: Response;
  try {
    response = await fetch(
      `${apiUrl}/api/v1/hostels/${encodeURIComponent(hostelId)}/buildings/${encodeURIComponent(buildingId)}/floors/${encodeURIComponent(floorId)}/rooms`,
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
    if (!Array.isArray(payload) || !payload.every(isRoom) ||
      payload.some((room) => room.floorId !== floorId)) {
      return { status: "unavailable" };
    }
    return { status: "ok", rooms: payload };
  } catch {
    return { status: "unavailable" };
  }
}
