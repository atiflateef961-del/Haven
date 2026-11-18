"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { apiBaseUrl } from "@/lib/api-url.mjs";
import type { Bed } from "@/lib/beds";

function isBed(value: unknown): value is Bed {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.roomId === "string" &&
    typeof record.label === "string" && typeof record.isActive === "boolean" && typeof record.isOccupied === "boolean";
}

export function BedDirectory({ hostelId, buildingId, floorId, roomId, roomNumber, canManage, initialBeds, initialError }: {
  hostelId: string;
  buildingId: string;
  floorId: string;
  roomId: string;
  roomNumber: string;
  canManage: boolean;
  initialBeds: Bed[];
  initialError: string | null;
}) {
  const router = useRouter();
  const [beds, setBeds] = useState<Bed[]>(initialBeds);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [message, setMessage] = useState<string | null>(null);
  const [availability, setAvailability] = useState<"all" | "available" | "occupied" | "inactive">("all");
  const getEndpoint = () => `${apiBaseUrl}/api/v1/hostels/${encodeURIComponent(hostelId)}/buildings/${encodeURIComponent(buildingId)}/floors/${encodeURIComponent(floorId)}/rooms/${encodeURIComponent(roomId)}/beds`;

  async function sendUpdate(bed: Bed, body: { label?: string; isActive?: boolean }, key: string): Promise<boolean> {
    if (pending || !canManage) return false;
    setPending(key);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${getEndpoint()}/${encodeURIComponent(bed.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return false;
      }
      if (response.status === 403 || response.status === 404) {
        setError("You no longer have permission to update this bed.");
        return false;
      }
      if (response.status === 409) {
        setError(body.isActive === false
          ? `Bed ${bed.label} has an active student allocation. Move the student before deactivating it.`
          : `A bed with that label already exists in room ${roomNumber}.`);
        return false;
      }
      if (response.status === 400) {
        setError("Enter a valid bed label and try again.");
        return false;
      }
      if (!response.ok) {
        setError("The bed could not be updated. Please try again.");
        return false;
      }
      const updated: unknown = await response.json();
      if (!isBed(updated) || updated.roomId !== roomId) {
        setError("The bed was updated, but its latest details could not be loaded.");
        return false;
      }
      setBeds((current) => current.map((item) => item.id === updated.id ? updated : item)
        .sort((left, right) => left.label.localeCompare(right.label)));
      setMessage(body.label !== undefined ? `Bed label changed to ${updated.label}.` :
        `Bed ${updated.label} ${updated.isActive ? "activated" : "deactivated"}.`);
      return true;
    } catch {
      setError("The bed service is unavailable. Please try again.");
      return false;
    } finally {
      setPending(null);
    }
  }

  async function createBed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !canManage) return;
    const form = event.currentTarget;
    const label = String(new FormData(form).get("label") ?? "").trim();
    setPending("create");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(getEndpoint(), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("You no longer have permission to add beds to this room.");
        return;
      }
      if (response.status === 409) {
        setError(`A bed with that label already exists in room ${roomNumber}.`);
        return;
      }
      if (response.status === 400) {
        setError("Enter a valid bed label and try again.");
        return;
      }
      if (!response.ok) {
        setError("The bed could not be added. Please try again.");
        return;
      }
      const created: unknown = await response.json();
      if (!isBed(created) || created.roomId !== roomId) {
        setError("The bed was added, but its details could not be loaded.");
        return;
      }
      form.reset();
      setBeds((current) => [...current, created].sort((left, right) => left.label.localeCompare(right.label)));
      setMessage(`Bed ${created.label} was added.`);
    } catch {
      setError("The bed service is unavailable. Please try again.");
    } finally {
      setPending(null);
    }
  }

  const visibleBeds = beds.filter((bed) => {
    if (availability === "available") return bed.isActive && !bed.isOccupied;
    if (availability === "occupied") return bed.isActive && bed.isOccupied;
    if (availability === "inactive") return !bed.isActive;
    return true;
  });

  return (
    <section className="bed-directory" aria-label={`Beds in room ${roomNumber}`}>
      <h3>Beds</h3>
      {error ? <p className="hostel-directory-card__message hostel-directory-card__message--error" role="alert">{error}</p> : null}
      {message ? <p className="hostel-directory-card__message" role="status">{message}</p> : null}
      {!error && beds.length === 0 ? <p className="bed-directory__muted">No beds have been added.</p> : null}
      {!error && beds.length > 0 ? (
        <label className="bed-directory__filter">
          <span>Filter beds</span>
          <select value={availability} onChange={(event) => setAvailability(event.currentTarget.value as typeof availability)}>
            <option value="all">All beds ({beds.length})</option>
            <option value="available">Available ({beds.filter((bed) => bed.isActive && !bed.isOccupied).length})</option>
            <option value="occupied">Occupied ({beds.filter((bed) => bed.isActive && bed.isOccupied).length})</option>
            <option value="inactive">Inactive ({beds.filter((bed) => !bed.isActive).length})</option>
          </select>
        </label>
      ) : null}
      {!error && visibleBeds.length > 0 ? (
        <ul className="bed-directory__list">
          {visibleBeds.map((bed) => (
            <BedRow key={bed.id} bed={bed} pending={pending} canManage={canManage} onUpdate={sendUpdate} />
          ))}
        </ul>
      ) : null}
      {!error && beds.length > 0 && visibleBeds.length === 0 ? (
        <p className="bed-directory__muted" role="status">No beds match this filter.</p>
      ) : null}
      {canManage ? (
        <form className="bed-directory__create" onSubmit={createBed}>
          <TextField label="Bed label" name="label" maxLength={40} required hint="For example, A or Upper bunk." />
          <Button type="submit" size="sm" loading={pending === "create"} loadingLabel="Adding bed">Add bed</Button>
        </form>
      ) : null}
    </section>
  );
}

function BedRow({ bed, pending, canManage, onUpdate }: {
  bed: Bed;
  pending: string | null;
  canManage: boolean;
  onUpdate: (bed: Bed, body: { label?: string; isActive?: boolean }, key: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);

  async function saveLabel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = String(new FormData(event.currentTarget).get("label") ?? "").trim();
    if (await onUpdate(bed, { label }, bed.id)) setEditing(false);
  }

  return (
    <li className="bed-directory__item">
      <span className="bed-directory__label">{bed.label}</span>
      <span className={`bed-directory__status pill ${!bed.isActive ? "pill--neutral bed-directory__status--inactive" : bed.isOccupied ? "pill--neutral bed-directory__status--occupied" : "pill--up bed-directory__status--available"}`}>
        {!bed.isActive ? "Inactive" : bed.isOccupied ? "Occupied" : "Available"}
      </span>
      {canManage ? (
        <div className="bed-directory__actions">
          {editing ? (
            <form className="bed-directory__edit" onSubmit={saveLabel}>
              <TextField label={`Bed ${bed.label} label`} name="label" defaultValue={bed.label} maxLength={40} required />
              <Button size="sm" type="submit" loading={pending === bed.id} loadingLabel="Saving label" disabled={pending !== null && pending !== bed.id}>Save</Button>
              <Button size="sm" variant="secondary" onClick={() => setEditing(false)} disabled={pending !== null}>Cancel</Button>
            </form>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)} disabled={pending !== null}>Rename</Button>
              <Button size="sm" variant="secondary" loading={pending === `${bed.id}-status`} loadingLabel="Updating bed"
                disabled={pending !== null} onClick={() => void onUpdate(bed, { isActive: !bed.isActive }, `${bed.id}-status`)}>
                {bed.isActive ? "Deactivate" : "Reactivate"}
              </Button>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}
