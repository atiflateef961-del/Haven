import { SurfaceCard } from "@/components/ui/surface-card";
import { PageHeading } from "@/components/ui/page-heading";

export default function HostelsLoading() {
  return (
    <main className="page-content hostel-directory-page" aria-busy="true">
      <PageHeading eyebrow="PROPERTY MANAGEMENT" title="Hostels" />
      <p className="visually-hidden" role="status">Loading hostel records.</p>
      <ul className="hostel-directory-grid" aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <li key={item}>
            <SurfaceCard className="hostel-directory-skeleton" padding="md">
              <span />
              <span />
              <span />
            </SurfaceCard>
          </li>
        ))}
      </ul>
    </main>
  );
}
