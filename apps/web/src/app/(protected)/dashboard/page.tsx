import { SurfaceCard } from "@/components/ui/surface-card";
import Link from "next/link";
import { DashboardNotifications } from "@/components/dashboard/dashboard-notifications";
import { AnimatedMetricValue } from "@/components/dashboard/animated-metric-value";
import { OccupancyRing } from "@/components/dashboard/occupancy-ring";
import {
  getDashboardNotifications,
  getDashboardSummary,
  type DashboardEmailFailure,
  type DashboardNotification,
  type OrganizationSummary,
} from "@/lib/dashboard-summary";
import { formatMoney } from "@/lib/money.mjs";
import { DEMO_MODE, demoMetricTrends, demoMonthlyCollections, demoNotifications, demoOrganizationSummary } from "@/lib/demo-data";
import { RevenueTrendCanvas } from "@/components/dashboard/revenue-trend-canvas";
import { StatIcon, type StatIconName } from "@/components/ui/stat-icon";

type DashboardMetric = {
  key: string;
  label: string;
  icon: StatIconName;
  value: number;
  href: string;
  detail?: string;
  trend?: number[];
  goodWhen?: "up" | "down";
  money?: boolean;
};

function MetricSparkline({ values, label, goodWhen = "up" }: { values: number[]; label: string; goodWhen?: "up" | "down" }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${28 - ((value - min) / range) * 24}`).join(" ");
  const change = Math.round(((values.at(-1)! - values[0]) / Math.max(values[0], 1)) * 100);
  const tone = change === 0 ? "neutral" : (change > 0) === (goodWhen === "up") ? "up" : "down";
  return <div className="dashboard-stat__trend-row">
    <svg className="dashboard-stat__sparkline" viewBox="0 0 100 32" role="img" aria-label={`${label} trend over six months`}>
      <polyline points={points} />
    </svg>
    <span className={`dashboard-stat__trend pill pill--${tone}`}>{change >= 0 ? "+" : ""}{change}%</span>
  </div>;
}

function formatDate(value: string, withTime = false) {
  return new Intl.DateTimeFormat(undefined, withTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(new Date(value));
}

function DashboardNotificationsPanel({
  notifications,
  emailFailures,
  unavailable,
}: {
  notifications: DashboardNotification[];
  emailFailures: DashboardEmailFailure[];
  unavailable: boolean;
}) {
  return (
    <SurfaceCard as="section" id="dashboard-notifications" className="dashboard-panel dashboard-notifications" padding="lg">
      <div className="dashboard-panel__heading">
        <div>
          <p className="dashboard-panel__eyebrow">NEEDS YOUR ATTENTION</p>
          <h2>Notifications</h2>
        </div>
      </div>
      {unavailable ? (
        <p className="dashboard-panel__empty" role="alert">Notifications are temporarily unavailable. Please refresh to try again.</p>
      ) : (
        <DashboardNotifications notifications={notifications} emailFailures={emailFailures} />
      )}
    </SurfaceCard>
  );
}

function OrganizationDashboard({
  organizations,
  notifications,
  emailFailures,
  notificationsUnavailable,
}: {
  organizations: OrganizationSummary[];
  notifications: DashboardNotification[];
  emailFailures: DashboardEmailFailure[];
  notificationsUnavailable: boolean;
}) {
  const totals = organizations.reduce(
    (result, organization) => ({
      hostels: result.hostels + organization.hostels,
      buildings: result.buildings + organization.buildings,
      rooms: result.rooms + organization.rooms,
      beds: result.beds + organization.beds,
      occupiedBeds: result.occupiedBeds + organization.occupiedBeds,
      availableBeds: result.availableBeds + organization.availableBeds,
      students: result.students + organization.students,
    }),
    { hostels: 0, buildings: 0, rooms: 0, beds: 0, occupiedBeds: 0, availableBeds: 0, students: 0 },
  );
  const occupancyRate = totals.beds === 0
    ? null
    : Math.round((totals.occupiedBeds / totals.beds) * 1000) / 10;
  const isDemo = organizations.some((organization) => organization.organizationId === demoOrganizationSummary.organizationId);
  const metrics: DashboardMetric[] = isDemo ? [
    { key: "hostels", label: "Hostels", icon: "hostel", value: totals.hostels, href: "/hostels", trend: demoMetricTrends.hostels, goodWhen: "up" },
    { key: "buildings", label: "Buildings", icon: "building", value: totals.buildings, href: "/hostels", trend: demoMetricTrends.buildings, goodWhen: "up" },
    { key: "rooms", label: "Rooms", icon: "room", value: totals.rooms, href: "/room-availability", trend: demoMetricTrends.rooms, goodWhen: "up" },
    { key: "beds", label: "Active beds", icon: "bed", value: totals.beds, href: "/room-availability", trend: demoMetricTrends.beds, goodWhen: "up" },
    { key: "occupiedBeds", label: "Occupied beds", icon: "occupied-bed", value: totals.occupiedBeds, href: "/room-availability", trend: demoMetricTrends.occupiedBeds, goodWhen: "down" },
    { key: "availableBeds", label: "Available beds", icon: "available-bed", value: totals.availableBeds, href: "/room-availability", trend: demoMetricTrends.availableBeds, goodWhen: "up" },
    { key: "students", label: "Students", icon: "graduation-cap", value: totals.students, href: "/students", trend: demoMetricTrends.students, goodWhen: "up" },
    { key: "revenue", label: "Monthly collections", icon: "wallet", value: Number(organizations[0]?.collectedLast30Days ?? 0), href: "/invoices", trend: demoMetricTrends.revenue, goodWhen: "up", money: true },
  ] : [
    { key: "organizations", label: "Organizations", icon: "organization", value: organizations.length, href: "/dashboard#organizations" },
    { key: "hostels", label: "Hostels", icon: "hostel", value: totals.hostels, href: "/hostels" },
    { key: "buildings", label: "Buildings", icon: "building", value: totals.buildings, href: "/hostels" },
    { key: "rooms", label: "Rooms", icon: "room", value: totals.rooms, href: "/room-availability" },
    { key: "beds", label: "Active beds", icon: "bed", value: totals.beds, href: "/room-availability" },
    { key: "availableBeds", label: "Available beds", icon: "available-bed", value: totals.availableBeds, href: "/room-availability" },
    { key: "occupied", label: "Occupied beds", icon: "occupied-bed", value: totals.occupiedBeds, href: "/room-availability" },
    { key: "students", label: "Students", icon: "graduation-cap", value: totals.students, href: "/students" },
  ];
  const hostels = organizations.flatMap((organization) =>
    organization.hostelOccupancy.map((hostel) => ({
      ...hostel,
      organizationName: organization.organizationName,
    })),
  );
  const activity = organizations
    .flatMap((organization) => (organization.recentActivity ?? []).map((item) => ({
      ...item,
      organizationName: organization.organizationName,
    })))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, isDemo ? 6 : 5);
  const activityUnavailableForRole = organizations.some((organization) => organization.recentActivity === null);
  const registrations = organizations
    .flatMap((organization) => organization.recentRegistrations.map((student) => ({
      ...student,
      organizationName: organization.organizationName,
    })))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 5);
  const collections = organizations.filter((organization) => organization.collectedLast30Days !== null);

  return (
    <>
      <div id="organizations" className="dashboard-stats" role="list" aria-label="Workspace summary">
        {metrics.map((metric) => (
          <SurfaceCard as="div" role="listitem" className="dashboard-stat" padding="md" key={metric.key}>
            <Link className="dashboard-stat__link" href={metric.href} aria-label={`View ${metric.label.toLowerCase()} records`}>
              <span className="dashboard-stat__icon-slot"><StatIcon name={metric.icon} /></span>
              <span className="dashboard-stat__label">{metric.label}</span>
              <strong className="dashboard-stat__value">{metric.money ? <>PKR <AnimatedMetricValue value={metric.value} /></> : <AnimatedMetricValue value={metric.value} />}</strong>
              {metric.trend ? <MetricSparkline values={metric.trend} label={metric.label} goodWhen={metric.goodWhen} /> : null}
              {metric.detail ? <span className="dashboard-stat__detail">{metric.detail}</span> : null}
            </Link>
          </SurfaceCard>
        ))}
      </div>

      <div className="dashboard-overview-grid">
        <SurfaceCard className="dashboard-panel dashboard-occupancy-panel" padding="lg">
          <div className="dashboard-panel__heading">
            <div>
              <p className="dashboard-panel__eyebrow">CURRENT SNAPSHOT</p>
              <h2>Bed occupancy</h2>
            </div>
            <span className="dashboard-period">Live</span>
          </div>
          <div className="dashboard-occupancy-summary">
            <OccupancyRing value={occupancyRate} />
            <dl className="dashboard-occupancy-totals">
              <div>
                <dt><span className="dashboard-legend-dot dashboard-legend-dot--occupied" />Occupied beds</dt>
                <dd>{totals.occupiedBeds.toLocaleString()}</dd>
              </div>
              <div>
                <dt><span className="dashboard-legend-dot" />Available beds</dt>
                <dd>{totals.availableBeds.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Total active capacity</dt>
                <dd>{totals.beds.toLocaleString()}</dd>
              </div>
            </dl>
          </div>
          {occupancyRate === null ? <p className="dashboard-panel__empty">No active bed capacity is available in your dashboard scope.</p> : null}
        </SurfaceCard>

        <SurfaceCard className="dashboard-panel dashboard-hostel-panel" padding="lg">
          <div className="dashboard-panel__heading">
            <div>
              <p className="dashboard-panel__eyebrow">CAPACITY BY PROPERTY</p>
              <h2>Hostel performance</h2>
            </div>
            <span className="dashboard-period">{hostels.length} hostels</span>
          </div>
          {hostels.length === 0 ? (
            <p className="dashboard-panel__empty">No hostels are available in this dashboard scope.</p>
          ) : (
            <div className="dashboard-hostel-table-wrap">
              <table className="dashboard-hostel-table">
                <thead>
                  <tr>
                    <th scope="col">Hostel</th>
                    <th scope="col">Occupied</th>
                    <th scope="col">Occupancy</th>
                  </tr>
                </thead>
                <tbody>
                  {hostels.map((hostel) => (
                    <tr key={hostel.hostelId}>
                      <td>
                        <strong><Link href={`/hostels/${encodeURIComponent(hostel.hostelId)}/buildings`}>{hostel.hostelName}</Link></strong>
                        {organizations.length > 1 ? <small>{hostel.organizationName}</small> : null}
                      </td>
                      <td>{hostel.occupiedBeds.toLocaleString()} / {hostel.beds.toLocaleString()}</td>
                      <td>
                        <div className="dashboard-hostel-table__occupancy">
                          <span>{hostel.occupancyRate === null ? "N/A" : `${Math.round(hostel.occupancyRate)}%`}</span>
                          {hostel.beds > 0 ? (
                            <span className="dashboard-hostel-table__track" aria-hidden="true">
                              <span style={{ width: `${hostel.occupancyRate ?? 0}%` }} />
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SurfaceCard>
      </div>

      {isDemo ? <RevenueTrendCanvas points={demoMonthlyCollections} /> : null}

      {collections.length > 0 ? (
        <SurfaceCard className="dashboard-panel dashboard-collections" padding="md">
          <div className="dashboard-panel__heading">
            <div>
              <p className="dashboard-panel__eyebrow">FINANCE</p>
              <h2>Verified collections <span>Last 30 days</span></h2>
            </div>
          </div>
          <ul className="dashboard-collections__list">
            {collections.map((organization) => (
              <li key={organization.organizationId}>
                <span>{organization.organizationName}</span>
                <strong>{formatMoney(organization.collectedLast30Days ?? 0, organization.currency)}</strong>
              </li>
            ))}
          </ul>
        </SurfaceCard>
      ) : null}

      <div className="dashboard-feed-grid">
        <SurfaceCard className="dashboard-panel dashboard-activity-panel" padding="lg">
          <div className="dashboard-panel__heading">
            <div>
              <p className="dashboard-panel__eyebrow">LATEST UPDATES</p>
              <h2>Recent activity</h2>
            </div>
            <span className="dashboard-period">Last 5</span>
          </div>
          {activity.length === 0 ? (
            <p className="dashboard-panel__empty">
              {activityUnavailableForRole
                ? "Activity is not available for this role scope."
                : "No recent organization activity has been recorded."}
            </p>
          ) : (
            <ul className="dashboard-feed-list">
              {activity.map((item) => (
                <li key={item.id}>
                  <span className="dashboard-feed-list__marker" aria-hidden="true" />
                  <div className="dashboard-feed-list__content">
                    <strong>{item.action}</strong>
                    <span>{item.resourceType}{organizations.length > 1 ? ` · ${item.organizationName}` : ""}</span>
                  </div>
                  <time dateTime={item.createdAt}>{formatDate(item.createdAt, true)}</time>
                </li>
              ))}
            </ul>
          )}
          {registrations.length > 0 ? (
            <section className="dashboard-registrations" aria-labelledby="dashboard-registrations-title">
              <h3 id="dashboard-registrations-title">Recent registrations</h3>
              <ul className="dashboard-feed-list dashboard-feed-list--registrations">
                {registrations.map((student) => (
                  <li key={student.id}>
                    <span className="dashboard-feed-list__avatar" aria-hidden="true">
                      {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                    </span>
                    <div className="dashboard-feed-list__content">
                      <strong>{student.firstName} {student.lastName}</strong>
                      <span>{student.organizationName}</span>
                    </div>
                    <time dateTime={student.createdAt}>{formatDate(student.createdAt)}</time>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </SurfaceCard>

        <DashboardNotificationsPanel
          notifications={notifications}
          emailFailures={emailFailures}
          unavailable={notificationsUnavailable}
        />
      </div>
    </>
  );
}

export default async function DashboardPage() {
  const [apiResult, apiNotificationsResult] = await Promise.all([
    getDashboardSummary(),
    getDashboardNotifications(),
  ]);
  const result = DEMO_MODE && apiResult.status === "ok"
    ? {
        ...apiResult,
        organizations: apiResult.organizations.length === 0
          ? [demoOrganizationSummary]
          : apiResult.organizations.length === 1
            ? (() => {
                const organization = apiResult.organizations[0];
                const hasLiveHostels = organization.hostels > 0;
                const hasLiveStudents = organization.students > 0;
                const base = hasLiveHostels ? organization : {
                  ...demoOrganizationSummary,
                  organizationName: organization.organizationName,
                  currency: organization.currency,
                  collectedLast30Days: organization.collectedLast30Days ?? demoOrganizationSummary.collectedLast30Days,
                  recentActivity: organization.recentActivity ?? demoOrganizationSummary.recentActivity,
                };
                return [{
                  ...base,
                  students: hasLiveStudents ? organization.students : demoOrganizationSummary.students,
                  recentRegistrations: hasLiveStudents ? organization.recentRegistrations : demoOrganizationSummary.recentRegistrations,
                }];
              })()
            : apiResult.organizations,
      }
    : apiResult;
  const notificationsResult = DEMO_MODE && apiNotificationsResult.status === "ok" && apiNotificationsResult.notifications.length === 0
    ? { ...apiNotificationsResult, notifications: demoNotifications }
    : apiNotificationsResult;
  const organizations = result.status === "ok" ? result.organizations : [];
  const isDemoPage = organizations.some((organization) => organization.organizationId === demoOrganizationSummary.organizationId);

  return (
    <main className="page-content dashboard-page" data-demo-data={isDemoPage ? "true" : undefined}>
      <header className="page-heading">
        <p className="auth-eyebrow">YOUR WORKSPACE</p>
        <h1>Overview</h1>
        <p className="dashboard-intro">A live view of your hostels, students, and operations across your assigned organizations.</p>
      </header>

      {result.status === "forbidden" ? (
        <SurfaceCard className="dashboard-message" padding="md" role="status">
          Your account does not have a dashboard role assigned. Contact your organization administrator.
        </SurfaceCard>
      ) : null}
      {result.status === "unavailable" ? (
        <SurfaceCard className="dashboard-message" padding="md" role="alert">
          Dashboard information is temporarily unavailable. Please refresh to try again.
        </SurfaceCard>
      ) : null}
      {result.status === "ok" && organizations.length === 0 ? (
        <SurfaceCard className="dashboard-message" padding="md" role="status">
          No active organization data is available in your assigned dashboard scope.
        </SurfaceCard>
      ) : null}
      {result.status === "ok" && organizations.length > 0
        ? (
          <OrganizationDashboard
            organizations={organizations}
            notifications={notificationsResult.status === "ok" ? notificationsResult.notifications : []}
            emailFailures={notificationsResult.status === "ok" ? notificationsResult.emailFailures : []}
            notificationsUnavailable={notificationsResult.status === "unavailable"}
          />
        )
        : null}
      {result.status !== "ok" || organizations.length === 0 ? (
        <DashboardNotificationsPanel
          notifications={notificationsResult.status === "ok" ? notificationsResult.notifications : []}
          emailFailures={notificationsResult.status === "ok" ? notificationsResult.emailFailures : []}
          unavailable={notificationsResult.status === "unavailable"}
        />
      ) : null}
    </main>
  );
}
