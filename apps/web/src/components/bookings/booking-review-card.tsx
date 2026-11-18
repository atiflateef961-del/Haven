"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { apiBaseUrl } from "@/lib/api-url.mjs";
import type { BookingReview } from "@/lib/bookings";

type AvailableBed = {
  id: string;
  label: string;
  room: {
    number: string;
    floor: {
      number: number;
      building: { name: string; hostel: { name: string; code: string } };
    };
  };
};

function isAvailableBed(value: unknown): value is AvailableBed {
  if (typeof value !== "object" || value === null) return false;
  const bed = value as Record<string, unknown>;
  const room = bed.room as Record<string, unknown> | null;
  const floor = room?.floor as Record<string, unknown> | null;
  const building = floor?.building as Record<string, unknown> | null;
  const hostel = building?.hostel as Record<string, unknown> | null;
  return typeof bed.id === "string" && typeof bed.label === "string" &&
    typeof room?.number === "string" && typeof floor?.number === "number" &&
    typeof building?.name === "string" && typeof hostel?.name === "string" && typeof hostel?.code === "string";
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en", { dateStyle: "medium", timeZone: "UTC" }) : "No planned end";
}

export function BookingReviewCard({ booking }: { booking: BookingReview }) {
  const router = useRouter();
  const rejectDialog = useRef<HTMLDialogElement>(null);
  const [availableBeds, setAvailableBeds] = useState<AvailableBed[]>([]);
  const [loadedBeds, setLoadedBeds] = useState(false);
  const [hasMoreBeds, setHasMoreBeds] = useState(false);
  const [nextBedPage, setNextBedPage] = useState(1);
  const [loadingBeds, setLoadingBeds] = useState(false);
  const [pending, setPending] = useState(false);
  const [selectedBedId, setSelectedBedId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadBeds(page = 1) {
    setLoadingBeds(true);
    setError(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/bookings/${encodeURIComponent(booking.id)}/available-beds?page=${page}&pageSize=100`, {
        credentials: "include",
        cache: "no-store",
      });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("Available beds are no longer accessible for this request.");
        return;
      }
      if (!response.ok) {
        setError("Available beds could not be loaded. Please try again.");
        return;
      }
      const payload: unknown = await response.json();
      if (typeof payload !== "object" || payload === null || !Array.isArray((payload as { beds?: unknown }).beds) ||
        !(payload as { beds: unknown[] }).beds.every(isAvailableBed) || typeof (payload as { hasMore?: unknown }).hasMore !== "boolean") {
        setError("The available bed response could not be read safely.");
        return;
      }
      const result = payload as { beds: AvailableBed[]; hasMore: boolean };
      setAvailableBeds((current) => page === 1 ? result.beds : [...current, ...result.beds]);
      setLoadedBeds(true);
      setHasMoreBeds(result.hasMore);
      setNextBedPage(page + 1);
    } catch {
      setError("The booking service is unavailable. Please try again.");
    } finally {
      setLoadingBeds(false);
    }
  }

  async function approve() {
    if (pending || !selectedBedId) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/bookings/${encodeURIComponent(booking.id)}/approve`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bedId: selectedBedId }),
      });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("This booking request or bed is no longer available to approve.");
        return;
      }
      if (response.status === 409) {
        setError("The bed or student now has an overlapping allocation. Refresh available beds and try again.");
        setLoadedBeds(false);
        setAvailableBeds([]);
        setSelectedBedId("");
        router.refresh();
        return;
      }
      if (!response.ok) {
        setError("The booking request could not be approved. Please try again.");
        return;
      }
      setMessage("The booking request was approved.");
      router.refresh();
    } catch {
      setError("The booking service is unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function reject() {
    if (pending) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/bookings/${encodeURIComponent(booking.id)}/reject`, {
        method: "PATCH",
        credentials: "include",
      });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("This booking request is no longer available to reject.");
        rejectDialog.current?.close();
        return;
      }
      if (response.status === 409) {
        setError("This booking request has already been reviewed.");
        rejectDialog.current?.close();
        router.refresh();
        return;
      }
      if (!response.ok) {
        setError("The booking request could not be rejected. Please try again.");
        rejectDialog.current?.close();
        return;
      }
      rejectDialog.current?.close();
      setMessage("The booking request was rejected.");
      router.refresh();
    } catch {
      setError("The booking service is unavailable. Please try again.");
      rejectDialog.current?.close();
    } finally {
      setPending(false);
    }
  }

  return (
    <SurfaceCard as="article" padding="md">
      <div className="booking-review-list__heading">
        <div>
          <p>{booking.student.organization.name}</p>
          <h2>{booking.student.firstName} {booking.student.lastName}</h2>
          <span>{booking.student.studentNumber}</span>
        </div>
        <span className={`booking-review-status pill ${booking.status === "APPROVED" || booking.status === "FULFILLED" ? "pill--up" : booking.status === "REJECTED" || booking.status === "CANCELLED" ? "pill--down" : "pill--warn"} booking-review-status--${booking.status.toLowerCase()}`}>
          {booking.status.toLowerCase()}
        </span>
      </div>
      <dl>
        <div><dt>Requested stay</dt><dd>{formatDate(booking.requestedFrom)} â€“ {formatDate(booking.requestedUntil)}</dd></div>
        <div><dt>Submitted</dt><dd>{formatDate(booking.createdAt)}</dd></div>
        {booking.notes ? <div><dt>Notes</dt><dd>{booking.notes}</dd></div> : null}
      </dl>
      {booking.status === "REQUESTED" ? (
        <div className="booking-review-actions">
          {!loadedBeds ? (
            <Button variant="secondary" size="sm" onClick={() => loadBeds()} loading={loadingBeds} loadingLabel="Loading available beds">
              Find an available bed
            </Button>
          ) : (
            <>
              {availableBeds.length === 0 ? <p>No available beds match this stay interval.</p> : null}
              {availableBeds.length > 0 ? (
                <label className="ui-field">
                  <span className="ui-field__label">Assign a bed</span>
                  <select className="ui-field__control ui-field__control--md" value={selectedBedId} onChange={(event) => setSelectedBedId(event.currentTarget.value)} disabled={pending}>
                    <option value="">Choose a bed</option>
                    {availableBeds.map((bed) => (
                      <option key={bed.id} value={bed.id}>
                        {bed.room.floor.building.hostel.name} ({bed.room.floor.building.hostel.code}) Â· {bed.room.floor.building.name} Â· Floor {bed.room.floor.number} Â· Room {bed.room.number} Â· Bed {bed.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {hasMoreBeds ? <Button size="sm" variant="ghost" onClick={() => loadBeds(nextBedPage)} loading={loadingBeds} loadingLabel="Loading more beds" disabled={pending}>Load more beds</Button> : null}
            </>
          )}
          <div className="student-directory-card__actions">
            {loadedBeds && availableBeds.length > 0 ? (
              <Button size="sm" onClick={approve} disabled={!selectedBedId || pending} loading={pending} loadingLabel="Approving request">Approve</Button>
            ) : null}
            <Button size="sm" variant="destructive" onClick={() => rejectDialog.current?.showModal()} disabled={pending}>Reject</Button>
          </div>
        </div>
      ) : null}
      {error ? <p className="student-self-profile__error" role="alert">{error}</p> : null}
      {message ? <p className="student-self-profile__note" role="status">{message}</p> : null}
      <dialog ref={rejectDialog} className="hostel-archive-dialog" aria-labelledby={`reject-booking-title-${booking.id}`}>
        <h2 id={`reject-booking-title-${booking.id}`}>Reject this booking request?</h2>
        <p>{booking.student.firstName} {booking.student.lastName} will see that the request was rejected.</p>
        <div className="student-directory-card__actions">
          <Button variant="secondary" onClick={() => rejectDialog.current?.close()} disabled={pending}>Cancel</Button>
          <Button variant="destructive" onClick={reject} loading={pending} loadingLabel="Rejecting request">Reject request</Button>
        </div>
      </dialog>
    </SurfaceCard>
  );
}
