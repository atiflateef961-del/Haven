import { SurfaceCard } from "@/components/ui/surface-card";
import { PageHeading } from "@/components/ui/page-heading";
import { VisitorLog } from "@/components/operations/visitor-log";
import { getVisitors } from "@/lib/visitors";
import { DEMO_MODE, demoVisitors, demoVisitorStudents } from "@/lib/demo-data";

export default async function VisitorsPage() {
  const apiResult = await getVisitors();
  const result = DEMO_MODE && apiResult.status === "ok" && apiResult.visits.length === 0
    ? { ...apiResult, visits: demoVisitors, students: demoVisitorStudents }
    : apiResult;
  const isDemoPage = result.status === "ok" && result.visits.some((visit) => demoVisitors.some((demoVisit) => demoVisit.id === visit.id));
  return <main className="page-content" data-demo-data={isDemoPage ? "true" : undefined}>
    <PageHeading eyebrow="DAILY OPERATIONS" title="Visitor log" subtitle="Record and review visitors for students in your assigned organizations or hostels." />
    {result.status === "forbidden" ? <SurfaceCard role="status" padding="md">Your account does not have visitor log access.</SurfaceCard> : null}
    {result.status === "unavailable" ? <SurfaceCard role="alert" padding="md">Visitor information is temporarily unavailable. Refresh to try again.</SurfaceCard> : null}
    {result.status === "ok" ? <SurfaceCard as="section" padding="md"><VisitorLog key={JSON.stringify(result.visits.map((visit) => [visit.id, visit.visitAt, visit.status]))} initialVisits={result.visits} students={result.students} /></SurfaceCard> : null}
  </main>;
}
