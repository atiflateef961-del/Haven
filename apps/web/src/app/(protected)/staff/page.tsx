import { SurfaceCard } from "@/components/ui/surface-card";
import { PageHeading } from "@/components/ui/page-heading";
import { StaffManagement } from "@/components/operations/staff-management";
import { getStaff } from "@/lib/staff";
import { DEMO_MODE, demoStaff } from "@/lib/demo-data";

export default async function StaffPage() {
  const apiResult = await getStaff();
  const result = DEMO_MODE && apiResult.status === "ok" && apiResult.staff.length === 0
    ? { ...apiResult, staff: demoStaff, organizations: [], hostels: [], users: [], canManage: false }
    : apiResult;
  const isDemoPage = result.status === "ok" && result.staff.some((item) => demoStaff.some((demo) => demo.id === item.id));
  return <main className="page-content" data-demo-data={isDemoPage ? "true" : undefined}>
    {result.status === "ok" ? <StaffManagement initialStaff={result.staff} organizations={result.organizations} hostels={result.hostels} users={result.users} canManage={result.canManage} /> : <>
      <PageHeading eyebrow="DAILY OPERATIONS" title="Staff management" subtitle="Manage staff profiles and their hostel assignments in your authorized organization scope." />
      {result.status === "forbidden" ? <SurfaceCard role="status" padding="md">Your account does not have staff directory access.</SurfaceCard> : null}
      {result.status === "unavailable" ? <SurfaceCard role="alert" padding="md">Staff information is temporarily unavailable. Refresh to try again.</SurfaceCard> : null}
    </>}
  </main>;
}
