"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { apiBaseUrl } from "@/lib/api-url.mjs";

export function BuildingCreateForm({ hostelId }: { hostelId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function createBuilding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "").trim();
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/hostels/${encodeURIComponent(hostelId)}/buildings`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("You no longer have permission to add buildings to this hostel.");
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
        setError("The building could not be added. Please try again.");
        return;
      }
      form.reset();
      setSuccess(`${name} was added.`);
      router.refresh();
    } catch {
      setError("The building service is unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form-grid form-grid--single building-create-form" onSubmit={createBuilding}>
      <TextField label="Building name" name="name" maxLength={120} required />
      {error ? <p className="hostel-directory-card__message hostel-directory-card__message--error" role="alert">{error}</p> : null}
      {success ? <p className="hostel-directory-card__message" role="status">{success}</p> : null}
      <Button type="submit" loading={pending} loadingLabel="Adding building">Add building</Button>
    </form>
  );
}
