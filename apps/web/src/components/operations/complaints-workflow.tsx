"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatIcon } from "@/components/ui/stat-icon";
import { apiBaseUrl } from "@/lib/api-url.mjs";
import type { Complaint, ComplaintStaff } from "@/lib/complaints";
import { demoComplaints } from "@/lib/demo-data";

const complaintTransitions: Record<Complaint["status"], Complaint["status"][]> = {
  OPEN: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  RESOLVED: ["RESOLVED", "CLOSED"],
  CLOSED: ["CLOSED"],
};

const complaintStatusLabels: Record<Complaint["status"], string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

function isCreatedComplaint(value: unknown): value is Pick<Complaint, "id" | "title" | "description" | "status" | "createdAt"> {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.title === "string" &&
    typeof record.description === "string" && ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(String(record.status)) &&
    typeof record.createdAt === "string" && Number.isFinite(Date.parse(record.createdAt));
}

function isComplaintUpdate(value: unknown): value is Pick<Complaint, "id" | "title" | "status" | "assignedStaffId" | "updatedAt"> {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.title === "string" &&
    ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(String(record.status)) &&
    (record.assignedStaffId === null || typeof record.assignedStaffId === "string") &&
    typeof record.updatedAt === "string" && Number.isFinite(Date.parse(record.updatedAt));
}

export function ComplaintsWorkflow({ initialComplaints, staff, canManage, canSubmit }: {
  initialComplaints: Complaint[]; staff: ComplaintStaff[]; canManage: boolean; canSubmit: boolean;
}) {
  const router = useRouter();
  const [complaints, setComplaints] = useState(initialComplaints);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const hasDemoComplaints = complaints.some((complaint) => demoComplaints.some((demoComplaint) => demoComplaint.id === complaint.id));

  async function submitComplaint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingAction) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const requestedTitle = String(form.get("title") ?? "").trim();
    const requestedDescription = String(form.get("description") ?? "").trim();
    setPendingAction("create"); setError(null); setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/complaints`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: requestedTitle, description: requestedDescription }),
      });
      if (response.status === 401) { router.replace("/login"); router.refresh(); return; }
      if (response.status === 403 || response.status === 404) { setError("An active student profile is required to submit a complaint."); return; }
      if (!response.ok) { setError("The complaint could not be submitted. Check the fields and try again."); return; }
      let created: unknown;
      try {
        created = await response.json();
      } catch {
        setError("The complaint may have been submitted, but its details could not be verified. Refresh the page.");
        router.refresh();
        return;
      }
      if (!isCreatedComplaint(created) || created.title !== requestedTitle || created.description !== requestedDescription) {
        setError("The complaint was submitted, but its details could not be verified. Refresh the page.");
        router.refresh();
        return;
      }
      setComplaints((current) => [{ ...created, assignedStaffId: null }, ...current]);
      formElement.reset(); setMessage("Complaint submitted. Organization staff have been notified.");
    } catch { setError("The complaints service is unavailable. Try again."); }
    finally { setPendingAction(null); }
  }

  async function updateComplaint(event: FormEvent<HTMLFormElement>, complaint: Complaint) {
    event.preventDefault();
    if (pendingAction) return;
    const form = new FormData(event.currentTarget);
    const status = String(form.get("status") ?? complaint.status);
    const assignedStaffId = String(form.get("assignedStaffId") ?? "") || null;
    setPendingAction(complaint.id); setError(null); setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/complaints/${encodeURIComponent(complaint.id)}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, assignedStaffId }),
      });
      if (response.status === 401) { router.replace("/login"); router.refresh(); return; }
      if (response.status === 403 || response.status === 404) { setError("This complaint is outside your assigned organization scope."); return; }
      if (response.status === 409) { setError("That complaint status transition is not allowed. The complaint list has been refreshed."); router.refresh(); return; }
      if (!response.ok) { setError("The complaint could not be updated. Try again."); return; }
      let updated: unknown;
      try {
        updated = await response.json();
      } catch {
        setError("The complaint was updated, but its details could not be verified. Refresh the page.");
        router.refresh();
        return;
      }
      if (!isComplaintUpdate(updated) || updated.id !== complaint.id ||
        updated.status !== status || updated.assignedStaffId !== assignedStaffId) {
        setError("The complaint was updated, but its details could not be verified. Refresh the page.");
        router.refresh();
        return;
      }
      setComplaints((current) => current.map((item) => item.id === complaint.id ? {
        ...item,
        title: updated.title,
        status: updated.status,
        assignedStaffId: updated.assignedStaffId,
        updatedAt: updated.updatedAt,
      } : item));
      setMessage("Complaint updated. The student was notified.");
    } catch { setError("The complaints service is unavailable. Try again."); }
    finally { setPendingAction(null); }
  }

  return <>
    {canSubmit ? <form className="operations-form" onSubmit={submitComplaint}>
      <h2>Submit a complaint</h2>
      <label>Title<input className="ui-field__control ui-field__control--md" name="title" maxLength={180} required /></label>
      <label>Description<textarea className="ui-field__control ui-field__control--md" name="description" maxLength={4000} required rows={4} /></label>
      <Button type="submit" loading={pendingAction === "create"} loadingLabel="Submitting complaint" disabled={pendingAction !== null}>Submit complaint</Button>
    </form> : null}
    {error ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
    {hasDemoComplaints ? <dl className="demo-operation-kpis" aria-label="Demo complaint totals">
      <div><StatIcon name="complaint-total" /><dt>Total</dt><dd>{complaints.length}</dd></div>
      <div><StatIcon name="complaint-open" /><dt>Open</dt><dd>{complaints.filter((item) => item.status === "OPEN").length}</dd></div>
      <div><StatIcon name="complaint-progress" /><dt>In progress</dt><dd>{complaints.filter((item) => item.status === "IN_PROGRESS").length}</dd></div>
      <div><StatIcon name="complaint-resolved" /><dt>Resolved or closed</dt><dd>{complaints.filter((item) => item.status === "RESOLVED" || item.status === "CLOSED").length}</dd></div>
    </dl> : null}
    <h2>{hasDemoComplaints ? "Demo complaints · read only" : canManage ? "Organization complaints" : "Your complaints"}</h2>
    {complaints.length === 0 ? <p>No complaints are recorded.</p> : <ul className="operations-record-list">
      {complaints.map((complaint) => <li key={complaint.id}>
        <div><h3>{complaint.title}</h3><p>{complaint.description}</p><p>Status: <span className={`pill ${complaint.status === "OPEN" ? "pill--warn" : complaint.status === "IN_PROGRESS" ? "pill--neutral" : "pill--up"}`}>{complaintStatusLabels[complaint.status]}</span></p>
          {complaint.student ? <p>Student: {complaint.student.firstName} {complaint.student.lastName} ({complaint.student.studentNumber})</p> : null}</div>
        {canManage ? <form className="operations-inline-form" onSubmit={(event) => updateComplaint(event, complaint)}>
          <label>Status<select className="ui-field__control ui-field__control--md" name="status" defaultValue={complaint.status} disabled={pendingAction !== null}>
            {complaintTransitions[complaint.status].map((status) => <option value={status} key={status}>{complaintStatusLabels[status]}</option>)}
          </select></label>
          <label>Assigned staff<select className="ui-field__control ui-field__control--md" name="assignedStaffId" defaultValue={complaint.assignedStaffId ?? ""} disabled={pendingAction !== null}>
            <option value="">Unassigned</option>{staff.filter((member) => member.organizationId === complaint.student?.organizationId).map((member) => <option key={member.id} value={member.id}>{member.user.firstName} {member.user.lastName} Â· {member.employeeNumber}</option>)}
          </select></label>
          <Button type="submit" variant="secondary" size="sm" loading={pendingAction === complaint.id} loadingLabel="Updating" disabled={pendingAction !== null}>Save changes</Button>
        </form> : null}
      </li>)}
    </ul>}
  </>;
}
