import { SurfaceCard } from "@/components/ui/surface-card";
import { PageHeading } from "@/components/ui/page-heading";
import { ComplaintsWorkflow } from "@/components/operations/complaints-workflow";
import { getComplaints } from "@/lib/complaints";
import { DEMO_MODE, demoComplaints } from "@/lib/demo-data";

export default async function ComplaintsPage() {
  const apiResult = await getComplaints();
  const result = DEMO_MODE && apiResult.status === "ok" && apiResult.complaints.length === 0
    ? { ...apiResult, complaints: demoComplaints, staff: [], canManage: false, canSubmit: false }
    : apiResult;
  const isDemoPage = result.status === "ok" && result.complaints.some((item) => demoComplaints.some((demo) => demo.id === item.id));
  return <main className="page-content" data-demo-data={isDemoPage ? "true" : undefined}><PageHeading eyebrow="DAILY OPERATIONS" title="Complaints" subtitle="Submit and track student concerns, or review and manage complaints in your assigned scope." />
    {result.status === "forbidden" ? <SurfaceCard role="status" padding="md">Your account does not have complaint access.</SurfaceCard> : null}
    {result.status === "unavailable" ? <SurfaceCard role="alert" padding="md">Complaint information is temporarily unavailable. Refresh to try again.</SurfaceCard> : null}
    {result.status === "ok" ? <SurfaceCard as="section" padding="md"><ComplaintsWorkflow initialComplaints={result.complaints} staff={result.staff} canManage={result.canManage} canSubmit={result.canSubmit} /></SurfaceCard> : null}
  </main>;
}
