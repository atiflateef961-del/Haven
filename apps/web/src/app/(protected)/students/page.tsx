import Link from "next/link";
import { SurfaceCard } from "@/components/ui/surface-card";
import { PageHeading } from "@/components/ui/page-heading";
import { getStudents } from "@/lib/students";
import { StudentCreateForm } from "@/components/students/student-create-form";
import { StudentDirectoryCard } from "@/components/students/student-directory-card";
import { DEMO_MODE, demoStudents } from "@/lib/demo-data";

type StudentsPageProps = { searchParams: Promise<{ page?: string }> };

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const query = await searchParams;
  const requestedPage = Number(query.page ?? "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 1_000_000
    ? requestedPage
    : 1;
  const apiResult = await getStudents(page);
  const demoPageStart = (page - 1) * 25;
  const result = DEMO_MODE && apiResult.status === "ok" && apiResult.students.length === 0
    ? { ...apiResult, students: demoStudents.slice(demoPageStart, demoPageStart + 25), page, pageSize: 25, hasMore: demoPageStart + 25 < demoStudents.length }
    : apiResult;
  const isDemoPage = result.status === "ok" && result.students.some((student) => demoStudents.some((demoStudent) => demoStudent.id === student.id));

  return (
    <main className="page-content student-directory-page" data-demo-data={isDemoPage ? "true" : undefined}>
      <PageHeading eyebrow="STUDENT MANAGEMENT" title="Students" subtitle="Student profiles in your assigned organizations." />

      {result.status === "ok" && result.creatableOrganizations.length > 0 ? (
        <SurfaceCard as="section" className="student-create-panel" padding="md" aria-labelledby="student-create-title">
          <h2 id="student-create-title">Add a student</h2>
          <StudentCreateForm organizations={result.creatableOrganizations} />
        </SurfaceCard>
      ) : null}

      {result.status === "forbidden" ? (
        <SurfaceCard className="dashboard-message" padding="md" role="status">
          Your account does not have access to the student directory. Contact your organization administrator.
        </SurfaceCard>
      ) : null}
      {result.status === "unavailable" ? (
        <SurfaceCard className="dashboard-message" padding="md" role="alert">
          Student information is temporarily unavailable. Please refresh to try again.
        </SurfaceCard>
      ) : null}
      {result.status === "ok" && result.students.length === 0 ? (
        <SurfaceCard className="dashboard-message" padding="md" role="status">
          {page === 1 ? "No active student profiles are available." : "There are no students on this page."}
        </SurfaceCard>
      ) : null}
      {result.status === "ok" && result.students.length > 0 ? (
        <>
          <ul className="student-directory-grid" aria-label="Student profiles">
            {result.students.map((student) => (
              <li key={student.id}>
                <StudentDirectoryCard student={student} />
              </li>
            ))}
          </ul>
          <nav className="student-directory-pagination" aria-label="Student pages">
            {page > 1 ? <Link href={`/students?page=${page - 1}`}>Previous page</Link> : <span />}
            <span aria-live="polite">Page {result.page}</span>
            {result.hasMore ? <Link href={`/students?page=${page + 1}`}>Next page</Link> : <span />}
          </nav>
        </>
      ) : null}
    </main>
  );
}
