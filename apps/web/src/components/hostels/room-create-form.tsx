"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/text-field";
import { apiBaseUrl } from "@/lib/api-url.mjs";

export function RoomCreateForm({ hostelId, buildingId, floorId }: {
  hostelId: string;
  buildingId: string;
  floorId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const number = String(values.get("number") ?? "").trim();
    const roomType = String(values.get("roomType") ?? "").trim();
    const description = String(values.get("description") ?? "").trim();
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(
        `${apiOrigin}/api/v1/hostels/${encodeURIComponent(hostelId)}/buildings/${encodeURIComponent(buildingId)}/floors/${encodeURIComponent(floorId)}/rooms`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number,
            ...(roomType ? { roomType } : {}),
            ...(description ? { description } : {}),
          }),
        },
      );
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("You no longer have permission to add rooms to this floor.");
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
        setError("The room could not be added. Please try again.");
        return;
      }
      form.reset();
      setSuccess(`Room ${number} was added.`);
      router.refresh();
    } catch {
      setError("The room service is unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form-grid building-create-form" onSubmit={createRoom}>
      <TextField label="Room number" name="number" maxLength={40} required />
      <TextField label="Room type" name="roomType" maxLength={60} hint="Optional, for example single or double." />
      <TextAreaField label="Description" name="description" maxLength={500} fieldClassName="full" />
      {error ? <p className="hostel-directory-card__message hostel-directory-card__message--error full" role="alert">{error}</p> : null}
      {success ? <p className="hostel-directory-card__message full" role="status">{success}</p> : null}
      <Button type="submit" loading={pending} loadingLabel="Adding room">Add room</Button>
    </form>
  );
}
