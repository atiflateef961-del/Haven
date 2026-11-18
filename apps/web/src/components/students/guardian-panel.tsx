"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { apiBaseUrl } from "@/lib/api-url.mjs";

type Guardian = {
  id: string;
  name: string;
  relationship: string | null;
  email: string | null;
  phone: string;
};

function isGuardian(value: unknown): value is Guardian {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.name === "string" &&
    (record.relationship === null || typeof record.relationship === "string") &&
    (record.email === null || typeof record.email === "string") && typeof record.phone === "string";
}

export function GuardianPanel({ studentId, studentName }: { studentId: string; studentName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [editingGuardianId, setEditingGuardianId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadGuardians() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/students/${encodeURIComponent(studentId)}/guardians`, {
        credentials: "include",
        cache: "no-store",
      });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("Guardian contacts are no longer available for this student.");
        return;
      }
      if (!response.ok) {
        setError("Guardian contacts could not be loaded. Please try again.");
        return;
      }
      const payload: unknown = await response.json();
      if (typeof payload !== "object" || payload === null || !Array.isArray((payload as { guardians?: unknown }).guardians) ||
        !(payload as { guardians: unknown[] }).guardians.every(isGuardian)) {
        setError("The guardian response could not be read safely.");
        return;
      }
      setGuardians((payload as { guardians: Guardian[] }).guardians);
      setLoaded(true);
    } catch {
      setError("The guardian service is unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function togglePanel() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (!loaded && !loading) await loadGuardians();
  }

  async function addGuardian(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingAction) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const optional = (key: string) => String(values.get(key) ?? "").trim();
    const payload = {
      name: optional("name"),
      phone: optional("phone"),
      ...(optional("relationship") ? { relationship: optional("relationship") } : {}),
      ...(optional("email") ? { email: optional("email") } : {}),
    };

    setPendingAction("create");
    setError(null);
    setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/students/${encodeURIComponent(studentId)}/guardians`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("You no longer have permission to add a guardian for this student.");
        return;
      }
      if (response.status === 400) {
        setError("Check the guardian name, phone, and email, then try again.");
        return;
      }
      if (!response.ok) {
        setError("The guardian could not be added. Please try again.");
        return;
      }
      const created: unknown = await response.json();
      if (!isGuardian(created)) {
        setError("The saved guardian response could not be read safely.");
        return;
      }
      setGuardians((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name)));
      form.reset();
      setMessage(`${created.name} was added as a guardian for ${studentName}.`);
    } catch {
      setError("The guardian service is unavailable. Please try again.");
    } finally {
      setPendingAction(null);
    }
  }

  async function updateGuardian(event: FormEvent<HTMLFormElement>, guardianId: string) {
    event.preventDefault();
    if (pendingAction) return;
    const values = new FormData(event.currentTarget);
    const optional = (key: string) => String(values.get(key) ?? "").trim();
    const payload = {
      name: optional("name"),
      phone: optional("phone"),
      relationship: optional("relationship") || null,
      email: optional("email") || null,
    };

    setPendingAction(guardianId);
    setError(null);
    setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(
        `${apiOrigin}/api/v1/students/${encodeURIComponent(studentId)}/guardians/${encodeURIComponent(guardianId)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("This guardian contact is no longer available to update.");
        return;
      }
      if (response.status === 400) {
        setError("Check the guardian name, phone, and email, then try again.");
        return;
      }
      if (!response.ok) {
        setError("The guardian contact could not be updated. Please try again.");
        return;
      }
      const updated: unknown = await response.json();
      if (!isGuardian(updated)) {
        setError("The updated guardian response could not be read safely.");
        return;
      }
      setGuardians((current) => current.map((guardian) => guardian.id === updated.id ? updated : guardian)
        .sort((left, right) => left.name.localeCompare(right.name)));
      setEditingGuardianId(null);
      setMessage(`${updated.name}â€™s guardian contact was updated.`);
    } catch {
      setError("The guardian service is unavailable. Please try again.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="student-guardian-panel" aria-label={`Guardians for ${studentName}`}>
      <Button variant="secondary" size="sm" onClick={togglePanel} aria-expanded={open}>
        {open ? "Hide guardians" : "Manage guardians"}
      </Button>
      {open ? (
        <div className="student-guardian-panel__content" aria-busy={loading || pendingAction !== null}>
          <h3>Guardian contacts</h3>
          {loading ? <p role="status">Loading guardian contactsâ€¦</p> : null}
          {!loading && loaded && guardians.length === 0 ? <p>No guardian contacts have been added.</p> : null}
          {!loading && guardians.length > 0 ? (
            <ul className="student-guardian-list">
              {guardians.map((guardian) => (
                <li key={guardian.id}>
                  {editingGuardianId === guardian.id ? (
                    <form className="student-guardian-form student-guardian-form--edit" onSubmit={(event) => updateGuardian(event, guardian.id)}>
                      <TextField label="Guardian name" name="name" defaultValue={guardian.name} maxLength={160} required />
                      <TextField label="Relationship" name="relationship" defaultValue={guardian.relationship ?? ""} maxLength={60} />
                      <TextField label="Phone" name="phone" type="tel" defaultValue={guardian.phone} maxLength={32} required />
                      <TextField label="Email" name="email" type="email" defaultValue={guardian.email ?? ""} maxLength={320} />
                      <div className="student-directory-card__actions">
                        <Button type="submit" variant="secondary" loading={pendingAction === guardian.id} loadingLabel="Saving guardian" disabled={pendingAction !== null}>Save</Button>
                        <Button variant="ghost" onClick={() => setEditingGuardianId(null)} disabled={pendingAction !== null}>Cancel</Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <strong>{guardian.name}</strong>{guardian.relationship ? ` Â· ${guardian.relationship}` : ""}
                      <span>{guardian.phone}</span>
                      {guardian.email ? <span>{guardian.email}</span> : null}
                      <Button variant="ghost" size="sm" onClick={() => { setError(null); setEditingGuardianId(guardian.id); }} disabled={pendingAction !== null}>Edit contact</Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          {error ? <p className="student-guardian-panel__error" role="alert">{error}</p> : null}
          {message ? <p role="status">{message}</p> : null}
          <form className="student-guardian-form" onSubmit={addGuardian}>
            <TextField label="Guardian name" name="name" maxLength={160} required />
            <TextField label="Relationship" name="relationship" maxLength={60} />
            <TextField label="Phone" name="phone" type="tel" autoComplete="tel" maxLength={32} required />
            <TextField label="Email" name="email" type="email" autoComplete="email" maxLength={320} />
            <Button type="submit" variant="secondary" loading={pendingAction === "create"} loadingLabel="Adding guardian" disabled={pendingAction !== null}>Add guardian</Button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
