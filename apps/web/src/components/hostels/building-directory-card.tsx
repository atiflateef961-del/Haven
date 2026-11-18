"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { TextField } from "@/components/ui/text-field";
import { apiBaseUrl } from "@/lib/api-url.mjs";
import type { Building } from "@/lib/buildings";

export function BuildingDirectoryCard({ building, canManage }: { building: Building; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function updateBuilding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !canManage) return;
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(
        `${apiOrigin}/api/v1/hostels/${encodeURIComponent(building.hostelId)}/buildings/${encodeURIComponent(building.id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
      );
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("You no longer have permission to edit this building.");
        return;
      }
      if (response.status === 409) {
        setError("A building with this name already exists in this hostel.");
        return;
      }
      if (response.status === 400) {
        setError("Enter a valid building name and try again.");
        return;
      }
      if (!response.ok) {
        setError("The building could not be updated. Please try again.");
        return;
      }
      setEditing(false);
      setMessage(`${name} was updated.`);
      router.refresh();
    } catch {
      setError("The building service is unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <SurfaceCard as="article" className="hostel-directory-card building-directory-card" padding="md">
      <div className="building-directory-card__heading">
        <h2>{building.name}</h2>
        <p>{building.roomCount} {building.roomCount === 1 ? "room" : "rooms"}</p>
      </div>
      <Link
        className="hostel-directory-card__buildings-link"
        href={`/hostels/${encodeURIComponent(building.hostelId)}/buildings/${encodeURIComponent(building.id)}/floors`}
      >
        {canManage ? "Manage floors" : "View floors"}
      </Link>
      {error ? <p className="hostel-directory-card__message hostel-directory-card__message--error" role="alert">{error}</p> : null}
      {message ? <p className="hostel-directory-card__message" role="status">{message}</p> : null}
      {canManage ? (
        <>
          <div className="hostel-directory-card__actions">
            <Button variant="secondary" size="sm" aria-expanded={editing} onClick={() => { setError(null); setEditing((value) => !value); }} disabled={pending}>
              {editing ? "Cancel edit" : "Edit"}
            </Button>
          </div>
          {editing ? (
            <form className="building-create-form" onSubmit={updateBuilding}>
              <TextField label="Building name" name="name" defaultValue={building.name} maxLength={120} required />
              <Button type="submit" loading={pending} loadingLabel="Saving building">Save changes</Button>
            </form>
          ) : null}
        </>
      ) : null}
    </SurfaceCard>
  );
}
