"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { apiBaseUrl } from "@/lib/api-url.mjs";

async function createRecord(url: string, body: object) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Your session expired. Sign in again to continue.");
    const messages: Record<number, string> = {
      400: "Some setup details are invalid. Check them and try again.",
      403: "Your account no longer has permission to set up this hostel.",
      409: "A record with one of these names or numbers already exists.",
    };
    throw new Error(messages[response.status] ?? `Setup failed (HTTP ${response.status}). Your earlier steps were saved; refresh and continue from Hostels.`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

export function HostelSetupWizard({ organizationId, organizationName }: {
  organizationId: string;
  organizationName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const values = new FormData(event.currentTarget);
    const hostelName = String(values.get("hostelName") ?? "").trim();
    const buildingName = String(values.get("buildingName") ?? "").trim();
    const floorNumber = Number(values.get("floorNumber"));
    const roomNumber = String(values.get("roomNumber") ?? "").trim();
    const roomType = String(values.get("roomType") ?? "").trim();
    const capacity = Number(values.get("capacity"));
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100 || !Number.isInteger(floorNumber)) {
      setError("Enter a valid floor and a bed capacity from 1 to 100.");
      return;
    }

    setPending(true);
    setError(null);
    const apiOrigin = apiBaseUrl;
    try {
      const hostel = await createRecord(`${apiOrigin}/api/v1/hostels`, {
        organizationId,
        name: hostelName,
        code: hostelName.toUpperCase().replace(/[^A-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || `HOSTEL-${Date.now()}`,
      });
      const hostelId = String(hostel.id ?? "");
      if (!hostelId) throw new Error("The hostel was created but its identifier was not returned. Refresh Hostels to continue.");
      const building = await createRecord(`${apiOrigin}/api/v1/hostels/${encodeURIComponent(hostelId)}/buildings`, { name: buildingName });
      const buildingId = String(building.id ?? "");
      if (!buildingId) throw new Error("The building was created but its identifier was not returned. Refresh Hostels to continue.");
      const floor = await createRecord(`${apiOrigin}/api/v1/hostels/${encodeURIComponent(hostelId)}/buildings/${encodeURIComponent(buildingId)}/floors`, { number: floorNumber });
      const floorId = String(floor.id ?? "");
      if (!floorId) throw new Error("The floor was created but its identifier was not returned. Refresh Hostels to continue.");
      const room = await createRecord(`${apiOrigin}/api/v1/hostels/${encodeURIComponent(hostelId)}/buildings/${encodeURIComponent(buildingId)}/floors/${encodeURIComponent(floorId)}/rooms`, {
        number: roomNumber,
        ...(roomType ? { roomType } : {}),
      });
      const roomId = String(room.id ?? "");
      if (!roomId) throw new Error("The room was created but its identifier was not returned. Refresh Hostels to continue.");
      const bedUrl = `${apiOrigin}/api/v1/hostels/${encodeURIComponent(hostelId)}/buildings/${encodeURIComponent(buildingId)}/floors/${encodeURIComponent(floorId)}/rooms/${encodeURIComponent(roomId)}/beds`;
      for (let index = 1; index <= capacity; index += 1) {
        await createRecord(bedUrl, { label: String(index) });
      }
      router.push(`/room-availability?hostelId=${encodeURIComponent(hostelId)}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The hostel setup service is unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form-grid building-create-form" onSubmit={setup}>
      <p className="hostel-directory-intro full">Organization: {organizationName}. Capacity is stored as real bed records.</p>
      <TextField label="Hostel name" name="hostelName" maxLength={160} required />
      <TextField label="Building name" name="buildingName" maxLength={120} required />
      <TextField label="Floor number" name="floorNumber" type="number" defaultValue="0" required />
      <TextField label="Room number" name="roomNumber" maxLength={40} required />
      <TextField label="Room type" name="roomType" maxLength={60} hint="For example, single or shared." />
      <TextField label="Bed capacity" name="capacity" type="number" min={1} max={100} defaultValue={2} required hint="Creates this many available beds in the room." />
      {error ? <p className="hostel-directory-card__message hostel-directory-card__message--error full" role="alert">{error}</p> : null}
      <Button type="submit" loading={pending} loadingLabel="Setting up hostel">Create hostel and room</Button>
    </form>
  );
}
