import { SurfaceCard } from "@/components/ui/surface-card";

export default function FloorsLoading() {
  return (
    <main className="page-content hostel-directory-page" aria-busy="true" aria-label="Loading floors">
      <div className="hostel-directory-grid" aria-hidden="true">
        {["one", "two", "three"].map((item) => (
          <SurfaceCard key={item} className="hostel-directory-skeleton" padding="md">
            <span />
            <span />
            <span />
          </SurfaceCard>
        ))}
      </div>
    </main>
  );
}
