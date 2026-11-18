"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { TextField } from "@/components/ui/text-field";
import type { Student } from "@/lib/students";
import { GuardianPanel } from "@/components/students/guardian-panel";
import { DocumentPanel } from "@/components/students/document-panel";
import { RoomHistoryPanel } from "@/components/students/room-history-panel";
import { apiBaseUrl } from "@/lib/api-url.mjs";
import { demoStudents } from "@/lib/demo-data";

export function StudentDirectoryCard({ student }: { student: Student }) {
  const isDemoStudent = demoStudents.some((demoStudent) => demoStudent.id === student.id);
  const router = useRouter();
  const archiveDialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState(false);
  const [pendingAction, setPendingAction] = useState<"attendance" | "edit" | "archive" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submitAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingAction) return;
    const values = new FormData(event.currentTarget);
    setPendingAction("attendance");
    setError(null);
    setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/students/${encodeURIComponent(student.id)}/attendance`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceDate: String(values.get("attendanceDate") ?? ""),
          status: String(values.get("attendanceStatus") ?? ""),
          note: String(values.get("attendanceNote") ?? "").trim() || null,
        }),
      });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("You no longer have permission to mark attendance for this student.");
        return;
      }
      if (response.status === 400) {
        setError("Choose a valid date and attendance status.");
        return;
      }
      if (!response.ok) {
        setError("Attendance could not be saved. Please try again.");
        return;
      }
      setMessage("Attendance saved.");
    } catch {
      setError("The attendance service is unavailable. Please try again.");
    } finally {
      setPendingAction(null);
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingAction) return;
    const values = new FormData(event.currentTarget);
    const optional = (key: string) => String(values.get(key) ?? "").trim();
    const payload = {
      studentNumber: optional("studentNumber"),
      firstName: optional("firstName"),
      lastName: optional("lastName"),
      email: optional("email") || null,
      phone: optional("phone") || null,
      dateOfBirth: optional("dateOfBirth") || null,
      educationInstitution: optional("educationInstitution") || null,
      educationProgram: optional("educationProgram") || null,
      educationYear: optional("educationYear") || null,
      status: String(values.get("status") ?? student.status),
    };

    setPendingAction("edit");
    setError(null);
    setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/students/${encodeURIComponent(student.id)}`, {
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
      if (response.status === 403 || response.status === 404) {
        setError("You no longer have permission to edit this student.");
        return;
      }
      if (response.status === 409) {
        setError("That student number is already in use in this organization.");
        return;
      }
      if (response.status === 400) {
        setError("Check the student number, name, contact details, and birth date, then try again.");
        return;
      }
      if (!response.ok) {
        setError("The student could not be updated. Please try again.");
        return;
      }
      setEditing(false);
      setMessage(`${payload.firstName} ${payload.lastName} was updated.`);
      router.refresh();
    } catch {
      setError("The student service is unavailable. Please try again.");
    } finally {
      setPendingAction(null);
    }
  }

  async function archiveStudent() {
    if (pendingAction) return;
    setPendingAction("archive");
    setError(null);
    setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/students/${encodeURIComponent(student.id)}/archive`, {
        method: "POST",
        credentials: "include",
      });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("You no longer have permission to archive this student.");
        archiveDialog.current?.close();
        return;
      }
      if (response.status === 409) {
        setError("This student has an active bed allocation and cannot be archived yet.");
        archiveDialog.current?.close();
        return;
      }
      if (!response.ok) {
        setError("The student could not be archived. Please try again.");
        archiveDialog.current?.close();
        return;
      }
      archiveDialog.current?.close();
      setMessage(`${student.firstName} ${student.lastName} was archived.`);
      router.refresh();
    } catch {
      setError("The student service is unavailable. Please try again.");
      archiveDialog.current?.close();
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <SurfaceCard as="article" className="student-directory-card" padding="md">
      <div className="student-directory-card__heading">
        <div>
          <p>{student.studentNumber}</p>
          <h2>{student.firstName} {student.lastName}</h2>
        </div>
      </div>
      <dl>
        <div><dt>Email</dt><dd>{student.email ?? "Not provided"}</dd></div>
        <div><dt>Phone</dt><dd>{student.phone ?? "Not provided"}</dd></div>
        <div><dt>Date of birth</dt><dd>{student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString("en", { dateStyle: "medium", timeZone: "UTC" }) : "Not provided"}</dd></div>
        {student.gender ? <div><dt>Gender</dt><dd>{student.gender}</dd></div> : null}
        <div><dt>Institution</dt><dd>{student.educationInstitution ?? "Not provided"}</dd></div>
        <div><dt>Program</dt><dd>{student.educationProgram ?? "Not provided"}</dd></div>
        <div><dt>Year of study</dt><dd>{student.educationYear ?? "Not provided"}</dd></div>
        <div><dt>Status</dt><dd>{student.status[0] + student.status.slice(1).toLowerCase()}</dd></div>
      </dl>
      {error ? <p className="student-directory-card__message student-directory-card__message--error" role="alert">{error}</p> : null}
      {message ? <p className="student-directory-card__message" role="status">{message}</p> : null}
      {isDemoStudent ? <p className="demo-record-note">Demo profile · read only</p> : <div className="student-directory-card__actions">
        <Button variant="secondary" size="sm" onClick={() => { setError(null); setEditing((value) => !value); }} aria-expanded={editing} disabled={pendingAction !== null}>
          {editing ? "Cancel edit" : "Edit"}
        </Button>
        <Button variant="destructive" size="sm" onClick={() => archiveDialog.current?.showModal()} disabled={pendingAction !== null}>
          Archive
        </Button>
      </div>}
      {!isDemoStudent ? <GuardianPanel studentId={student.id} studentName={`${student.firstName} ${student.lastName}`} /> : null}
      {!isDemoStudent ? <DocumentPanel studentId={student.id} studentName={`${student.firstName} ${student.lastName}`} /> : null}
      {!isDemoStudent ? <RoomHistoryPanel studentId={student.id} studentName={`${student.firstName} ${student.lastName}`} /> : null}
      {!isDemoStudent ? <form className="student-directory-card__edit" onSubmit={submitAttendance}>
        <h3>Mark attendance</h3>
        <TextField label="Attendance date" name="attendanceDate" type="date" required />
        <label className="student-status-field" htmlFor={`attendance-status-${student.id}`}>
          Attendance status
          <select id={`attendance-status-${student.id}`} className="ui-field__control ui-field__control--md" name="attendanceStatus" defaultValue="PRESENT" required>
            <option value="PRESENT">Present</option>
            <option value="ABSENT">Absent</option>
            <option value="LATE">Late</option>
            <option value="EXCUSED">Excused</option>
          </select>
        </label>
        <TextField label="Note (optional)" name="attendanceNote" maxLength={500} />
        <Button type="submit" loading={pendingAction === "attendance"} loadingLabel="Saving attendance" disabled={pendingAction !== null}>Save attendance</Button>
      </form> : null}
      {!isDemoStudent && editing ? (
        <form className="student-directory-card__edit" onSubmit={submitEdit}>
          <TextField label="Student number" name="studentNumber" defaultValue={student.studentNumber} maxLength={60} required />
          <TextField label="First name" name="firstName" defaultValue={student.firstName} maxLength={100} required />
          <TextField label="Last name" name="lastName" defaultValue={student.lastName} maxLength={100} required />
          <TextField label="Email" name="email" type="email" defaultValue={student.email ?? ""} maxLength={320} />
          <TextField label="Phone" name="phone" type="tel" defaultValue={student.phone ?? ""} maxLength={32} />
          <TextField label="Date of birth" name="dateOfBirth" type="date" defaultValue={student.dateOfBirth?.slice(0, 10) ?? ""} />
          <TextField label="Educational institution" name="educationInstitution" defaultValue={student.educationInstitution ?? ""} maxLength={180} />
          <TextField label="Program or course" name="educationProgram" defaultValue={student.educationProgram ?? ""} maxLength={180} />
          <TextField label="Year of study" name="educationYear" defaultValue={student.educationYear ?? ""} maxLength={40} />
          <label className="student-status-field" htmlFor={`student-status-${student.id}`}>
            Student status
            <select id={`student-status-${student.id}`} className="ui-field__control ui-field__control--md" name="status" defaultValue={student.status}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="GRADUATED">Graduated</option>
            </select>
            <span className="student-status-field__hint">Status is informational. Archiving is a separate action.</span>
          </label>
          <Button type="submit" loading={pendingAction === "edit"} loadingLabel="Saving profile" disabled={pendingAction !== null}>Save changes</Button>
        </form>
      ) : null}
      {!isDemoStudent ? <dialog ref={archiveDialog} className="hostel-archive-dialog" aria-labelledby={`archive-student-title-${student.id}`}>
        <h2 id={`archive-student-title-${student.id}`}>Archive {student.firstName} {student.lastName}?</h2>
        <p>The profile will leave the active directory, and its existing records will be retained. Students with active bed allocations cannot be archived.</p>
        <div className="student-directory-card__actions">
          <Button variant="secondary" onClick={() => archiveDialog.current?.close()} disabled={pendingAction !== null}>Cancel</Button>
          <Button variant="destructive" loading={pendingAction === "archive"} loadingLabel="Archiving student" onClick={archiveStudent} disabled={pendingAction !== null}>Archive student</Button>
        </div>
      </dialog> : null}
    </SurfaceCard>
  );
}
