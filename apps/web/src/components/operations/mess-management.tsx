"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatIcon } from "@/components/ui/stat-icon";
import { apiBaseUrl } from "@/lib/api-url.mjs";
import { demoMessSchedules } from "@/lib/demo-data";
import type { MessSchedule, MessScheduleMutation, MessStudent } from "@/lib/mess";

function isMessScheduleMutation(value: unknown): value is MessScheduleMutation {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.hostelId === "string" &&
    ["BREAKFAST", "LUNCH", "DINNER", "SNACK"].includes(String(record.mealType)) &&
    typeof record.startsAt === "string" && Number.isFinite(Date.parse(record.startsAt)) &&
    typeof record.endsAt === "string" && Number.isFinite(Date.parse(record.endsAt)) &&
    Date.parse(record.endsAt) > Date.parse(record.startsAt) &&
    (record.menu === null || typeof record.menu === "string");
}

function isMealAttendance(value: unknown): value is { id: string; studentId: string; messScheduleId: string; attendedAt: string } {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.studentId === "string" &&
    typeof record.messScheduleId === "string" && typeof record.attendedAt === "string" &&
    Number.isFinite(Date.parse(record.attendedAt));
}

export function MessManagement({ initialSchedules, hostels, students }: {
  initialSchedules: MessSchedule[]; hostels: { id: string; name: string }[]; students: MessStudent[];
}) {
  const router = useRouter();
  const [schedules, setSchedules] = useState(initialSchedules);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const hasDemoSchedules = schedules.some((schedule) => demoMessSchedules.some((demoSchedule) => demoSchedule.id === schedule.id));
  const demoAttendanceCount = schedules.reduce((total, schedule) => total + schedule.attendance.length, 0);
  const demoAttendancePossible = schedules.reduce((total, schedule) => total + students.filter((student) => student.hostelIds.includes(schedule.hostelId)).length, 0);
  const demoAttendanceRate = demoAttendancePossible ? Math.round(demoAttendanceCount / demoAttendancePossible * 100) : 0;

  async function createSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingAction || hostels.length === 0) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const hostelId = String(form.get("hostelId") ?? "");
    const mealType = String(form.get("mealType") ?? "");
    const startsAtMs = new Date(String(form.get("startsAt") ?? "")).getTime();
    const endsAtMs = new Date(String(form.get("endsAt") ?? "")).getTime();
    const menu = String(form.get("menu") ?? "").trim() || null;
    if (!hostels.some((hostel) => hostel.id === hostelId) || !["BREAKFAST", "LUNCH", "DINNER", "SNACK"].includes(mealType)) {
      setError("Select an available hostel and meal type.");
      return;
    }
    if (!Number.isFinite(startsAtMs) || !Number.isFinite(endsAtMs) || endsAtMs <= startsAtMs) {
      setError("Enter valid start and end times. The end must be after the start.");
      return;
    }
    const startsAt = new Date(startsAtMs).toISOString();
    const endsAt = new Date(endsAtMs).toISOString();
    setPendingAction("create"); setError(null); setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/mess-schedules`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostelId, mealType, startsAt, endsAt, menu }),
      });
      if (response.status === 401) { router.replace("/login"); router.refresh(); return; }
      if (response.status === 403 || response.status === 404) { setError("The selected hostel is outside your assigned scope."); return; }
      if (response.status === 400) { setError("Check the meal details and that the end is after the start."); return; }
      if (!response.ok) { setError("The meal schedule could not be saved."); return; }
      let created: unknown;
      try {
        created = await response.json();
      } catch {
        setError("The meal may have been scheduled, but its details could not be verified. Refresh the page.");
        router.refresh();
        return;
      }
      if (!isMessScheduleMutation(created) || created.hostelId !== hostelId ||
        created.mealType !== mealType || Date.parse(created.startsAt) !== startsAtMs ||
        Date.parse(created.endsAt) !== endsAtMs || created.menu !== menu) {
        setError("The meal may have been scheduled, but its details could not be verified. Refresh the page.");
        router.refresh();
        return;
      }
      const hostel = hostels.find((item) => item.id === created.hostelId);
      if (!hostel) {
        setError("The meal was created, but its hostel could not be verified. Refresh the page.");
        router.refresh();
        return;
      }
      const newSchedule: MessSchedule = { ...created, hostel: { name: hostel.name }, attendance: [] };
      setSchedules((current) => [...current, newSchedule].sort((a, b) =>
        Date.parse(b.startsAt) - Date.parse(a.startsAt) || a.id.localeCompare(b.id)));
      formElement.reset();
      setMessage("Meal schedule published.");
    } catch { setError("The mess service is unavailable. Try again."); }
    finally { setPendingAction(null); }
  }

  async function saveMenu(event: FormEvent<HTMLFormElement>, schedule: MessSchedule) {
    event.preventDefault();
    if (pendingAction) return;
    const requestedMenu = String(new FormData(event.currentTarget).get("menu") ?? "").trim() || null;
    const action = `menu:${schedule.id}`;
    setPendingAction(action); setError(null); setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/mess-schedules/${encodeURIComponent(schedule.id)}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menu: requestedMenu }),
      });
      if (response.status === 401) { router.replace("/login"); router.refresh(); return; }
      if (response.status === 403 || response.status === 404) { setError("This meal is outside your assigned hostel scope. The schedule list has been refreshed."); router.refresh(); return; }
      if (!response.ok) { setError("The menu could not be updated."); return; }
      let updated: unknown;
      try {
        updated = await response.json();
      } catch {
        setError("The menu may have been updated, but its details could not be verified. Refresh the page.");
        router.refresh();
        return;
      }
      if (!isMessScheduleMutation(updated) || updated.id !== schedule.id ||
        updated.hostelId !== schedule.hostelId || updated.menu !== requestedMenu ||
        Date.parse(updated.startsAt) !== Date.parse(schedule.startsAt) ||
        Date.parse(updated.endsAt) !== Date.parse(schedule.endsAt) || updated.mealType !== schedule.mealType) {
        setError("The menu was saved, but its details could not be verified. Refresh the page.");
        router.refresh();
        return;
      }
      setSchedules((current) => current.map((item) => item.id === schedule.id ? { ...item, ...updated } : item));
      setMessage("Menu updated.");
    } catch { setError("The mess service is unavailable. Try again."); }
    finally { setPendingAction(null); }
  }

  async function markAttendance(event: FormEvent<HTMLFormElement>, schedule: MessSchedule, scheduleStudents: MessStudent[]) {
    event.preventDefault();
    if (pendingAction) return;
    const formElement = event.currentTarget;
    const studentId = String(new FormData(formElement).get("studentId") ?? "");
    if (!scheduleStudents.some((student) => student.id === studentId)) {
      setError("Select a resident assigned to this hostel.");
      return;
    }
    const action = `attendance:${schedule.id}`;
    setPendingAction(action); setError(null); setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/mess-schedules/${encodeURIComponent(schedule.id)}/attendance`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId }),
      });
      if (response.status === 401) { router.replace("/login"); router.refresh(); return; }
      if (response.status === 403 || response.status === 404) { setError("That schedule or resident is outside your assigned hostel scope."); return; }
      if (!response.ok) { setError("Meal attendance could not be recorded."); return; }
      let result: unknown;
      try {
        result = await response.json();
      } catch {
        setError("Attendance may have been saved, but the result could not be verified. Refresh the page.");
        router.refresh();
        return;
      }
      if (!isMealAttendance(result) || result.messScheduleId !== schedule.id || result.studentId !== studentId) {
        setError("Attendance may have been saved, but the result could not be verified. Refresh the page.");
        router.refresh();
        return;
      }
      setSchedules((current) => current.map((item) => item.id === schedule.id
        ? { ...item, attendance: item.attendance.some((row) => row.studentId === studentId)
          ? item.attendance
          : [...item.attendance, { studentId, attendedAt: result.attendedAt }] }
        : item));
      formElement.reset();
      setMessage("Meal attendance saved.");
    } catch { setError("The mess service is unavailable. Try again."); }
    finally { setPendingAction(null); }
  }

  return <>
    {hasDemoSchedules ? <p className="demo-record-note">Demo schedules · read only</p> : hostels.length === 0 ? <p role="status">No active hostels are available in your assigned scope for meal scheduling.</p> : <form className="operations-form" onSubmit={createSchedule}>
      <h2>Schedule a meal</h2>
      <label>Hostel<select className="ui-field__control ui-field__control--md" name="hostelId" required defaultValue="" disabled={pendingAction !== null}><option value="" disabled>Select hostel</option>{hostels.map((hostel) => <option key={hostel.id} value={hostel.id}>{hostel.name}</option>)}</select></label>
      <label>Meal<select className="ui-field__control ui-field__control--md" name="mealType" required defaultValue="BREAKFAST" disabled={pendingAction !== null}><option value="BREAKFAST">Breakfast</option><option value="LUNCH">Lunch</option><option value="DINNER">Dinner</option><option value="SNACK">Snack</option></select></label>
      <label>Starts<input className="ui-field__control ui-field__control--md" type="datetime-local" name="startsAt" required disabled={pendingAction !== null} /></label>
      <label>Ends<input className="ui-field__control ui-field__control--md" type="datetime-local" name="endsAt" required disabled={pendingAction !== null} /></label>
      <label>Menu<textarea className="ui-field__control ui-field__control--md" name="menu" maxLength={2000} rows={3} disabled={pendingAction !== null} /></label>
      <Button type="submit" loading={pendingAction === "create"} loadingLabel="Publishing meal" disabled={pendingAction !== null}>Publish menu</Button>
    </form>}
    {error ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
    {hasDemoSchedules ? <dl className="demo-operation-kpis" aria-label="Demo meal service totals">
      <div><StatIcon name="meal-schedule" /><dt>Meals scheduled</dt><dd>{schedules.length}</dd></div>
      <div><StatIcon name="meal-days" /><dt>Days covered</dt><dd>{new Set(schedules.map((schedule) => schedule.startsAt.slice(0, 10))).size}</dd></div>
      <div><StatIcon name="meal-attendance" /><dt>Attendance</dt><dd>{demoAttendanceCount}</dd></div>
      <div><StatIcon name="meal-rate" /><dt>Attendance rate</dt><dd>{demoAttendanceRate}%</dd></div>
    </dl> : null}
    <h2>Scheduled meals</h2>
    {schedules.length === 0 ? <p>No meals are scheduled.</p> : <ul className="operations-record-list">{schedules.map((schedule) => {
      const scheduleStudents = students.filter((student) => student.hostelIds.includes(schedule.hostelId));
      const remainingStudents = scheduleStudents.filter((student) =>
        !schedule.attendance.some((row) => row.studentId === student.id));
      const attendancePending = pendingAction === `attendance:${schedule.id}`;
      const menuPending = pendingAction === `menu:${schedule.id}`;
      return <li key={schedule.id}>
        <div><h3>{schedule.mealType} Â· {schedule.hostel.name}</h3><p><time dateTime={schedule.startsAt}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(schedule.startsAt))}</time> to <time dateTime={schedule.endsAt}>{new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(schedule.endsAt))}</time></p></div>
        {!hasDemoSchedules ? <form className="operations-inline-form" onSubmit={(event) => saveMenu(event, schedule)}><label>Menu<textarea className="ui-field__control ui-field__control--md" name="menu" defaultValue={schedule.menu ?? ""} maxLength={2000} rows={2} disabled={pendingAction !== null} /></label><Button type="submit" variant="secondary" size="sm" loading={menuPending} loadingLabel="Saving menu" disabled={pendingAction !== null}>Save menu</Button></form> : <p>{schedule.menu}</p>}
        <p>{schedule.attendance.length} students marked present</p>
        {hasDemoSchedules ? null : scheduleStudents.length === 0 ? <p>No active residents are available for this hostel.</p> : remainingStudents.length === 0 ? <p>All active residents are marked present.</p> : <form className="operations-inline-form" onSubmit={(event) => markAttendance(event, schedule, remainingStudents)}><label>Student<select className="ui-field__control ui-field__control--md" name="studentId" defaultValue="" required disabled={pendingAction !== null}><option value="" disabled>Select resident</option>{remainingStudents.map((student) =>
          <option key={student.id} value={student.id}>{student.firstName} {student.lastName} Â· {student.studentNumber}</option>,
        )}</select></label><Button type="submit" variant="secondary" size="sm" loading={attendancePending} loadingLabel="Recording" disabled={pendingAction !== null}>Mark present</Button></form>}
      </li>;
    })}</ul>}
  </>;
}
