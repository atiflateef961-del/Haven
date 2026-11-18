import { SurfaceCard } from "@/components/ui/surface-card";
import { PageHeading } from "@/components/ui/page-heading";

export default function StudentsLoading() {
  return (
    <main className="page-content student-directory-page" aria-busy="true" aria-label="Loading students">
      <PageHeading eyebrow="STUDENT MANAGEMENT" title="Students" />
      <SurfaceCard className="student-directory-skeleton" padding="md" aria-hidden="true">
        <span /><span /><span />
      </SurfaceCard>
    </main>
  );
}
