import Link from "next/link";
import { notFound } from "next/navigation";
import { FloorCreateForm } from "@/components/hostels/floor-create-form";
import { FloorDirectoryCard } from "@/components/hostels/floor-directory-card";
import { SurfaceCard } from "@/components/ui/surface-card";
import { PageHeading } from "@/components/ui/page-heading";
import { getBuildings } from "@/lib/buildings";
import { getFloors } from "@/lib/floors";
import { getHostelDirectory } from "@/lib/hostels";
import { DEMO_MODE, demoBuildings, demoFloors, demoHostels } from "@/lib/demo-data";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function FloorsPage({
  params,
}: {
  params: Promise<{ hostelId: string; buildingId: string }>;
}) {
  const { hostelId, buildingId } = await params;
  if (!uuidPattern.test(hostelId) || !uuidPattern.test(buildingId)) notFound();

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
  const apiBuildingResult = hostel && !isDemoHostel ? await getBuildings(hostelId) : null;
  const buildingResult = isDemoHostel
    ? { status: "ok" as const, buildings: demoBuildings.filter((item) => item.hostelId === hostelId) }
    : apiBuildingResult;
  if (buildingResult?.status === "ok" && !buildingResult.buildings.some((building) => building.id === buildingId)) {
    notFound();
  }
  const building = buildingResult?.status === "ok"
    ? buildingResult.buildings.find((item) => item.id === buildingId)
    : undefined;
  const isDemoBuilding = DEMO_MODE && demoBuildings.some((item) => item.id === buildingId);
  const apiResult = building && !isDemoBuilding ? await getFloors(hostelId, buildingId) : null;
  const result = isDemoBuilding
    ? { status: "ok" as const, floors: demoFloors.filter((floor) => floor.buildingId === buildingId) }
    : apiResult;
  const canManage = directory.status === "ok" && directory.manageableHostelIds.includes(hostelId);

  return (
    <main className="page-content hostel-directory-page" data-demo-data={isDemoBuilding ? "true" : undefined}>
      <Link className="buildings-page__back" href={`/hostels/${encodeURIComponent(hostelId)}/buildings`}>← Back to buildings</Link>
      <PageHeading eyebrow="PROPERTY MANAGEMENT" title={building ? `${building.name} floors` : "Floors"} subtitle={`Floor levels for ${hostel?.name ?? "this hostel"}.`} />

      {directory.status !== "ok" ? (
        <SurfaceCard className="dashboard-message" padding="md" role={directory.status === "unavailable" ? "alert" : "status"}>
          {directory.status === "unavailable"
            ? "Hostel information is temporarily unavailable. Please refresh to try again."
            : "Your account does not have access to this hostel."}
        </SurfaceCard>
      ) : null}
      {buildingResult?.status === "not-found" || result?.status === "not-found" ? (
        <SurfaceCard className="dashboard-message" padding="md" role="status">
          This building is no longer available in your assigned scope.
        </SurfaceCard>
      ) : null}
      {buildingResult?.status === "unavailable" || result?.status === "unavailable" ? (
        <SurfaceCard className="dashboard-message" padding="md" role="alert">
          Floor information is temporarily unavailable. Please refresh to try again.
        </SurfaceCard>
      ) : null}

      {canManage && building ? (
        <SurfaceCard as="section" className="hostel-create-panel" padding="md" aria-labelledby="floor-create-title">
          <h2 id="floor-create-title">Add a floor</h2>
          <FloorCreateForm hostelId={hostelId} buildingId={buildingId} />
        </SurfaceCard>
      ) : null}
      {isDemoBuilding ? <p className="demo-record-note">Demo records · read only</p> : null}

      {result?.status === "ok" && result.floors.length === 0 ? (
        <SurfaceCard className="dashboard-message" padding="md" role="status">
          No floors have been added to this building yet.
        </SurfaceCard>
      ) : null}
      {result?.status === "ok" && result.floors.length > 0 ? (
        <ul className="hostel-directory-grid" aria-label={`Floors in ${building?.name ?? "this building"}`}>
          {result.floors.map((floor) => (
            <li key={floor.id}>
              <FloorDirectoryCard floor={floor} hostelId={hostelId} canManage={canManage} />
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
