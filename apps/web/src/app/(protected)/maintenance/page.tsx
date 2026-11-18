import { SurfaceCard } from "@/components/ui/surface-card";
import { PageHeading } from "@/components/ui/page-heading";
import { MaintenanceWorkflow } from "@/components/operations/maintenance-workflow";
import { getMaintenance } from "@/lib/maintenance";
import { DEMO_MODE, demoMaintenanceRequests, demoMaintenanceHostels, demoMaintenanceStaff, demoMaintenanceComplaints } from "@/lib/demo-data";

export default async function MaintenancePage() {
  const apiResult = await getMaintenance();
  const result = DEMO_MODE && apiResult.status === "ok" && apiResult.requests.length === 0
    ? { ...apiResult, requests: demoMaintenanceRequests, hostels: demoMaintenanceHostels, staff: demoMaintenanceStaff, complaints: demoMaintenanceComplaints }
    : apiResult;
  const isDemoPage = result.status === "ok" && result.requests.some((item) => demoMaintenanceRequests.some((demo) => demo.id === item.id));
  return <main className="page-content" data-demo-data={isDemoPage ? "true" : undefined}><PageHeading eyebrow="DAILY OPERATIONS" title="Maintenance" subtitle="Record, assign, and track repair work within your assigned hostel scope." />
    {result.status === "forbidden" ? <SurfaceCard role="status" padding="md">Your account does not have maintenance access.</SurfaceCard> : null}
    {result.status === "unavailable" ? <SurfaceCard role="alert" padding="md">Maintenance information is temporarily unavailable. Refresh to try again.</SurfaceCard> : null}
    {result.status === "ok" ? <SurfaceCard as="section" padding="md"><MaintenanceWorkflow key={result.requests.map((request) => `${request.id}:${request.status}:${request.assigneeId ?? ""}`).join("|")} initialRequests={result.requests} hostels={result.hostels} staff={result.staff} complaints={result.complaints} /></SurfaceCard> : null}
  </main>;
}
