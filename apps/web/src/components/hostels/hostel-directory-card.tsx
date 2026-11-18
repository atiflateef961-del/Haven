"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { TextAreaField, TextField } from "@/components/ui/text-field";
import { apiBaseUrl } from "@/lib/api-url.mjs";
import type { Hostel } from "@/lib/hostels";

export function HostelDirectoryCard({ hostel, canManage }: { hostel: Hostel; canManage: boolean }) {
  const router = useRouter();
  const archiveDialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !canManage) return;

    const values = new FormData(event.currentTarget);
    const address = String(values.get("address") ?? "").trim();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/hostels/${encodeURIComponent(hostel.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(values.get("name") ?? "").trim(),
          code: String(values.get("code") ?? "").trim(),
          address: address || null,
        }),
      });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("You no longer have permission to edit this hostel.");
        return;
      }
      if (response.status === 409) {
        setError("That hostel code is already in use in this organization.");
        return;
      }
      if (response.status === 400) {
        setError("Check the hostel name and code, then try again.");
        return;
      }
      if (!response.ok) {
        setError("The hostel could not be updated. Please try again.");
        return;
      }
      setEditing(false);
      setMessage(`${hostel.name} was updated.`);
      router.refresh();
    } catch {
      setError("The hostel service is unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function archiveHostel() {
    if (pending || !canManage) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/hostels/${encodeURIComponent(hostel.id)}/archive`, {
        method: "POST",
        credentials: "include",
      });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("You no longer have permission to archive this hostel.");
        archiveDialog.current?.close();
        return;
      }
      if (!response.ok) {
        setError("The hostel could not be archived. Please try again.");
        archiveDialog.current?.close();
        return;
      }
      archiveDialog.current?.close();
      setMessage(`${hostel.name} was archived.`);
      router.refresh();
    } catch {
      setError("The hostel service is unavailable. Please try again.");
      archiveDialog.current?.close();
    } finally {
      setPending(false);
    }
  }

  return (
    <SurfaceCard as="article" className="hostel-directory-card" padding="md">
      <div className="hostel-directory-card__heading">
        <div>
          <p>{hostel.organization.name}</p>
          <h2>{hostel.name}</h2>
        </div>
        <span className="hostel-directory-card__code">{hostel.code}</span>
      </div>
      <address>{hostel.address ?? "No address has been added."}</address>
      <Link className="hostel-directory-card__buildings-link" href={`/hostels/${encodeURIComponent(hostel.id)}/buildings`}>
        {canManage ? "Manage buildings" : "View buildings"}
      </Link>

      {error ? <p className="hostel-directory-card__message hostel-directory-card__message--error" role="alert">{error}</p> : null}
      {message ? <p className="hostel-directory-card__message" role="status">{message}</p> : null}

      {canManage ? (
        <div className="hostel-directory-card__actions">
          <Button variant="secondary" size="sm" onClick={() => { setError(null); setEditing((value) => !value); }} aria-expanded={editing} disabled={pending}>
            {editing ? "Cancel edit" : "Edit"}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => archiveDialog.current?.showModal()} disabled={pending}>
            Archive
          </Button>
        </div>
      ) : null}

      {canManage && editing ? (
        <form className="hostel-directory-card__edit" onSubmit={submitEdit}>
          <TextField label="Hostel name" name="name" defaultValue={hostel.name} maxLength={160} required />
          <TextField label="Hostel code" name="code" defaultValue={hostel.code} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9_-]*" required />
          <TextAreaField label="Address" name="address" defaultValue={hostel.address ?? ""} maxLength={500} />
          <Button type="submit" loading={pending} loadingLabel="Saving changes">Save changes</Button>
        </form>
      ) : null}

      {canManage ? (
        <dialog ref={archiveDialog} className="hostel-archive-dialog" aria-labelledby={`archive-title-${hostel.id}`}>
          <h2 id={`archive-title-${hostel.id}`}>Archive {hostel.name}?</h2>
          <p>This hostel will be removed from the active directory. Its existing records will be retained.</p>
          <div className="hostel-directory-card__actions">
            <Button variant="secondary" onClick={() => archiveDialog.current?.close()} disabled={pending}>Cancel</Button>
            <Button variant="destructive" loading={pending} loadingLabel="Archiving hostel" onClick={archiveHostel}>Archive hostel</Button>
          </div>
        </dialog>
      ) : null}
    </SurfaceCard>
  );
}
