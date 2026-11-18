"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/page-heading";
import { SurfaceCard } from "@/components/ui/surface-card";
import { apiBaseUrl } from "@/lib/api-url.mjs";
import type { ManagedStaff, StaffUser } from "@/lib/staff";

type StaffMutation = Pick<ManagedStaff, "id" | "organizationId" | "userId" | "employeeNumber" | "jobTitle">;

const FALLBACK_STAFF_ROLES = [
  "Resident Warden", "Facilities Manager", "Cook", "Cleaner", "Security Guard",
  "Maintenance Technician", "Accountant", "Receptionist",
];

function nextEmployeeNumber(staff: ManagedStaff[]) {
  const usedNumbers = new Set(staff.map((member) => /^EMP-(\d+)$/i.exec(member.employeeNumber)?.[1]).filter(Boolean));
  let nextNumber = 1;
  while (usedNumbers.has(String(nextNumber).padStart(3, "0"))) nextNumber += 1;
  return `EMP-${String(nextNumber).padStart(3, "0")}`;
}

function isStaffMutation(value: unknown): value is StaffMutation {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.organizationId === "string" &&
    typeof record.userId === "string" && typeof record.employeeNumber === "string" &&
    typeof record.jobTitle === "string";
}

export function StaffManagement({ initialStaff, organizations, hostels, users, canManage }: {
  initialStaff: ManagedStaff[]; organizations: { id: string; name: string }[]; hostels: { id: string; organizationId: string; name: string }[]; users: StaffUser[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [staff, setStaff] = useState(initialStaff);
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [highlightedStaffId, setHighlightedStaffId] = useState<string | null>(null);
  const addStaffDialogRef = useRef<HTMLDialogElement>(null);
  const addStaffButtonRef = useRef<HTMLButtonElement>(null);
  const availableUsers = users.filter((user) => user.memberships.some((membership) => membership.organizationId === organizationId));
  const availableHostels = hostels.filter((hostel) => hostel.organizationId === organizationId);
  const roleOptions = [...new Set(staff.map((member) => member.jobTitle))].sort((left, right) => left.localeCompare(right));
  const createRoleOptions = roleOptions.length > 0 ? roleOptions : FALLBACK_STAFF_ROLES;
  const visibleStaff = staff.filter((member) => {
    const query = search.trim().toLocaleLowerCase();
    const matchesSearch = !query || [member.user.firstName, member.user.lastName, member.user.email,
      member.employeeNumber, member.jobTitle, ...member.hostelAssignments.map((assignment) => assignment.hostel.name)]
      .some((value) => value.toLocaleLowerCase().includes(query));
    return matchesSearch && (!roleFilter || member.jobTitle === roleFilter);
  });

  useEffect(() => {
    const dialog = addStaffDialogRef.current;
    if (addStaffOpen && dialog && !dialog.open) dialog.showModal();
  }, [addStaffOpen]);

  useEffect(() => {
    if (!highlightedStaffId) return;
    const timeoutId = window.setTimeout(() => setHighlightedStaffId(null), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [highlightedStaffId]);

  function validateCreateField(name: string, form: HTMLFormElement) {
    const data = new FormData(form);
    const value = String(data.get(name) ?? "").trim();
    let errorText = "";
    if ((name === "organizationId" && !organizationId) || (name === "userId" && !value) || (name === "jobTitle" && !value)) {
      errorText = "This field is required.";
    } else if (name === "employeeNumber") {
      if (!value) errorText = "Enter a staff number.";
      else if (staff.some((member) => member.employeeNumber.trim().toLocaleLowerCase() === value.toLocaleLowerCase())) errorText = "That staff number is already in use.";
    } else if (name === "hostelIds" && !data.getAll("hostelIds").some((hostelId) => String(hostelId).trim())) {
      errorText = "Select a hostel.";
    }
    setFieldErrors((current) => {
      const next = { ...current };
      if (errorText) next[name] = errorText;
      else delete next[name];
      return next;
    });
    return errorText;
  }

  async function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const selectedHostelIds = form.getAll("hostelIds").map(String).filter((hostelId) => hostelId.trim().length > 0);
    const requiredFields = ["organizationId", "userId", "employeeNumber", "jobTitle", "hostelIds"];
    const nextErrors: Record<string, string> = {};
    for (const field of requiredFields) {
      const fieldError = validateCreateField(field, formElement);
      if (fieldError) nextErrors[field] = fieldError;
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError("Fix the highlighted fields before saving.");
      formElement.querySelector<HTMLElement>(`[name="${requiredFields.find((field) => nextErrors[field])}"]`)?.focus();
      return;
    }
    setPendingId("create"); setError(null); setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/staff`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, userId: String(form.get("userId") ?? ""), employeeNumber: String(form.get("employeeNumber") ?? "").trim(), jobTitle: String(form.get("jobTitle") ?? "").trim(), hostelIds: selectedHostelIds }),
      });
      if (response.status === 401) { router.replace("/login"); router.refresh(); return; }
      if (response.status === 403 || response.status === 404) { setError("Choose a member and hostels from the selected organization."); return; }
      if (response.status === 409) {
        const duplicateMessage = "That account or staff number already has a staff profile.";
        setFieldErrors((current) => ({ ...current, employeeNumber: "That staff number is already in use." }));
        setError(duplicateMessage);
        const numberField = formElement.elements.namedItem("employeeNumber");
        if (numberField instanceof HTMLElement) numberField.focus();
        return;
      }
      if (!response.ok) { setError("The staff profile could not be created."); return; }
      let created: unknown;
      try {
        created = await response.json();
      } catch {
        setError("The staff profile was created, but its details could not be loaded. Refresh the directory.");
        router.refresh();
        return;
      }
      if (!isStaffMutation(created)) {
        setError("The staff profile was created, but its details could not be read safely. Refresh the directory.");
        router.refresh();
        return;
      }
      const selectedUser = availableUsers.find((user) => user.id === created.userId);
      const assignedHostels = hostels.filter((hostel) =>
        hostel.organizationId === created.organizationId &&
        selectedHostelIds.includes(hostel.id),
      );
      if (!selectedUser || assignedHostels.length !== selectedHostelIds.length) {
        setError("The staff profile was created, but the directory details could not be matched. Refresh the directory.");
        router.refresh();
        return;
      }
      const createdStaff: ManagedStaff = {
        ...created,
        user: { firstName: selectedUser.firstName, lastName: selectedUser.lastName, email: selectedUser.email },
        hostelAssignments: assignedHostels.map((hostel) => ({ hostelId: hostel.id, hostel: { name: hostel.name } })),
      };
      setStaff((current) => [createdStaff, ...current]);
      setHighlightedStaffId(createdStaff.id);
      setSearch("");
      setRoleFilter("");
      formElement.reset();
      setFieldErrors({});
      setMessage("Staff added");
      addStaffDialogRef.current?.close();
      router.refresh();
    } catch { setError("The staff service is unavailable. Try again."); }
    finally { setPendingId(null); }
  }

  async function updateStaff(event: FormEvent<HTMLFormElement>, member: ManagedStaff) {
    event.preventDefault();
    if (pendingId) return;
    const form = new FormData(event.currentTarget);
    setPendingId(member.id); setError(null); setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/staff/${encodeURIComponent(member.id)}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeNumber: String(form.get("employeeNumber") ?? "").trim(), jobTitle: String(form.get("jobTitle") ?? "").trim(), hostelIds: form.getAll("hostelIds").map(String) }),
      });
      if (response.status === 401) { router.replace("/login"); router.refresh(); return; }
      if (response.status === 403 || response.status === 404) { setError("This staff profile is outside your organization scope."); return; }
      if (response.status === 409) { setError("That employee number is already in use."); return; }
      if (!response.ok) { setError("The staff profile could not be updated."); return; }
      const assignedHostelIds = form.getAll("hostelIds").map(String);
      const hostelAssignments = hostels
        .filter((hostel) => hostel.organizationId === member.organizationId && assignedHostelIds.includes(hostel.id))
        .map((hostel) => ({ hostelId: hostel.id, hostel: { name: hostel.name } }));
      setStaff((current) => current.map((item) => item.id === member.id ? {
        ...item,
        employeeNumber: String(form.get("employeeNumber")).trim(),
        jobTitle: String(form.get("jobTitle")).trim(),
        hostelAssignments,
      } : item));
      setMessage("Staff profile updated and the employee was notified."); router.refresh();
    } catch { setError("The staff service is unavailable. Try again."); }
    finally { setPendingId(null); }
  }

  async function archiveStaff(member: ManagedStaff) {
    if (pendingId) return;
    setPendingId(member.id); setError(null); setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/staff/${encodeURIComponent(member.id)}/archive`, { method: "POST", credentials: "include" });
      if (response.status === 401) { router.replace("/login"); router.refresh(); return; }
      if (response.status === 403 || response.status === 404) { setError("This staff profile is outside your organization scope."); return; }
      if (!response.ok) { setError("The staff profile could not be archived."); return; }
      setStaff((current) => current.filter((item) => item.id !== member.id)); setMessage("Staff profile archived.");
    } catch { setError("The staff service is unavailable. Try again."); }
    finally { setPendingId(null); }
  }

  return <>
    <PageHeading eyebrow="DAILY OPERATIONS" title="Staff management" subtitle="Manage staff profiles and their hostel assignments in your authorized organization scope."
      action={canManage && organizations.length > 0 ? <Button ref={addStaffButtonRef} onClick={() => { setFieldErrors({}); setError(null); setAddStaffOpen(true); }}>Add staff</Button> : null} />
    <SurfaceCard as="section" padding="md">
      {error && !addStaffOpen ? <p role="alert">{error}</p> : null}
      {message ? <p className="staff-success-toast" role="status" aria-live="polite">{message}</p> : null}    <section className="staff-directory" aria-labelledby="staff-directory-title">
      <h2 id="staff-directory-title">Staff directory</h2>
      <dl className="staff-kpis" aria-label="Staff summary">
        <div><dt>Total staff</dt><dd>{staff.length}</dd></div>
        <div><dt>Active</dt><dd>{staff.length}</dd></div>
        <div><dt>Monthly payroll</dt><dd>Not provided</dd><small>Salary is not part of the current staff data.</small></div>
      </dl>
      <div className="form-grid staff-directory-filters">
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="staff-search">Search staff</label>
          <input className="ui-field__control ui-field__control--md" id="staff-search" type="search" value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Name, email, or staff number" />
        </div>
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="staff-role-filter">Role</label>
          <select className="ui-field__control ui-field__control--md" id="staff-role-filter" value={roleFilter} onChange={(event) => setRoleFilter(event.currentTarget.value)}>
            <option value="">All roles</option>
            {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </div>
      </div>
      {staff.length === 0 ? <p>No active staff profiles are available.</p> : visibleStaff.length === 0 ? <p role="status">No staff match these filters.</p> : (
        <div className="staff-directory-table-wrap" role="region" aria-label="Staff directory table" tabIndex={0}>
          <table className="staff-directory-table">
            <thead><tr><th scope="col">Name</th><th scope="col">Staff number</th><th scope="col">Role</th><th scope="col">Hostel</th><th scope="col">Shift</th><th scope="col">Phone</th><th scope="col">Monthly salary in PKR</th><th scope="col">Status</th>{canManage ? <th scope="col">Manage</th> : null}</tr></thead>
            <tbody>{visibleStaff.map((member) => (
              <tr key={member.id} className={member.id === highlightedStaffId ? "staff-directory-table__row--highlight" : undefined}>
                <td data-label="Name"><span className="staff-directory-table__name">{member.user.firstName} {member.user.lastName}</span><span className="staff-directory-table__email">{member.user.email}</span></td>
                <td data-label="Staff number">{member.employeeNumber}</td>
                <td data-label="Role">{member.jobTitle}</td>
                <td data-label="Hostel">{member.hostelAssignments.map((item) => item.hostel.name).join(", ") || "No hostel assignments"}</td>
                <td data-label="Shift">Not provided</td>
                <td data-label="Phone">Not provided</td>
                <td data-label="Monthly salary in PKR">Not provided</td>
                <td data-label="Status"><span className="pill pill--neutral">Active</span></td>
                {canManage ? <td data-label="Manage"><details className="staff-row-actions">
                  <summary>Manage profile</summary>
                  <form className="operations-inline-form" onSubmit={(event) => updateStaff(event, member)}>
                    <label>Staff number<input className="ui-field__control ui-field__control--md" name="employeeNumber" defaultValue={member.employeeNumber} maxLength={60} required disabled={pendingId !== null} /></label>
                    <label>Job title<input className="ui-field__control ui-field__control--md" name="jobTitle" defaultValue={member.jobTitle} maxLength={120} required disabled={pendingId !== null} /></label>
                    <label>Hostel assignments<select className="ui-field__control ui-field__control--md" name="hostelIds" multiple defaultValue={member.hostelAssignments.map((item) => item.hostelId)} disabled={pendingId !== null}>{hostels.filter((item) => item.organizationId === member.organizationId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                    <Button type="submit" variant="secondary" size="sm" loading={pendingId === member.id} loadingLabel="Saving" disabled={pendingId !== null && pendingId !== member.id}>Save profile</Button>
                    <Button type="button" variant="destructive" size="sm" disabled={!!pendingId} onClick={() => archiveStaff(member)}>Archive profile</Button>
                  </form>
                </details></td> : null}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
    </SurfaceCard>    {canManage && organizations.length > 0 ? <dialog ref={addStaffDialogRef} className="staff-add-dialog" aria-labelledby="staff-add-title" aria-modal="true"
      onClose={() => { setAddStaffOpen(false); window.requestAnimationFrame(() => addStaffButtonRef.current?.focus()); }}>
      <div className="staff-add-dialog__header">
        <div><p className="auth-eyebrow">STAFF DIRECTORY</p><h2 id="staff-add-title">Add staff</h2></div>
        <Button variant="ghost" className="staff-add-dialog__close" aria-label="Close Add staff dialog" onClick={() => addStaffDialogRef.current?.close()}>Close</Button>
      </div>
      <p className="staff-add-dialog__note">New profiles use an existing active organization account. Shift, phone, salary, join date, and status are not supported by the current staff API.</p>
      {error && addStaffOpen ? <p className="staff-add-dialog__error" role="alert">{error}</p> : null}
      {availableUsers.length === 0 ? <p role="status">No eligible active organization accounts are available to add as staff.</p> : null}
      {availableHostels.length === 0 ? <p role="status">Add an active hostel to this organization before creating a staff profile.</p> : null}
      <form key={staff.length} className="form-grid staff-add-form" onSubmit={createStaff} noValidate>
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="staff-add-organization">Organization <span className="ui-field__required" aria-hidden="true">*</span></label>
          <select className="ui-field__control ui-field__control--md" id="staff-add-organization" name="organizationId" value={organizationId} onChange={(event) => setOrganizationId(event.currentTarget.value)} onBlur={(event) => validateCreateField("organizationId", event.currentTarget.form!)} required disabled={pendingId !== null} aria-invalid={!!fieldErrors.organizationId} aria-describedby={fieldErrors.organizationId ? "staff-add-organization-error" : undefined}>
            {organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {fieldErrors.organizationId ? <span id="staff-add-organization-error" className="ui-field__error" role="alert">{fieldErrors.organizationId}</span> : null}
        </div>
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="staff-add-user">Full name <span className="ui-field__required" aria-hidden="true">*</span></label>
          <select autoFocus className="ui-field__control ui-field__control--md" id="staff-add-user" name="userId" defaultValue="" onBlur={(event) => validateCreateField("userId", event.currentTarget.form!)} required disabled={pendingId !== null} aria-invalid={!!fieldErrors.userId} aria-describedby={fieldErrors.userId ? "staff-add-user-error" : undefined}>
            <option value="" disabled>Select an active account</option>
            {availableUsers.map((user) => <option key={user.id} value={user.id}>{user.firstName} {user.lastName} · {user.email}</option>)}
          </select>
          {fieldErrors.userId ? <span id="staff-add-user-error" className="ui-field__error" role="alert">{fieldErrors.userId}</span> : null}
        </div>
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="staff-add-number">Staff number <span className="ui-field__required" aria-hidden="true">*</span></label>
          <input className="ui-field__control ui-field__control--md" id="staff-add-number" name="employeeNumber" defaultValue={nextEmployeeNumber(staff)} maxLength={60} onBlur={(event) => validateCreateField("employeeNumber", event.currentTarget.form!)} required disabled={pendingId !== null} aria-invalid={!!fieldErrors.employeeNumber} aria-describedby={fieldErrors.employeeNumber ? "staff-add-number-error" : undefined} />
          {fieldErrors.employeeNumber ? <span id="staff-add-number-error" className="ui-field__error" role="alert">{fieldErrors.employeeNumber}</span> : null}
        </div>
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="staff-add-role">Role <span className="ui-field__required" aria-hidden="true">*</span></label>
          <select className="ui-field__control ui-field__control--md" id="staff-add-role" name="jobTitle" defaultValue="" onBlur={(event) => validateCreateField("jobTitle", event.currentTarget.form!)} required disabled={pendingId !== null} aria-invalid={!!fieldErrors.jobTitle} aria-describedby={fieldErrors.jobTitle ? "staff-add-role-error" : undefined}>
            <option value="" disabled>Select a role</option>
            {createRoleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          {fieldErrors.jobTitle ? <span id="staff-add-role-error" className="ui-field__error" role="alert">{fieldErrors.jobTitle}</span> : null}
        </div>
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="staff-add-hostel">Hostel <span className="ui-field__required" aria-hidden="true">*</span></label>
          <select className="ui-field__control ui-field__control--md" id="staff-add-hostel" name="hostelIds" defaultValue="" onBlur={(event) => validateCreateField("hostelIds", event.currentTarget.form!)} required disabled={pendingId !== null} aria-invalid={!!fieldErrors.hostelIds} aria-describedby={fieldErrors.hostelIds ? "staff-add-hostel-error" : undefined}>
            <option value="" disabled>Select a hostel</option>
            {availableHostels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {fieldErrors.hostelIds ? <span id="staff-add-hostel-error" className="ui-field__error" role="alert">{fieldErrors.hostelIds}</span> : null}
        </div>
        <Button type="submit" loading={pendingId === "create"} loadingLabel="Adding staff" disabled={pendingId !== null || availableUsers.length === 0 || availableHostels.length === 0}>Add staff</Button>
      </form>
    </dialog> : null}
  </>;
}
