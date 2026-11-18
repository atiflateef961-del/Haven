import Link from "next/link";
import { notFound } from "next/navigation";
import { BuildingCreateForm } from "@/components/hostels/building-create-form";
import { BuildingDirectoryCard } from "@/components/hostels/building-directory-card";
import { SurfaceCard } from "@/components/ui/surface-card";
import { PageHeading } from "@/components/ui/page-heading";
import { getHostelDirectory } from "@/lib/hostels";
import { getBuildings } from "@/lib/buildings";
import { DEMO_MODE, demoBuildings, demoHostels } from "@/lib/demo-data";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function BuildingsPage({
  params,
}: {
  params: Promise<{ hostelId: string }>;
}) {
  const { hostelId } = await params;
  if (!uuidPattern.test(hostelId)) notFound();

  const apiDirectory = await getHostelDirectory();
  const directory = DEMO_MODE && apiDirectory.status === "ok" && apiDirectory.hostels.length === 0
    ? { ...apiDirectory, hostels: demoHostels }
    : apiDirectory;
  if (directory.status === "ok" && !directory.hostels.some((hostel) => hostel.id === hostelId)) {
    notFound();
  }
  const hostel = directory.status === "ok"
    ? directory.hostels.find((item) => item.id === hostelId)
    : undefined;
  const isDemoHostel = DEMO_MODE && demoHostels.some((item) => item.id === hostelId);
  const apiResult = hostel && !isDemoHostel ? await getBuildings(hostelId) : null;
  const result = isDemoHostel
    ? { status: "ok" as const, buildings: demoBuildings.filter((building) => building.hostelId === hostelId) }
    : apiResult;
  const canManage = directory.status === "ok" && directory.manageableHostelIds.includes(hostelId);

  return (
    <main className="page-content hostel-directory-page" data-demo-data={isDemoHostel ? "true" : undefined}>
      <Link className="buildings-page__back" href="/hostels">← Back to hostels</Link>
      <PageHeading eyebrow="PROPERTY MANAGEMENT" title={hostel ? `${hostel.name} buildings` : "Buildings"} subtitle="Buildings and room capacity for this hostel." />

      {directory.status !== "ok" ? (
        <SurfaceCard className="dashboard-message" padding="md" role={directory.status === "unavailable" ? "alert" : "status"}>
          {directory.status === "unavailable"
            ? "Hostel information is temporarily unavailable. Please refresh to try again."
            : "Your account does not have access to this hostel."}
        </SurfaceCard>
      ) : null}
      {result?.status === "not-found" ? (
        <SurfaceCard className="dashboard-message" padding="md" role="status">
          This hostel is no longer available in your assigned scope.
        </SurfaceCard>
      ) : null}
      {result?.status === "unavailable" ? (
        <SurfaceCard className="dashboard-message" padding="md" role="alert">
          Building information is temporarily unavailable. Please refresh to try again.
        </SurfaceCard>
      ) : null}

      {canManage && hostel ? (
        <SurfaceCard as="section" className="hostel-create-panel" padding="md" aria-labelledby="building-create-title">
          <h2 id="building-create-title">Add a building</h2>
          <BuildingCreateForm hostelId={hostel.id} />
        </SurfaceCard>
      ) : null}
      {isDemoHostel ? <p className="demo-record-note">Demo records · read only</p> : null}

      {result?.status === "ok" && result.buildings.length === 0 ? (
        <SurfaceCard className="dashboard-message" padding="md" role="status">
          No buildings have been added to this hostel yet.
        </SurfaceCard>
      ) : null}
      {result?.status === "ok" && result.buildings.length > 0 ? (
        <ul className="hostel-directory-grid" aria-label={`Buildings in ${hostel?.name ?? "this hostel"}`}>
          {result.buildings.map((building) => (
            <li key={building.id}>
              <BuildingDirectoryCard building={building} canManage={canManage} />
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
