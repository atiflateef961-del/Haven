import { SurfaceCard } from "@/components/ui/surface-card";
import { PageHeading } from "@/components/ui/page-heading";
import { MessManagement } from "@/components/operations/mess-management";
import { getMess } from "@/lib/mess";
import { DEMO_MODE, demoMessSchedules, demoMessStudents, demoMaintenanceHostels } from "@/lib/demo-data";

export default async function MessPage() {
  const apiResult = await getMess();
  const result = DEMO_MODE && apiResult.status === "ok" && apiResult.schedules.length === 0
    ? { ...apiResult, schedules: demoMessSchedules, hostels: demoMaintenanceHostels.map(({ id, name }) => ({ id, name })), students: demoMessStudents }
    : apiResult;
  const isDemoPage = result.status === "ok" && result.schedules.some((item) => demoMessSchedules.some((demo) => demo.id === item.id));
  return <main className="page-content" data-demo-data={isDemoPage ? "true" : undefined}><PageHeading eyebrow="DAILY OPERATIONS" title="Mess and menus" subtitle="Schedule meals, publish menus, and record attendance for active residents." />
    {result.status === "forbidden" ? <SurfaceCard role="status" padding="md">Your account does not have mess management access.</SurfaceCard> : null}
    {result.status === "unavailable" ? <SurfaceCard role="alert" padding="md">Mess information is temporarily unavailable. Refresh to try again.</SurfaceCard> : null}
    {result.status === "ok" ? <SurfaceCard as="section" padding="md"><MessManagement key={JSON.stringify(result.schedules.map((schedule) => [schedule.id, schedule.startsAt, schedule.endsAt, schedule.menu, schedule.attendance.map((row) => [row.studentId, row.attendedAt])]))} initialSchedules={result.schedules} hostels={result.hostels} students={result.students} /></SurfaceCard> : null}
  </main>;
}
