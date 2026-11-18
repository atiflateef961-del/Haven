"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { apiBaseUrl } from "@/lib/api-url.mjs";

export function FloorCreateForm({ hostelId, buildingId }: { hostelId: string; buildingId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function createFloor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const number = Number(new FormData(form).get("number"));
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(
        `${apiOrigin}/api/v1/hostels/${encodeURIComponent(hostelId)}/buildings/${encodeURIComponent(buildingId)}/floors`,
        {
          method: "POST",
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
        setError("You no longer have permission to add floors to this building.");
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
        setError("The floor could not be added. Please try again.");
        return;
      }
      form.reset();
      setSuccess("Floor added.");
      router.refresh();
    } catch {
      setError("The floor service is unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form-grid form-grid--single building-create-form" onSubmit={createFloor}>
      <TextField label="Floor number" name="number" type="number" step={1} min={-2147483648} max={2147483647} hint="Use a negative number for basements and 0 for ground level." required />
      {error ? <p className="hostel-directory-card__message hostel-directory-card__message--error" role="alert">{error}</p> : null}
      {success ? <p className="hostel-directory-card__message" role="status">{success}</p> : null}
      <Button type="submit" loading={pending} loadingLabel="Adding floor">Add floor</Button>
    </form>
  );
}
