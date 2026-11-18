import Link from "next/link";
import { SurfaceCard } from "@/components/ui/surface-card";
import { PageHeading } from "@/components/ui/page-heading";
import { getBookingRequests } from "@/lib/bookings";
import { BookingReviewCard } from "@/components/bookings/booking-review-card";
import { DEMO_MODE, demoBookings } from "@/lib/demo-data";

type BookingsPageProps = { searchParams: Promise<{ page?: string }> };

export default async function BookingsPage({ searchParams }: BookingsPageProps) {
  const query = await searchParams;
  const requestedPage = Number(query.page ?? "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 1_000_000 ? requestedPage : 1;
  const apiResult = await getBookingRequests(page);
  const result = DEMO_MODE && page === 1 && apiResult.status === "ok" && apiResult.bookings.length === 0
    ? { ...apiResult, bookings: demoBookings, hasMore: false }
    : apiResult;
  const isDemoPage = result.status === "ok" && result.bookings.some((item) => demoBookings.some((demo) => demo.id === item.id));

  return (
    <main className="page-content booking-review-page" data-demo-data={isDemoPage ? "true" : undefined}>
      <PageHeading eyebrow="STUDENT SERVICES" title="Booking requests" subtitle="Review student requests by their requested stay dates and organization." />
      {result.status === "forbidden" ? (
        <SurfaceCard className="dashboard-message" padding="md" role="status">
          Your account does not have organization-level access to review booking requests.
        </SurfaceCard>
      ) : null}
      {result.status === "unavailable" ? (
        <SurfaceCard className="dashboard-message" padding="md" role="alert">
          Booking requests are temporarily unavailable. Please refresh to try again.
        </SurfaceCard>
      ) : null}
      {result.status === "ok" && result.bookings.length === 0 ? (
        <SurfaceCard className="dashboard-message" padding="md" role="status">There are no booking requests on this page.</SurfaceCard>
      ) : null}
      {result.status === "ok" && result.bookings.length > 0 ? (
        <>
          <ul className="booking-review-list" aria-label="Booking requests">
            {result.bookings.map((booking) => (
              <li key={booking.id}>
                <BookingReviewCard booking={booking} />
              </li>
            ))}
          </ul>
          <nav className="student-directory-pagination" aria-label="Booking request pages">
            {page > 1 ? <Link href={`/bookings?page=${page - 1}`}>Previous page</Link> : <span />}
            <span>Page {page}</span>
            {result.hasMore ? <Link href={`/bookings?page=${page + 1}`}>Next page</Link> : <span />}
          </nav>
        </>
      ) : null}
    </main>
  );
}
