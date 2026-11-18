import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type AvailableRoom = {
  id: string;
  number: string;
  roomType: string | null;
  capacity: number;
  occupiedBeds: number;
  freeBeds: number;
  status: "No beds" | "Free" | "Partly occupied" | "Full";
  floor: { id: string; number: number; building: { id: string; name: string } };
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function getRoomAvailability(hostelId: string) {
  const session = (await cookies()).get("hms_session")?.value;
  if (!session) redirect("/login");
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/v1/hostels/${encodeURIComponent(hostelId)}/rooms/availability`, {
      headers: { Cookie: `hms_session=${encodeURIComponent(session)}` },
      cache: "no-store",
    });
  } catch {
    return { status: "unavailable" as const };
  }
  if (response.status === 401) redirect("/login");
  if (!response.ok) return { status: response.status === 404 ? "not-found" as const : "unavailable" as const };
  try {
    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || !payload.every(isAvailableRoom)) return { status: "unavailable" as const };
    return { status: "ok" as const, rooms: payload };
  } catch {
    return { status: "unavailable" as const };
  }
}

function isAvailableRoom(value: unknown): value is AvailableRoom {
  if (typeof value !== "object" || value === null) return false;
  const room = value as Record<string, unknown>;
  const floor = room.floor as Record<string, unknown> | null;
  const building = floor?.building as Record<string, unknown> | null;
  const capacity = room.capacity;
  const occupiedBeds = room.occupiedBeds;
  const freeBeds = room.freeBeds;
  if (
    typeof room.id !== "string" || typeof room.number !== "string" ||
    (room.roomType !== null && typeof room.roomType !== "string") ||
    typeof capacity !== "number" || !Number.isInteger(capacity) || capacity < 0 ||
    typeof occupiedBeds !== "number" || !Number.isInteger(occupiedBeds) || occupiedBeds < 0 ||
    typeof freeBeds !== "number" || !Number.isInteger(freeBeds) || freeBeds < 0 ||
    occupiedBeds + freeBeds !== capacity ||
    typeof floor?.id !== "string" || typeof floor.number !== "number" || !Number.isInteger(floor.number) ||
    typeof building?.id !== "string" || typeof building.name !== "string"
  ) return false;

  const expectedStatus = capacity === 0
    ? "No beds"
    : occupiedBeds === 0
      ? "Free"
      : freeBeds === 0
        ? "Full"
        : "Partly occupied";
  return room.status === expectedStatus;
}
