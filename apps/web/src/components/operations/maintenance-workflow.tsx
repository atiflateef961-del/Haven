"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatIcon } from "@/components/ui/stat-icon";
import { apiBaseUrl } from "@/lib/api-url.mjs";
import { demoMaintenanceRequests } from "@/lib/demo-data";
import type { MaintenanceComplaint, MaintenanceRequest, MaintenanceStaff, MaintenanceOption } from "@/lib/maintenance";

const maintenanceTransitions: Record<MaintenanceRequest["status"], MaintenanceRequest["status"][]> = {
  OPEN: ["OPEN", "ASSIGNED", "CANCELLED"],
  ASSIGNED: ["ASSIGNED", "IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: ["COMPLETED"],
  CANCELLED: ["CANCELLED"],
};

const maintenanceStatusLabels: Record<MaintenanceRequest["status"], string> = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function isMaintenanceUpdate(value: unknown): value is Pick<MaintenanceRequest, "id" | "title" | "status" | "assigneeId"> {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.title === "string" &&
    ["OPEN", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(String(record.status)) &&
    (record.assigneeId === null || typeof record.assigneeId === "string");
}

function isCreatedMaintenanceRequest(value: unknown): value is Pick<MaintenanceRequest, "id" | "hostelId" | "title" | "status" | "complaintId" | "assigneeId" | "createdAt"> {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.hostelId === "string" &&
    typeof record.title === "string" && ["OPEN", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(String(record.status)) &&
    (record.complaintId === null || typeof record.complaintId === "string") &&
    (record.assigneeId === null || typeof record.assigneeId === "string") &&
    typeof record.createdAt === "string" && Number.isFinite(Date.parse(record.createdAt));
}

export function MaintenanceWorkflow({ initialRequests, hostels, staff, complaints }: {
  initialRequests: MaintenanceRequest[]; hostels: MaintenanceOption[]; staff: MaintenanceStaff[]; complaints: MaintenanceComplaint[];
}) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const hasDemoRequests = requests.some((request) => demoMaintenanceRequests.some((demoRequest) => demoRequest.id === request.id));
  const [hostelId, setHostelId] = useState(hostels[0]?.id ?? "");
  const [selectedComplaintId, setSelectedComplaintId] = useState("");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const selectedHostel = hostels.find((hostel) => hostel.id === hostelId);
  const availableComplaints = complaints.filter((complaint) => complaint.organizationId === selectedHostel?.organizationId);
  const availableStaff = staff.filter((member) => member.hostelAssignments.some((assignment) => assignment.hostelId === hostelId));
  const requestCount = requests.length;

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingAction || hostels.length === 0) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const requestedHostelId = String(form.get("hostelId") ?? "");
    const requestedComplaintId = String(form.get("complaintId") ?? "") || null;
    const requestedAssigneeId = String(form.get("assigneeId") ?? "") || null;
    const requestedTitle = String(form.get("title") ?? "").trim();
    setPendingAction("create"); setError(null); setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/maintenance`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostelId: requestedHostelId, complaintId: requestedComplaintId,
          assigneeId: requestedAssigneeId,
          title: requestedTitle, description: String(form.get("description") ?? "").trim(),
        }),
      });
      if (response.status === 401) { router.replace("/login"); router.refresh(); return; }
      if (response.status === 403 || response.status === 404) { setError("Check that the hostel, complaint, and staff member are in your assigned scope."); return; }
      if (!response.ok) { setError("The maintenance request could not be created. Check the fields and retry."); return; }
      let created: unknown;
      try {
        created = await response.json();
      } catch {
        setError("The request may have been created, but its details could not be verified. Refresh the page.");
        router.refresh();
        return;
      }
      if (!isCreatedMaintenanceRequest(created) || created.hostelId !== requestedHostelId ||
        created.complaintId !== requestedComplaintId || created.assigneeId !== requestedAssigneeId ||
        created.title !== requestedTitle || created.status !== (requestedAssigneeId ? "ASSIGNED" : "OPEN")) {
        setError("The request may have been created, but its details could not be verified. Refresh the page.");
        router.refresh();
        return;
      }
      formElement.reset();
      setHostelId(hostels[0]?.id ?? "");
      setSelectedComplaintId("");
      setSelectedAssigneeId("");
      setMessage(`Maintenance request ${created.title} created. Linked students and assigned staff were notified.`);
      router.refresh();
    } catch { setError("The maintenance service is unavailable. Try again."); }
    finally { setPendingAction(null); }
  }

  async function updateRequest(event: FormEvent<HTMLFormElement>, request: MaintenanceRequest) {
    event.preventDefault();
    if (pendingAction) return;
    const form = new FormData(event.currentTarget);
    setPendingAction(request.id); setError(null); setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/maintenance/${encodeURIComponent(request.id)}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: String(form.get("status") ?? request.status), assigneeId: String(form.get("assigneeId") ?? "") || null }),
      });
      if (response.status === 401) { router.replace("/login"); router.refresh(); return; }
      if (response.status === 403 || response.status === 404) { setError("This request is outside your assigned hostel scope."); return; }
      if (response.status === 409) { setError("That maintenance status transition is not allowed. The request list has been refreshed."); router.refresh(); return; }
      if (!response.ok) { setError("The maintenance request could not be updated."); return; }
      let result: unknown;
      try {
        result = await response.json();
      } catch {
        setError("The request was updated, but its details could not be verified. Refresh the page.");
        router.refresh();
        return;
      }
      const requestedStatus = String(form.get("status") ?? request.status);
      const requestedAssigneeId = String(form.get("assigneeId") ?? "") || null;
      if (!isMaintenanceUpdate(result) || result.id !== request.id ||
        result.status !== requestedStatus || result.assigneeId !== requestedAssigneeId) {
        setError("The request was updated, but its details could not be verified. Refresh the page.");
        router.refresh();
        return;
      }
      const assignee = result.assigneeId ? staff.find((member) => member.id === result.assigneeId) : undefined;
      setRequests((current) => current.map((item) => item.id === request.id ? {
        ...item,
        title: result.title,
        status: result.status,
        assigneeId: result.assigneeId,
        assignee: assignee ? {
          employeeNumber: assignee.employeeNumber,
          user: { firstName: assignee.user.firstName, lastName: assignee.user.lastName },
        } : null,
      } : item));
      setMessage("Maintenance request updated. The affected student and staff were notified.");
    } catch { setError("The maintenance service is unavailable. Try again."); }
    finally { setPendingAction(null); }
  }

  return <>
    {hasDemoRequests ? <p className="demo-record-note">Demo records · read only</p> : hostels.length === 0 ? <p role="status">No active hostels are available in your assigned scope for maintenance requests.</p> : <form className="operations-form" onSubmit={createRequest}>
      <h2>New maintenance request</h2>
      <label>Hostel<select className="ui-field__control ui-field__control--md" name="hostelId" value={hostelId} onChange={(event) => {
        setHostelId(event.currentTarget.value);
        setSelectedComplaintId("");
        setSelectedAssigneeId("");
      }} required disabled={pendingAction !== null}>{hostels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Related complaint (optional)<select className="ui-field__control ui-field__control--md" name="complaintId" value={selectedComplaintId} onChange={(event) => setSelectedComplaintId(event.currentTarget.value)} disabled={pendingAction !== null}><option value="">No linked complaint</option>{availableComplaints.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label>Assign staff (optional)<select className="ui-field__control ui-field__control--md" name="assigneeId" value={selectedAssigneeId} onChange={(event) => setSelectedAssigneeId(event.currentTarget.value)} disabled={pendingAction !== null}><option value="">Unassigned</option>{availableStaff.map((item) => <option key={item.id} value={item.id}>{item.user.firstName} {item.user.lastName} Â· {item.employeeNumber}</option>)}</select></label>
      <label>Title<input className="ui-field__control ui-field__control--md" name="title" maxLength={180} required disabled={pendingAction !== null} /></label>
      <label>Description<textarea className="ui-field__control ui-field__control--md" name="description" maxLength={2000} rows={3} required disabled={pendingAction !== null} /></label>
      <Button type="submit" loading={pendingAction === "create"} loadingLabel="Creating request" disabled={pendingAction !== null}>Create request</Button>
    </form>}
    {error ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
    {hasDemoRequests ? <dl className="demo-operation-kpis" aria-label="Demo maintenance totals">
      <div><StatIcon name="maintenance-total" /><dt>Total</dt><dd>{requestCount}</dd></div>
      <div><StatIcon name="maintenance-open" /><dt>Open</dt><dd>{requests.filter((item) => item.status === "OPEN").length}</dd></div>
      <div><StatIcon name="maintenance-assigned" /><dt>Assigned or in progress</dt><dd>{requests.filter((item) => item.status === "ASSIGNED" || item.status === "IN_PROGRESS").length}</dd></div>
      <div><StatIcon name="maintenance-complete" /><dt>Completed</dt><dd>{requests.filter((item) => item.status === "COMPLETED").length}</dd></div>
    </dl> : null}
    <h2>Maintenance requests</h2>
    {requests.length === 0 ? <p>No maintenance requests are recorded.</p> : <ul className="operations-record-list">{requests.map((request) => {
      const isDemoRequest = demoMaintenanceRequests.some((demoRequest) => demoRequest.id === request.id);
      return <li key={request.id}>
      <div><h3>{request.title}</h3><p>{request.description}</p><p>{request.hostel.name} · <span className={`pill ${request.status === "OPEN" ? "pill--warn" : request.status === "CANCELLED" ? "pill--down" : request.status === "COMPLETED" ? "pill--up" : "pill--neutral"}`}>{maintenanceStatusLabels[request.status]}</span></p>
        {request.complaint ? <p>Complaint: {request.complaint.title} â€” {request.complaint.student.firstName} {request.complaint.student.lastName}</p> : null}
        {request.assignee ? <p>Assigned to {request.assignee.user.firstName} {request.assignee.user.lastName}</p> : <p>Unassigned</p>}</div>
      {!isDemoRequest ? <form className="operations-inline-form" onSubmit={(event) => updateRequest(event, request)}>
        <label>Status<select className="ui-field__control ui-field__control--md" name="status" defaultValue={request.status} disabled={pendingAction !== null}>
          {maintenanceTransitions[request.status].map((status) => <option value={status} key={status}>{maintenanceStatusLabels[status]}</option>)}
        </select></label>
        <label>Assigned staff<select className="ui-field__control ui-field__control--md" name="assigneeId" defaultValue={request.assigneeId ?? ""} disabled={pendingAction !== null}><option value="">Unassigned</option>{request.assigneeId && !staff.some((item) => item.id === request.assigneeId && item.hostelAssignments.some((assignment) => assignment.hostelId === request.hostelId)) ? <option value={request.assigneeId}>{request.assignee ? `${request.assignee.user.firstName} ${request.assignee.user.lastName}` : "Current assignee"} (not currently eligible)</option> : null}{staff.filter((item) => item.hostelAssignments.some((assignment) => assignment.hostelId === request.hostelId)).map((item) => <option key={item.id} value={item.id}>{item.user.firstName} {item.user.lastName}</option>)}</select></label>
        <Button type="submit" variant="secondary" size="sm" loading={pendingAction === request.id} loadingLabel="Updating request" disabled={pendingAction !== null}>Save changes</Button>
      </form> : <span className="demo-record-note">Demo record · read only</span>}
    </li>;
    })}</ul>}
  </>;
}
