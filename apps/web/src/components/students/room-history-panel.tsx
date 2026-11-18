"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiBaseUrl } from "@/lib/api-url.mjs";

type RoomHistoryEntry = {
  id: string;
  startsAt: string;
  endsAt: string | null;
  endedAt: string | null;
  status: string;
  bed: {
    label: string;
    room: {
      number: string;
      floor: {
        number: string;
        building: {
          name: string;
          hostel: { name: string; code: string };
        };
      };
    };
  };
};

function getApiOrigin() {
  return apiBaseUrl;
}

function isRoomHistoryEntry(value: unknown): value is RoomHistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry.id !== "string" || typeof entry.startsAt !== "string" ||
    !(entry.endsAt === null || typeof entry.endsAt === "string") ||
    !(entry.endedAt === null || typeof entry.endedAt === "string") || typeof entry.status !== "string") return false;
  const bed = entry.bed as Record<string, unknown> | null;
  const room = bed?.room as Record<string, unknown> | null;
  const floor = room?.floor as Record<string, unknown> | null;
  const building = floor?.building as Record<string, unknown> | null;
  const hostel = building?.hostel as Record<string, unknown> | null;
  return typeof bed?.label === "string" && typeof room?.number === "string" &&
    typeof floor?.number === "string" && typeof building?.name === "string" &&
    typeof hostel?.name === "string" && typeof hostel?.code === "string";
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en", { dateStyle: "medium", timeZone: "UTC" }) : "Ongoing";
}

export function RoomHistoryPanel({ studentId, studentName, selfService = false }: { studentId?: string; studentName: string; selfService?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [history, setHistory] = useState<RoomHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventMessage, setEventMessage] = useState<string | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [eventPending, setEventPending] = useState<string | null>(null);
  const [checkedInIds, setCheckedInIds] = useState<string[]>([]);

  async function loadHistory() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const endpoint = selfService
        ? `${getApiOrigin()}/api/v1/students/me/room-history`
        : `${getApiOrigin()}/api/v1/students/${encodeURIComponent(studentId ?? "")}/room-history`;
      const response = await fetch(endpoint, {
        credentials: "include",
        cache: "no-store",
      });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("Room history is no longer available for this student.");
        return;
      }
      if (!response.ok) {
        setError("Room history could not be loaded. Please try again.");
        return;
      }
      const payload: unknown = await response.json();
      if (typeof payload !== "object" || payload === null || !Array.isArray((payload as { allocations?: unknown }).allocations) ||
        !(payload as { allocations: unknown[] }).allocations.every(isRoomHistoryEntry)) {
        setError("The room history response could not be read safely.");
        return;
      }
      setHistory((payload as { allocations: RoomHistoryEntry[] }).allocations);
      setLoaded(true);
    } catch {
      setError("The student service is unavailable. Please try again.");
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
    if (!loaded && !loading) await loadHistory();
  }

  async function recordAllocationEvent(entry: RoomHistoryEntry, event: "check-in" | "check-out") {
    if (selfService || eventPending) return;
    if (event === "check-out" && !window.confirm("Check this student out and end the active allocation now?")) return;
    setEventPending(`${entry.id}:${event}`);
    setEventError(null);
    setEventMessage(null);
    try {
      const response = await fetch(`${getApiOrigin()}/api/v1/bookings/allocations/${encodeURIComponent(entry.id)}/${event}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 404) {
        setEventError("This allocation is no longer active or is outside your organization access.");
        return;
      }
      if (response.status === 409) {
        setEventError("This allocation event has already been recorded. Refresh room history.");
        return;
      }
      if (!response.ok) {
        setEventError("The allocation event could not be recorded. Please try again.");
        return;
      }
      if (event === "check-in") {
        setCheckedInIds((current) => current.includes(entry.id) ? current : [...current, entry.id]);
        setEventMessage("Check-in recorded.");
      } else {
        setHistory((current) => current.map((item) => item.id === entry.id ? { ...item, status: "COMPLETED", endedAt: new Date().toISOString() } : item));
        setEventMessage("Check-out recorded and allocation ended.");
      }
    } catch {
      setEventError("The allocation service is unavailable. Please try again.");
    } finally {
      setEventPending(null);
    }
  }

  return (
    <section className="student-room-history-panel" aria-label={`Room history for ${studentName}`}>
      <Button variant="secondary" size="sm" onClick={togglePanel} aria-expanded={open}>
        {open ? "Hide room history" : "View room history"}
      </Button>
      {open ? (
        <div className="student-room-history-panel__content" aria-busy={loading}>
          <h3>Room history</h3>
          {loading ? <p role="status">Loading room historyâ€¦</p> : null}
          {!loading && loaded && history.length === 0 ? <p>No room allocations have been recorded.</p> : null}
          {!loading && history.length > 0 ? (
            <ol className="student-room-history-list">
              {history.map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.bed.room.floor.building.hostel.name} ({entry.bed.room.floor.building.hostel.code})</strong>
                  <span>{entry.bed.room.floor.building.name}, floor {entry.bed.room.floor.number}, room {entry.bed.room.number}, bed {entry.bed.label}</span>
                  <span>{formatDate(entry.startsAt)} â€“ {formatDate(entry.endedAt ?? entry.endsAt)}</span>
                  <span>Status: {entry.status.toLowerCase().replaceAll("_", " ")}</span>
                  {!selfService && entry.status === "ACTIVE" && entry.endedAt === null ? (
                    <div className="student-directory-card__actions">
                      {!checkedInIds.includes(entry.id) ? (
                        <Button size="sm" variant="secondary" onClick={() => recordAllocationEvent(entry, "check-in")} loading={eventPending === `${entry.id}:check-in`} loadingLabel="Recording check-in" disabled={eventPending !== null}>Check in</Button>
                      ) : <span>Checked in</span>}
                      <Button size="sm" variant="destructive" onClick={() => recordAllocationEvent(entry, "check-out")} loading={eventPending === `${entry.id}:check-out`} loadingLabel="Recording check-out" disabled={eventPending !== null}>Check out</Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}
          {error ? <p className="student-room-history-panel__error" role="alert">{error}</p> : null}
          {eventError ? <p className="student-room-history-panel__error" role="alert">{eventError}</p> : null}
          {eventMessage ? <p className="student-self-profile__note" role="status">{eventMessage}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
