"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiBaseUrl } from "@/lib/api-url.mjs";
import { demoVisitors } from "@/lib/demo-data";
import type { VisitorStudent, VisitorVisit } from "@/lib/visitors";

function isVisitorVisit(value: unknown): value is VisitorVisit {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const visitor = record.visitor as Record<string, unknown> | null;
  const student = record.student as Record<string, unknown> | null;
  return typeof record.id === "string" && typeof record.visitAt === "string" &&
    Number.isFinite(Date.parse(record.visitAt)) &&
    ["PENDING", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED"].includes(String(record.status)) &&
    (record.purpose === null || typeof record.purpose === "string") &&
    typeof visitor?.name === "string" && (visitor.phone === null || typeof visitor.phone === "string") &&
    typeof student?.id === "string" && typeof student.studentNumber === "string" &&
    typeof student.firstName === "string" && typeof student.lastName === "string";
}

export function VisitorLog({ initialVisits, students }: { initialVisits: VisitorVisit[]; students: VisitorStudent[] }) {
  const router = useRouter();
  const [visits, setVisits] = useState(initialVisits);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const hasDemoVisits = visits.some((visit) => demoVisitors.some((demoVisit) => demoVisit.id === visit.id));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setMessage(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const studentId = String(form.get("studentId") ?? "");
    const visitorName = String(form.get("name") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim() || null;
    const purpose = String(form.get("purpose") ?? "").trim();
    const visitAtMs = new Date(String(form.get("visitAt") ?? "")).getTime();
    const student = students.find((item) => item.id === studentId);
    if (!student) { setError("Select an active student from your assigned scope."); return; }
    if (!visitorName || visitorName.length > 160 || (phone !== null && phone.length > 32) ||
      !purpose || purpose.length > 500 || !Number.isFinite(visitAtMs)) {
      setError("Enter a valid visitor name, optional phone, purpose, and visit time.");
      return;
    }
    const visitAt = new Date(visitAtMs).toISOString();
    setPending(true);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/visitors`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, name: visitorName, phone, purpose, visitAt }),
      });
      if (response.status === 401) { router.replace("/login"); router.refresh(); return; }
      if (response.status === 403 || response.status === 404) {
        setError("The selected student is no longer available in your assigned scope. The student list has been refreshed.");
        router.refresh();
        return;
      }
      if (response.status === 400) { setError("Complete each field with valid visitor details."); return; }
      if (!response.ok) { setError("The visit could not be recorded. Try again."); return; }
      let created: unknown;
      try {
        created = await response.json();
      } catch {
        setError("The visit may have been recorded, but its details could not be verified. Refresh the page.");
        router.refresh();
        return;
      }
      if (!isVisitorVisit(created) || created.student.id !== student.id ||
        created.student.studentNumber !== student.studentNumber ||
        created.student.firstName !== student.firstName || created.student.lastName !== student.lastName ||
        created.visitor.name !== visitorName || created.visitor.phone !== phone ||
        created.purpose !== purpose || created.status !== "APPROVED" ||
        Date.parse(created.visitAt) !== visitAtMs) {
        setError("The visit may have been recorded, but its details could not be verified. Refresh the page.");
        router.refresh();
        return;
      }
      setVisits((current) => [created, ...current]
        .sort((a, b) => Date.parse(b.visitAt) - Date.parse(a.visitAt) || a.id.localeCompare(b.id))
        .slice(0, 100));
      setMessage("Visitor entry recorded.");
      formElement.reset();
    } catch {
      setError("The visitor service is unavailable. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {hasDemoVisits ? <p className="demo-record-note">Demo records · read only</p> : students.length === 0 ? <p role="status">No active students are available in your assigned scope for visitor entries.</p> : <form className="visitor-log-form" onSubmit={submit}>
        <label>Student<select className="ui-field__control ui-field__control--md" name="studentId" required defaultValue="" disabled={pending}>
          <option value="" disabled>Select a student</option>
          {students.map((student) => <option key={student.id} value={student.id}>{student.studentNumber} â€” {student.firstName} {student.lastName}</option>)}
        </select></label>
        <label>Visitor name<input className="ui-field__control ui-field__control--md" name="name" maxLength={160} required disabled={pending} /></label>
        <label>Phone (optional)<input className="ui-field__control ui-field__control--md" name="phone" maxLength={32} disabled={pending} /></label>
        <label>Purpose<input className="ui-field__control ui-field__control--md" name="purpose" maxLength={500} required disabled={pending} /></label>
        <label>Visit time<input className="ui-field__control ui-field__control--md" name="visitAt" type="datetime-local" required disabled={pending} /></label>
        <Button type="submit" loading={pending} loadingLabel="Recording visitor" disabled={pending}>Record visitor</Button>
      </form>}
      {error ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
      <h2>Recent visitor log</h2>
      {visits.length === 0 ? <p>No visitor entries yet.</p> : <div className="visitor-log-table-wrap"><table className="visitor-log-table">
        <thead><tr><th scope="col">Visitor</th><th scope="col">Student</th><th scope="col">Purpose</th><th scope="col">Visit time</th><th scope="col">Status</th></tr></thead>
        <tbody>{visits.map((visit) => <tr key={visit.id}><td>{visit.visitor.name}<br />{visit.visitor.phone ?? "No phone"}</td>
          <td>{visit.student.firstName} {visit.student.lastName} ({visit.student.studentNumber})</td><td>{visit.purpose ?? "â€”"}</td>
          <td><time dateTime={visit.visitAt}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(visit.visitAt))}</time></td><td><span className={`pill ${visit.status === "COMPLETED" || visit.status === "APPROVED" ? "pill--up" : visit.status === "REJECTED" ? "pill--down" : visit.status === "PENDING" ? "pill--warn" : "pill--neutral"}`}>{visit.status.toLowerCase()}</span></td></tr>)}</tbody>
      </table></div>}
    </>
  );
}
