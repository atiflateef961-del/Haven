import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SurfaceCard } from "@/components/ui/surface-card";

const features = [
  ["Workspace overview", "Dashboard metrics, occupancy, recent activity and notifications."],
  ["Hostels", "Manage hostel details and workspace setup."],
  ["Room availability", "Review rooms, occupancy and available beds."],
  ["Students", "Manage resident records and student profiles."],
  ["Bookings", "Review and manage hostel bookings."],
  ["Invoices", "Track resident invoices and payments."],
  ["Staff", "Manage hostel staff records."],
  ["Visitor log", "Review visitor entries."],
  ["Complaints", "Track and respond to resident complaints."],
  ["Maintenance", "Manage maintenance requests."],
  ["Mess and menus", "Review meal schedules and menus."],
  ["Notifications", "View workspace notifications."],
  ["My profile", "View your account profile."],
] as const;

export default async function Home() {
  const session = (await cookies()).get("hms_session")?.value;
  if (session) redirect("/dashboard");

  return (
    <main className="public-home">
      <header className="public-home__header">
        <Link className="auth-brand" href="/">
          <span className="auth-brand__mark" aria-hidden="true">H</span>
          <span>Haven <span className="auth-brand__muted">Management</span></span>
        </Link>
        <nav className="public-home__actions" aria-label="Account">
          <Link className="ui-button ui-button--secondary ui-button--sm" href="/login">Sign in</Link>
          <Link className="ui-button ui-button--primary ui-button--sm" href="/register">Create account</Link>
        </nav>
      </header>

      <section className="public-home__intro" aria-labelledby="home-title">
        <p className="auth-eyebrow">HOSTEL WORKSPACE</p>
        <h1 id="home-title">Your hostel, all in one place.</h1>
        <p>Explore the modules available in Haven Management. Create an account or sign in to open your organization’s workspace and its real data.</p>
      </section>

      <section className="public-home__features" aria-label="Available features">
        {features.map(([title, description]) => (
          <SurfaceCard as="article" className="public-home__feature" padding="md" key={title}>
            <h2>{title}</h2>
            <p>{description}</p>
          </SurfaceCard>
        ))}
      </section>

      <p className="public-home__privacy">Hostel records and workspace actions are available after you sign in.</p>
    </main>
  );
}
