import { SurfaceCard } from "@/components/ui/surface-card";
import { PageHeading } from "@/components/ui/page-heading";
import { getMyStudentProfile } from "@/lib/students";
import { StudentSelfProfileCard } from "@/components/students/student-self-profile-card";

export default async function MyProfilePage() {
  const result = await getMyStudentProfile();

  return (
    <main className="page-content student-profile-page">
      <PageHeading eyebrow="STUDENT PORTAL" title="My student profile" />
      {result.status === "no-profile" ? (
        <SurfaceCard className="dashboard-message" padding="md" role="status">
          This account is not linked to an active student profile. Contact your organization administrator if this seems incorrect.
        </SurfaceCard>
      ) : null}
      {result.status === "unavailable" ? (
        <SurfaceCard className="dashboard-message" padding="md" role="alert">
          Your profile is temporarily unavailable. Please refresh to try again.
        </SurfaceCard>
      ) : null}
      {result.status === "ok" ? (
        <StudentSelfProfileCard profile={result.profile} />
      ) : null}
    </main>
  );
}
