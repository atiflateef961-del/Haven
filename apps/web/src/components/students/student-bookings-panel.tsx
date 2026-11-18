"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { apiBaseUrl } from "@/lib/api-url.mjs";

type Booking = {
  id: string;
  requestedFrom: string;
  requestedUntil: string | null;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "CANCELLED" | "FULFILLED";
  notes: string | null;
  createdAt: string;
};

function isDateValue(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isBooking(value: unknown): value is Booking {
  if (typeof value !== "object" || value === null) return false;
  const booking = value as Record<string, unknown>;
  return typeof booking.id === "string" && isDateValue(booking.requestedFrom) &&
    (booking.requestedUntil === null || isDateValue(booking.requestedUntil)) &&
    ["REQUESTED", "APPROVED", "REJECTED", "CANCELLED", "FULFILLED"].includes(String(booking.status)) &&
    (booking.notes === null || typeof booking.notes === "string") && isDateValue(booking.createdAt);
}

function isBookingPage(value: unknown): value is { bookings: Booking[]; page: number; pageSize: number; hasMore: boolean } {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.bookings) && record.bookings.every(isBooking) &&
    record.page === 1 && record.pageSize === 25 && typeof record.hasMore === "boolean";
}

function dateText(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en", { dateStyle: "medium", timeZone: "UTC" }) : "No planned end";
}

export function StudentBookingsPanel({ studentName }: { studentName: string }) {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const hasPendingAction = loading || pending || cancellingBookingId !== null;

  async function loadBookings() {
    if (hasPendingAction) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/students/me/bookings?page=1&pageSize=25`, {
        credentials: "include",
        cache: "no-store",
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
      if (!response.ok) {
        setError("Your booking requests could not be loaded. Please try again.");
        return;
      }
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        setError("The booking response could not be read safely.");
        return;
      }
      if (!isBookingPage(payload)) {
        setError("The booking response could not be read safely.");
        return;
      }
      setBookings(payload.bookings);
      setLoaded(true);
    } catch {
      setError("The student service is unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasPendingAction) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const requestedFrom = String(values.get("requestedFrom") ?? "").trim();
    const requestedUntil = String(values.get("requestedUntil") ?? "").trim();
    const notes = String(values.get("notes") ?? "").trim();
    if (!isCalendarDate(requestedFrom) ||
      (requestedUntil !== "" && !isCalendarDate(requestedUntil)) ||
      (requestedUntil !== "" && requestedUntil <= requestedFrom)) {
      setError("Check the dates. The end date must be after the start date.");
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/students/me/bookings`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedFrom,
          ...(requestedUntil ? { requestedUntil } : {}),
          ...(notes ? { notes } : {}),
        }),
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
        setError("Check the dates and notes. The end date must be after the start date.");
        return;
      }
      if (!response.ok) {
        setError("Your booking request could not be submitted. Please try again.");
        return;
      }
      let created: unknown;
      try {
        created = await response.json();
      } catch {
        setError("The booking may have been submitted, but its details could not be verified. Refresh your requests.");
        return;
      }
      const expectedNotes = notes || null;
      if (!isBooking(created) || created.status !== "REQUESTED" ||
        created.requestedFrom.slice(0, 10) !== requestedFrom ||
        created.requestedUntil !== (requestedUntil ? new Date(`${requestedUntil}T00:00:00.000Z`).toISOString() : null) ||
        created.notes !== expectedNotes) {
        setError("The booking may have been submitted, but its details could not be verified. Refresh your requests.");
        return;
      }
      setBookings((current) => [created, ...current]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id))
        .slice(0, 25));
      setLoaded(true);
      form.reset();
      setMessage(`Booking request submitted for ${studentName}.`);
    } catch {
      setError("The student service is unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function cancelRequest(booking: Booking) {
    if (booking.status !== "REQUESTED" || hasPendingAction) return;
    if (!window.confirm("Cancel this pending booking request?")) return;
    setCancellingBookingId(booking.id);
    setError(null);
    setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/students/me/bookings/${encodeURIComponent(booking.id)}/cancel`, {
        method: "PATCH",
        credentials: "include",
      });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 404) {
        setError("This booking request is no longer available.");
        return;
      }
      if (response.status === 409) {
        setError("This booking request has already been reviewed. Refresh your requests for the latest status.");
        return;
      }
      if (!response.ok) {
        setError("The booking request could not be cancelled. Please try again.");
        return;
      }
      let result: unknown;
      try {
        result = await response.json();
      } catch {
        setError("The request may have been cancelled, but the result could not be verified. Refresh your requests.");
        return;
      }
      if (typeof result !== "object" || result === null || (result as Record<string, unknown>).id !== booking.id ||
        (result as Record<string, unknown>).status !== "CANCELLED") {
        setError("The cancellation response could not be read safely.");
        return;
      }
      setBookings((current) => current.map((item) => item.id === booking.id ? { ...item, status: "CANCELLED" } : item));
      setMessage("The booking request was cancelled.");
    } catch {
      setError("The student service is unavailable. Please try again.");
    } finally {
      setCancellingBookingId(null);
    }
  }

  return (
    <section className="student-bookings-panel" aria-labelledby="student-bookings-title">
      <h3 id="student-bookings-title">Room booking requests</h3>
      <form className="student-bookings-panel__form" onSubmit={submitRequest}>
        <TextField label="Requested from" name="requestedFrom" type="date" required disabled={hasPendingAction} />
        <TextField label="Requested until (optional)" name="requestedUntil" type="date" disabled={hasPendingAction} />
        <label className="ui-field">
          <span className="ui-field__label">Notes (optional)</span>
          <textarea className="ui-field__control ui-field__control--md" name="notes" maxLength={1000} rows={3} disabled={hasPendingAction} />
        </label>
        <p className="student-self-profile__note">The end date is exclusive. Leave it empty for no planned end. Your organization will review the request.</p>
        <Button type="submit" loading={pending} loadingLabel="Submitting booking request" disabled={hasPendingAction}>Request a room</Button>
      </form>
      {error ? <p className="student-self-profile__error" role="alert">{error}</p> : null}
      {message ? <p className="student-self-profile__note" role="status">{message}</p> : null}
      <div className="student-bookings-panel__list">
        <Button variant="secondary" size="sm" onClick={loadBookings} loading={loading} loadingLabel="Loading booking requests" disabled={hasPendingAction}>
          {loaded ? "Refresh requests" : "View my requests"}
        </Button>
        {loading ? <p role="status">Loading booking requestsâ€¦</p> : null}
        {!loading && loaded && bookings.length === 0 ? <p>No booking requests yet.</p> : null}
        {!loading && bookings.length > 0 ? (
          <ol className="student-bookings-list">
            {bookings.map((booking) => (
              <li key={booking.id}>
                <strong>{dateText(booking.requestedFrom)} â€“ {dateText(booking.requestedUntil)}</strong>
                <span>Status: {booking.status.toLowerCase()}</span>
                {booking.notes ? <span>{booking.notes}</span> : null}
                {booking.status === "REQUESTED" ? (
                  <Button type="button" size="sm" variant="destructive" onClick={() => cancelRequest(booking)}
                    disabled={hasPendingAction} loading={cancellingBookingId === booking.id} loadingLabel="Cancelling request">
                    Cancel request
                  </Button>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}
