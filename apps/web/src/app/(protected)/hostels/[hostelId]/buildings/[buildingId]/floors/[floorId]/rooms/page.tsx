import Link from "next/link";
import { notFound } from "next/navigation";
import { RoomCreateForm } from "@/components/hostels/room-create-form";
import { RoomDirectoryCard } from "@/components/hostels/room-directory-card";
import { SurfaceCard } from "@/components/ui/surface-card";
import { PageHeading } from "@/components/ui/page-heading";
import { getBuildings } from "@/lib/buildings";
import { getFloorBeds } from "@/lib/beds";
import { getFloors } from "@/lib/floors";
import { getHostelDirectory } from "@/lib/hostels";
import { getRooms } from "@/lib/rooms";
import { DEMO_MODE, demoBeds, demoBuildings, demoFloors, demoHostels, demoRooms } from "@/lib/demo-data";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function floorLabel(number: number) {
  if (number === 0) return "Ground floor";
  if (number < 0) return `Basement ${Math.abs(number)}`;
  return `Floor ${number}`;
}

export default async function RoomsPage({
  params,
}: {
  params: Promise<{ hostelId: string; buildingId: string; floorId: string }>;
}) {
  const { hostelId, buildingId, floorId } = await params;
  if (![hostelId, buildingId, floorId].every((id) => uuidPattern.test(id))) notFound();

  const apiDirectory = await getHostelDirectory();
  const directory = DEMO_MODE && apiDirectory.status === "ok" && apiDirectory.hostels.length === 0
    ? { ...apiDirectory, hostels: demoHostels }
    : apiDirectory;
  if (directory.status === "ok" && !directory.hostels.some((hostel) => hostel.id === hostelId)) notFound();
  const hostel = directory.status === "ok" ? directory.hostels.find((item) => item.id === hostelId) : undefined;
  const isDemoHostel = DEMO_MODE && demoHostels.some((item) => item.id === hostelId);
  const apiBuildingsResult = hostel && !isDemoHostel ? await getBuildings(hostelId) : null;
  const buildingsResult = isDemoHostel
    ? { status: "ok" as const, buildings: demoBuildings.filter((item) => item.hostelId === hostelId) }
    : apiBuildingsResult;
  if (buildingsResult?.status === "ok" && !buildingsResult.buildings.some((building) => building.id === buildingId)) notFound();
  const building = buildingsResult?.status === "ok" ? buildingsResult.buildings.find((item) => item.id === buildingId) : undefined;
  const isDemoBuilding = DEMO_MODE && demoBuildings.some((item) => item.id === buildingId);
  const apiFloorsResult = building && !isDemoBuilding ? await getFloors(hostelId, buildingId) : null;
  const floorsResult = isDemoBuilding
    ? { status: "ok" as const, floors: demoFloors.filter((item) => item.buildingId === buildingId) }
    : apiFloorsResult;
  if (floorsResult?.status === "ok" && !floorsResult.floors.some((floor) => floor.id === floorId)) notFound();
  const floor = floorsResult?.status === "ok" ? floorsResult.floors.find((item) => item.id === floorId) : undefined;
  const demoFloor = DEMO_MODE && demoFloors.some((item) => item.id === floorId);
  const [apiRoomsResult, apiFloorBedsResult] = floor && !demoFloor
    ? await Promise.all([
      getRooms(hostelId, buildingId, floorId),
      getFloorBeds(hostelId, buildingId, floorId),
    ])
    : [null, null];
  const roomsResult = demoFloor
    ? { status: "ok" as const, rooms: demoRooms.filter((item) => item.floorId === floorId) }
    : apiRoomsResult;
  const floorBedsResult = demoFloor
    ? { status: "ok" as const, beds: demoBeds.filter((bed) => roomsResult?.status === "ok" && roomsResult.rooms.some((room) => room.id === bed.roomId)) }
    : apiFloorBedsResult;
  const mismatchedBedRoom = roomsResult?.status === "ok" && floorBedsResult?.status === "ok" &&
    floorBedsResult.beds.some((bed) => !roomsResult.rooms.some((room) => room.id === bed.roomId));
  const canManage = directory.status === "ok" && directory.manageableHostelIds.includes(hostelId);

  return (
    <main className="page-content hostel-directory-page" data-demo-data={demoFloor ? "true" : undefined}>
      <Link className="buildings-page__back" href={`/hostels/${encodeURIComponent(hostelId)}/buildings/${encodeURIComponent(buildingId)}/floors`}>← Back to floors</Link>
      <PageHeading eyebrow="PROPERTY MANAGEMENT" title={floor ? `${floorLabel(floor.number)} rooms` : "Rooms"} subtitle={`Rooms in ${building?.name ?? "this building"}, ${hostel?.name ?? "this hostel"}.`} />

      {directory.status !== "ok" ? (
        <SurfaceCard className="dashboard-message" padding="md" role={directory.status === "unavailable" ? "alert" : "status"}>
          {directory.status === "unavailable" ? "Hostel information is temporarily unavailable. Please refresh to try again." : "Your account does not have access to this hostel."}
        </SurfaceCard>
      ) : null}
      {buildingsResult?.status === "not-found" || floorsResult?.status === "not-found" || roomsResult?.status === "not-found" ? (
        <SurfaceCard className="dashboard-message" padding="md" role="status">This floor is no longer available in your assigned scope.</SurfaceCard>
      ) : null}
      {buildingsResult?.status === "unavailable" || floorsResult?.status === "unavailable" || roomsResult?.status === "unavailable" ? (
        <SurfaceCard className="dashboard-message" padding="md" role="alert">Room information is temporarily unavailable. Please refresh to try again.</SurfaceCard>
      ) : null}

      {canManage && floor ? (
        <SurfaceCard as="section" className="hostel-create-panel" padding="md" aria-labelledby="room-create-title">
          <h2 id="room-create-title">Add a room</h2>
          <RoomCreateForm hostelId={hostelId} buildingId={buildingId} floorId={floorId} />
        </SurfaceCard>
      ) : null}
      {demoFloor ? <p className="demo-record-note">Demo records · read only</p> : null}
      {roomsResult?.status === "ok" && roomsResult.rooms.length === 0 ? (
        <SurfaceCard className="dashboard-message" padding="md" role="status">No rooms have been added to this floor yet.</SurfaceCard>
      ) : null}
      {roomsResult?.status === "ok" && roomsResult.rooms.length > 0 ? (
        <ul className="hostel-directory-grid" aria-label={`Rooms on ${floor ? floorLabel(floor.number).toLowerCase() : "this floor"}`}>
          {roomsResult.rooms.map((room) => (
            <li key={room.id}><RoomDirectoryCard
              room={room}
              hostelId={hostelId}
              buildingId={buildingId}
              canManage={canManage}
              beds={floorBedsResult?.status === "ok" && !mismatchedBedRoom
                ? floorBedsResult.beds.filter((bed) => bed.roomId === room.id)
                : []}
              bedError={mismatchedBedRoom
                ? "Bed information could not be read for this floor."
                : floorBedsResult?.status === "unavailable"
                  ? "Bed information is temporarily unavailable. Please refresh to try again."
                  : floorBedsResult?.status === "not-found"
                    ? "Bed information is unavailable in this floor scope."
                    : null}
            /></li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
