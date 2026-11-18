import { SurfaceCard } from "@/components/ui/surface-card";
import { PageHeading } from "@/components/ui/page-heading";

export default function MyProfileLoading() {
  return (
    <main className="page-content student-profile-page" aria-busy="true" aria-label="Loading student profile">
      <PageHeading eyebrow="STUDENT PORTAL" title="My student profile" />
      <SurfaceCard className="student-directory-skeleton" padding="md" aria-hidden="true">
        <span /><span /><span />
      </SurfaceCard>
    </main>
  );
}
