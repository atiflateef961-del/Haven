import Link from "next/link";
import { SurfaceCard } from "@/components/ui/surface-card";
import { PageHeading } from "@/components/ui/page-heading";
import { getHostelDirectory } from "@/lib/hostels";
import { getRoomAvailability } from "@/lib/room-availability";
import { StatIcon } from "@/components/ui/stat-icon";
import { DEMO_MODE, demoAvailableRooms, demoBeds, demoHostels } from "@/lib/demo-data";

function floorName(number: number) {
  return number === 0 ? "Ground floor" : number < 0 ? `Basement ${Math.abs(number)}` : `Floor ${number}`;
}

export default async function RoomAvailabilityPage({ searchParams }: {
  searchParams: Promise<{ hostelId?: string; building?: string; floor?: string; freeOnly?: string }>;
}) {
  const query = await searchParams;
  const apiDirectory = await getHostelDirectory();
  const directory = DEMO_MODE && apiDirectory.status === "ok" && apiDirectory.hostels.length === 0
    ? { ...apiDirectory, hostels: demoHostels }
    : apiDirectory;
  const requested = directory.status === "ok" ? directory.hostels.find((hostel) => hostel.id === query.hostelId) : undefined;
  const hostel = directory.status === "ok"
    ? query.hostelId === undefined ? directory.hostels[0] : requested
    : undefined;
  const invalidHostelSelection = directory.status === "ok" && query.hostelId !== undefined && !requested;
  const demoHostelIndex = hostel ? demoHostels.findIndex((item) => item.id === hostel.id) : -1;
  const demoRoomView = DEMO_MODE && demoHostelIndex >= 0;
  const apiRooms = hostel && !demoRoomView ? await getRoomAvailability(hostel.id) : null;
  const result = demoRoomView
    ? { status: "ok" as const, rooms: demoAvailableRooms.slice(demoHostelIndex * 15, (demoHostelIndex + 1) * 15) }
    : apiRooms;
  const demoBedCells = demoRoomView ? demoBeds.slice(demoHostelIndex * 60, (demoHostelIndex + 1) * 60) : [];
  const rooms = result?.status === "ok" ? result.rooms.filter((room) =>
    (!query.building || room.floor.building.id === query.building) &&
    (query.floor === undefined || query.floor === "" || room.floor.number === Number(query.floor)) &&
    (query.freeOnly !== "true" || room.status === "Free"),
  ) : [];
  const buildings = result?.status === "ok" ? [...new Map(result.rooms.map((room) => [room.floor.building.id, room.floor.building])).values()] : [];
  const floors = result?.status === "ok" ? [...new Set(result.rooms.filter((room) => !query.building || room.floor.building.id === query.building).map((room) => room.floor.number))].sort((a, b) => a - b) : [];

  return (
    <main className="page-content hostel-directory-page" data-demo-data={demoRoomView ? "true" : undefined}>
      <PageHeading
        eyebrow="ROOMS AND BEDS"
        title="Room availability"
        subtitle={hostel && result?.status === "ok"
          ? `${hostel.name}: ${result.rooms.reduce((n, room) => n + room.capacity, 0)} active beds, ${result.rooms.reduce((n, room) => n + room.occupiedBeds, 0)} occupied, ${result.rooms.reduce((n, room) => n + room.freeBeds, 0)} available.`
          : undefined}
      />
      {directory.status !== "ok" ? <SurfaceCard className="dashboard-message" padding="md" role="alert">Room availability is temporarily unavailable. Refresh to try again.</SurfaceCard> : null}
      {directory.status === "ok" && directory.hostels.length === 0 ? <SurfaceCard className="dashboard-message" padding="md" role="status">Set up your hostel to see room and bed availability. <Link href="/hostels">Set up your hostel</Link></SurfaceCard> : null}
      {invalidHostelSelection ? (
        <SurfaceCard className="dashboard-message" padding="md" role="alert">
          That hostel is not available in your assigned workspace. Choose an accessible hostel below or <Link href="/room-availability">reset the selection</Link>.
        </SurfaceCard>
      ) : null}
      {directory.status === "ok" && directory.hostels.length > 1 ? (
        <form className="building-create-form" action="/room-availability">
          <label className="ui-field">
            <span className="ui-field__label">Hostel</span>
            <select className="ui-field__control ui-field__control--md" name="hostelId" defaultValue={hostel?.id ?? ""} required>
              <option value="" disabled>Select a hostel</option>
              {directory.hostels.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          </label>
          <button className="ui-button" type="submit">View hostel</button>
        </form>
      ) : null}
      {hostel && result?.status === "not-found" ? <SurfaceCard className="dashboard-message" padding="md" role="status">This hostel is not available in your assigned workspace.</SurfaceCard> : null}
      {hostel && result?.status === "unavailable" ? <SurfaceCard className="dashboard-message" padding="md" role="alert">Room availability could not be loaded. Refresh to try again.</SurfaceCard> : null}
      {hostel && result?.status === "ok" ? (
        <>
          {demoRoomView ? <SurfaceCard className="demo-room-panel" padding="md" aria-label="Demo bed availability">
            <dl className="demo-room-grid__kpis">
              <div><StatIcon name="bed" /><dt>Active beds</dt><dd>{demoBedCells.length}</dd></div>
              <div><StatIcon name="occupied-bed" /><dt>Occupied</dt><dd>{demoBedCells.filter((bed) => bed.isOccupied).length}</dd></div>
              <div><StatIcon name="available-bed" /><dt>Available</dt><dd>{demoBedCells.filter((bed) => !bed.isOccupied).length}</dd></div>
            </dl>
            <ul className="demo-room-grid" aria-label="Bed availability grid">
              {demoBedCells.map((bed) => <li key={bed.id} data-status={bed.isOccupied ? "occupied" : "available"} aria-label={`${bed.label}: ${bed.isOccupied ? "occupied" : "available"}`}>{bed.label}</li>)}
            </ul>
            <div className="demo-room-grid__legend"><span>Occupied</span><span>Available</span></div>
          </SurfaceCard> : null}
          <form className="building-create-form room-availability-filters" action="/room-availability">
            <input type="hidden" name="hostelId" value={hostel.id} />
            <label className="ui-field"><span className="ui-field__label">Building</span><select className="ui-field__control ui-field__control--md" name="building" defaultValue={query.building ?? ""}><option value="">All buildings</option>{buildings.map((building) => <option value={building.id} key={building.id}>{building.name}</option>)}</select></label>
            <label className="ui-field"><span className="ui-field__label">Floor</span><select className="ui-field__control ui-field__control--md" name="floor" defaultValue={query.floor ?? ""}><option value="">All floors</option>{floors.map((floor) => <option value={floor} key={floor}>{floorName(floor)}</option>)}</select></label>
            <label className="room-availability-filters__checkbox"><input type="checkbox" name="freeOnly" value="true" defaultChecked={query.freeOnly === "true"} /> Unoccupied rooms only</label>
            <button className="ui-button ui-button--primary" type="submit">Apply filters</button>
          </form>
          {rooms.length === 0 ? <SurfaceCard className="dashboard-message" padding="md" role="status">No rooms match these filters yet.</SurfaceCard> : (
            <ul className="hostel-directory-grid" aria-label="Room availability">
              {rooms.map((room) => <li key={room.id}><SurfaceCard className="room-directory-card" padding="md">
                <h2><Link href={`/hostels/${encodeURIComponent(hostel.id)}/buildings/${encodeURIComponent(room.floor.building.id)}/floors/${encodeURIComponent(room.floor.id)}/rooms`}>Room {room.number}</Link></h2>
                <p>{room.floor.building.name} · {floorName(room.floor.number)}{room.roomType ? ` · ${room.roomType}` : ""}</p>
                <p>{room.occupiedBeds} occupied · {room.freeBeds} free · capacity {room.capacity}</p>
                <strong>{room.status}</strong>
              </SurfaceCard></li>)}
            </ul>
          )}
        </>
      ) : null}
    </main>
  );
}
