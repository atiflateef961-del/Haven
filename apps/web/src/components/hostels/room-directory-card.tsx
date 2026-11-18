"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { TextAreaField, TextField } from "@/components/ui/text-field";
import { BedDirectory } from "@/components/hostels/bed-directory";
import { apiBaseUrl } from "@/lib/api-url.mjs";
import type { Bed } from "@/lib/beds";
import type { Room } from "@/lib/rooms";

export function RoomDirectoryCard({ room, hostelId, buildingId, canManage, beds, bedError }: {
  room: Room;
  hostelId: string;
  buildingId: string;
  canManage: boolean;
  beds: Bed[];
  bedError: string | null;
}) {
  const router = useRouter();
  const archiveDialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const getEndpoint = () => `${apiBaseUrl}/api/v1/hostels/${encodeURIComponent(hostelId)}/buildings/${encodeURIComponent(buildingId)}/floors/${encodeURIComponent(room.floorId)}/rooms/${encodeURIComponent(room.id)}`;

  async function updateRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !canManage) return;
    const values = new FormData(event.currentTarget);
    const number = String(values.get("number") ?? "").trim();
    const roomType = String(values.get("roomType") ?? "").trim();
    const description = String(values.get("description") ?? "").trim();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(getEndpoint(), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number, roomType: roomType || null, description: description || null }),
      });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("You no longer have permission to edit this room.");
        return;
      }
      if (response.status === 409) {
        setError("A room with this number already exists on this floor.");
        return;
      }
      if (response.status === 400) {
        setError("Check the room number, type, and description, then try again.");
        return;
      }
      if (!response.ok) {
        setError("The room could not be updated. Please try again.");
        return;
      }
      setEditing(false);
      setMessage(`Room ${number} was updated.`);
      router.refresh();
    } catch {
      setError("The room service is unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function archiveRoom() {
    if (pending || !canManage) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${getEndpoint()}/archive`, { method: "POST", credentials: "include" });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("You no longer have permission to archive this room.");
        archiveDialog.current?.close();
        return;
      }
      if (response.status === 409) {
        setError("This room has active student allocations. Move those students before archiving it.");
        archiveDialog.current?.close();
        return;
      }
      if (!response.ok) {
        setError("The room could not be archived. Please try again.");
        archiveDialog.current?.close();
        return;
      }
      archiveDialog.current?.close();
      setMessage(`Room ${room.number} was archived.`);
      router.refresh();
    } catch {
      setError("The room service is unavailable. Please try again.");
      archiveDialog.current?.close();
    } finally {
      setPending(false);
    }
  }

  return (
    <SurfaceCard as="article" className="hostel-directory-card building-directory-card" padding="md">
      <div className="room-directory-card__heading">
        <div>
          <h2>Room {room.number}</h2>
          {room.roomType ? <p>{room.roomType}</p> : null}
        </div>
      </div>
      {room.description ? <p className="room-directory-card__description">{room.description}</p> : null}
      <BedDirectory
        hostelId={hostelId}
        buildingId={buildingId}
        floorId={room.floorId}
        roomId={room.id}
        roomNumber={room.number}
        canManage={canManage}
        initialBeds={beds}
        initialError={bedError}
      />
      {error ? <p className="hostel-directory-card__message hostel-directory-card__message--error" role="alert">{error}</p> : null}
      {message ? <p className="hostel-directory-card__message" role="status">{message}</p> : null}
      {canManage ? (
        <>
          <div className="hostel-directory-card__actions">
            <Button variant="secondary" size="sm" aria-expanded={editing} onClick={() => { setError(null); setEditing((value) => !value); }} disabled={pending}>
              {editing ? "Cancel edit" : "Edit room"}
            </Button>
            <Button variant="destructive" size="sm" onClick={() => archiveDialog.current?.showModal()} disabled={pending}>
              Archive
            </Button>
          </div>
          {editing ? (
            <form className="building-create-form" onSubmit={updateRoom}>
              <TextField label="Room number" name="number" defaultValue={room.number} maxLength={40} required />
              <TextField label="Room type" name="roomType" defaultValue={room.roomType ?? ""} maxLength={60} />
              <TextAreaField label="Description" name="description" defaultValue={room.description ?? ""} maxLength={500} />
              <Button type="submit" loading={pending} loadingLabel="Saving room">Save changes</Button>
            </form>
          ) : null}
          <dialog ref={archiveDialog} className="hostel-archive-dialog" aria-labelledby={`archive-room-${room.id}`}>
            <h2 id={`archive-room-${room.id}`}>Archive room {room.number}?</h2>
            <p>The room, beds, and related records will be retained. Rooms with active student allocations cannot be archived.</p>
            <div className="hostel-directory-card__actions">
              <Button variant="secondary" onClick={() => archiveDialog.current?.close()} disabled={pending}>Cancel</Button>
              <Button variant="destructive" loading={pending} loadingLabel="Archiving room" onClick={archiveRoom}>Archive room</Button>
            </div>
          </dialog>
        </>
      ) : null}
    </SurfaceCard>
  );
}
