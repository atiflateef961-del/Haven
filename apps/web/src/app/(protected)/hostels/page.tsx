import { SurfaceCard } from "@/components/ui/surface-card";
import { PageHeading } from "@/components/ui/page-heading";
import { HostelCreateForm } from "@/components/hostels/hostel-create-form";
import { HostelSetupWizard } from "@/components/hostels/hostel-setup-wizard";
import { HostelDirectoryCard } from "@/components/hostels/hostel-directory-card";
import { getHostelDirectory } from "@/lib/hostels";
import { DEMO_MODE, demoAvailableRooms, demoHostels, demoOrganizationSummary } from "@/lib/demo-data";

export default async function HostelsPage() {
  const apiResult = await getHostelDirectory();
  const result = DEMO_MODE && apiResult.status === "ok" && apiResult.hostels.length === 0
    ? { ...apiResult, hostels: demoHostels }
    : apiResult;
  const isDemoPage = result.status === "ok" && result.hostels.some((hostel) => demoHostels.some((demoHostel) => demoHostel.id === hostel.id));
  const demoHostelMetrics = new Map(demoOrganizationSummary.hostelOccupancy.map((metrics, index) => [metrics.hostelId, {
    ...metrics,
    rooms: demoAvailableRooms.slice(index * 15, (index + 1) * 15).length,
  }]));

  return (
    <main className="page-content hostel-directory-page" data-demo-data={isDemoPage ? "true" : undefined}>
      <PageHeading eyebrow="PROPERTY MANAGEMENT" title="Hostels" subtitle="Hostel locations available in your assigned workspace." />

      {result.status === "ok" && result.hostels.length > 0 && result.creatableOrganizations.length > 0 ? (
        <SurfaceCard as="section" className="hostel-create-panel" padding="md" aria-labelledby="hostel-create-title">
          <h2 id="hostel-create-title">Add a hostel</h2>
          <HostelCreateForm organizations={result.creatableOrganizations} />
        </SurfaceCard>
      ) : null}

      {result.status === "ok" && result.hostels.length === 0 && result.creatableOrganizations.length === 1 ? (
        <SurfaceCard as="section" className="hostel-create-panel" padding="md" aria-labelledby="hostel-setup-title">
          <h2 id="hostel-setup-title">Set up your hostel</h2>
          <HostelSetupWizard organizationId={result.creatableOrganizations[0].id} organizationName={result.creatableOrganizations[0].name} />
        </SurfaceCard>
      ) : null}

      {result.status === "forbidden" ? (
        <SurfaceCard className="dashboard-message" padding="md" role="status">
          Your account does not have access to hostel records. Contact your organization administrator.
        </SurfaceCard>
      ) : null}
      {result.status === "unavailable" ? (
        <SurfaceCard className="dashboard-message" padding="md" role="alert">
          Hostel information is temporarily unavailable. Please refresh to try again.
        </SurfaceCard>
      ) : null}
      {result.status === "ok" && result.hostels.length === 0 ? (
        <SurfaceCard className="dashboard-message" padding="md" role="status">
          No active hostels are available in your assigned scope.
        </SurfaceCard>
      ) : null}
      {result.status === "ok" && result.hostels.length > 0 ? (
        <ul className="hostel-directory-grid" aria-label="Accessible hostels">
          {result.hostels.map((hostel) => (
            <li key={hostel.id}>
              <HostelDirectoryCard
                hostel={hostel}
                canManage={result.manageableHostelIds.includes(hostel.id)}
              />
              {isDemoPage ? (() => {
                const metrics = demoHostelMetrics.get(hostel.id);
                return metrics ? <p className="demo-hostel-metrics">{metrics.rooms} rooms · {metrics.beds} beds · {Math.round(metrics.occupancyRate ?? 0)}% occupied</p> : null;
              })() : null}
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
