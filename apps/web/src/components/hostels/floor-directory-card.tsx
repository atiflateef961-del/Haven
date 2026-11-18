"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { TextField } from "@/components/ui/text-field";
import { apiBaseUrl } from "@/lib/api-url.mjs";
import type { Floor } from "@/lib/floors";

function floorLabel(number: number) {
  if (number === 0) return "Ground floor";
  if (number < 0) return `Basement ${Math.abs(number)}`;
  return `Floor ${number}`;
}

export function FloorDirectoryCard({ floor, hostelId, canManage }: {
  floor: Floor;
  hostelId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function updateFloor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !canManage) return;
    const number = Number(new FormData(event.currentTarget).get("number"));
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(
        `${apiOrigin}/api/v1/hostels/${encodeURIComponent(hostelId)}/buildings/${encodeURIComponent(floor.buildingId)}/floors/${encodeURIComponent(floor.id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ number }),
        },
      );
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("You no longer have permission to edit this floor.");
        return;
      }
      if (response.status === 409) {
        setError("That floor number already exists in this building.");
        return;
      }
      if (response.status === 400) {
        setError("Enter a valid whole floor number and try again.");
        return;
      }
      if (!response.ok) {
        setError("The floor could not be updated. Please try again.");
        return;
      }
      setEditing(false);
      setMessage("Floor number updated.");
      router.refresh();
    } catch {
      setError("The floor service is unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <SurfaceCard as="article" className="hostel-directory-card building-directory-card" padding="md">
      <div className="floor-directory-card__heading">
        <h2>{floorLabel(floor.number)}</h2>
        <span>Level {floor.number}</span>
      </div>
      <Link className="hostel-directory-card__buildings-link" href={`/hostels/${encodeURIComponent(hostelId)}/buildings/${encodeURIComponent(floor.buildingId)}/floors/${encodeURIComponent(floor.id)}/rooms`}>
        {canManage ? "Manage rooms" : "View rooms"}
      </Link>
      {error ? <p className="hostel-directory-card__message hostel-directory-card__message--error" role="alert">{error}</p> : null}
      {message ? <p className="hostel-directory-card__message" role="status">{message}</p> : null}
      {canManage ? (
        <>
          <div className="hostel-directory-card__actions">
            <Button variant="secondary" size="sm" aria-expanded={editing} onClick={() => { setError(null); setEditing((value) => !value); }} disabled={pending}>
              {editing ? "Cancel edit" : "Edit floor"}
            </Button>
          </div>
          {editing ? (
            <form className="building-create-form" onSubmit={updateFloor}>
              <TextField label="Floor number" name="number" type="number" step={1} min={-2147483648} max={2147483647} defaultValue={floor.number} required />
              <Button type="submit" loading={pending} loadingLabel="Saving floor">Save changes</Button>
            </form>
          ) : null}
        </>
      ) : null}
    </SurfaceCard>
  );
}
