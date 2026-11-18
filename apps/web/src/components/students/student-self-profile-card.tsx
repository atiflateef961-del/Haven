"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { TextField } from "@/components/ui/text-field";
import { apiBaseUrl } from "@/lib/api-url.mjs";
import type { StudentSelfProfile } from "@/lib/students";
import { RoomHistoryPanel } from "@/components/students/room-history-panel";
import { StudentBookingsPanel } from "@/components/students/student-bookings-panel";

function isStudentContactUpdate(value: unknown): value is Pick<StudentSelfProfile, "id" | "email" | "phone"> {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" &&
    (record.email === null || typeof record.email === "string") &&
    (record.phone === null || typeof record.phone === "string");
}

export function StudentSelfProfileCard({ profile }: { profile: StudentSelfProfile }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function saveContacts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "").trim();
    const phone = String(values.get("phone") ?? "").trim();
    const expectedEmail = email.toLowerCase() || null;
    const expectedPhone = phone || null;
    const payload = { email: expectedEmail, phone: expectedPhone };

    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/students/me`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 404) {
        setError("Your linked student profile is no longer available.");
        return;
      }
      if (response.status === 400) {
        setError("Check the email and phone fields, then try again.");
        return;
      }
      if (!response.ok) {
        setError("Your contact details could not be saved. Please try again.");
        return;
      }
      let updated: unknown;
      try {
        updated = await response.json();
      } catch {
        setEditing(false);
        setError("Your details may have been saved, but the response could not be verified. Refresh the page.");
        router.refresh();
        return;
      }
      if (!isStudentContactUpdate(updated) || updated.id !== profile.id ||
        updated.email !== expectedEmail || updated.phone !== expectedPhone) {
        setEditing(false);
        setError("Your details may have been saved, but the response could not be verified. Refresh the page.");
        router.refresh();
        return;
      }
      setEditing(false);
      setMessage("Your contact details were updated.");
      router.refresh();
    } catch {
      setError("The student service is unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <SurfaceCard as="section" className="student-self-profile" padding="md" aria-labelledby="student-self-profile-title">
      <div className="student-self-profile__heading">
        <div>
          <p>{profile.studentNumber}</p>
          <h2 id="student-self-profile-title">{profile.firstName} {profile.lastName}</h2>
        </div>
      </div>
      {!editing ? (
        <dl>
          <div><dt>Email</dt><dd>{profile.email ?? "Not provided"}</dd></div>
          <div><dt>Phone</dt><dd>{profile.phone ?? "Not provided"}</dd></div>
          <div><dt>Date of birth</dt><dd>{profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString("en", { dateStyle: "medium", timeZone: "UTC" }) : "Not provided"}</dd></div>
          <div><dt>Institution</dt><dd>{profile.educationInstitution ?? "Not provided"}</dd></div>
          <div><dt>Program</dt><dd>{profile.educationProgram ?? "Not provided"}</dd></div>
          <div><dt>Year of study</dt><dd>{profile.educationYear ?? "Not provided"}</dd></div>
          <div><dt>Status</dt><dd>{profile.status[0] + profile.status.slice(1).toLowerCase()}</dd></div>
        </dl>
      ) : (
        <form className="student-self-profile__form" onSubmit={saveContacts}>
          <TextField label="Email" name="email" type="email" autoComplete="email" defaultValue={profile.email ?? ""} maxLength={320} disabled={pending} />
          <TextField label="Phone" name="phone" type="tel" autoComplete="tel" defaultValue={profile.phone ?? ""} maxLength={32} disabled={pending} />
          <p className="student-self-profile__note">Leave a field blank to clear it. Your name, student number, date of birth, educational information, and status are managed by your organization.</p>
          <div className="student-directory-card__actions">
            <Button type="submit" loading={pending} loadingLabel="Saving contact details" disabled={pending}>Save changes</Button>
            <Button variant="secondary" onClick={() => { setEditing(false); setError(null); }} disabled={pending}>Cancel</Button>
          </div>
        </form>
      )}
      {!editing ? <RoomHistoryPanel selfService studentName={`${profile.firstName} ${profile.lastName}`} /> : null}
      {!editing ? <StudentBookingsPanel studentName={`${profile.firstName} ${profile.lastName}`} /> : null}
      {!editing ? (
        <div className="student-directory-card__actions">
          <Button variant="secondary" onClick={() => { setError(null); setMessage(null); setEditing(true); }}>Edit contact details</Button>
        </div>
      ) : null}
      {error ? <p className="student-self-profile__error" role="alert">{error}</p> : null}
      {message ? <p className="student-self-profile__note" role="status">{message}</p> : null}
    </SurfaceCard>
  );
}
