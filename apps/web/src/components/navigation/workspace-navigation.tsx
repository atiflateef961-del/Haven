"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NavigationGroup, NavigationItem } from "@/components/navigation";

type WorkspaceIconName = "overview" | "organizations" | "hostels" | "rooms" | "students" | "visitors" | "complaints" | "maintenance" | "mess" | "staff" | "bookings" | "invoices" | "profile" | "notifications";

const iconPaths: Record<WorkspaceIconName, string> = {
  overview: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z",
  organizations: "M3 21V7l6-3v17 M9 21V3l7 4v14 M16 21V10l5-3v14 M5 10h1 M5 14h1 M12 8h1 M12 12h1 M18 13h1 M18 17h1",
  hostels: "M3 21V7l9-5 9 5v14 M8 21v-7h8v7 M3 10h18",
  rooms: "M5 21V3h13v18 M9 21v-7h9 M14 11h.01 M18 7h3a2 2 0 0 1 0 4h-3 M20 11v2",
  students: "m2 9 10-5 10 5-10 5L2 9z M6 11v5c3 3 9 3 12 0v-5 M22 9v6",
  visitors: "M7 4h10a2 2 0 0 1 2 2v16H5V6a2 2 0 0 1 2-2z M9 4V2h6v2 M9 10h6 M9 14h3 M15 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M13 20c0-1.7.9-2.5 2-2.5s2 .8 2 2.5",
  complaints: "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z M12 8v4 M12 16h.01",
  maintenance: "M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3z",
  mess: "M4 3v7a3 3 0 0 0 6 0V3 M7 3v18 M18 3c-2 2-3 5-3 8h3v10 M18 3v8",
  staff: "M5 3h14v18H5z M9 3v3h6V3 M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M8 19c.4-2.1 1.7-3 4-3 M16 10l-1 2 1 4 1-4z",
  bookings: "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M8 15l2 2 5-5",
  invoices: "M5 3l2 2 2-2 3 2 3-2 2 2 2-2v18l-2-2-2 2-3-2-3 2-2-2-2 2z M9 10h6 M9 14h6 M9 18h4",
  profile: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M6.5 18c.7-2.3 2.5-3.5 5.5-3.5s4.8 1.2 5.5 3.5",
  notifications: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
};

function WorkspaceIcon({ name }: { name: WorkspaceIconName }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={iconPaths[name]} />
    </svg>
  );
}

export function WorkspaceNavigation({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const previousPathname = useRef(pathname);
  const [hash, setHash] = useState("");

  useEffect(() => {
    if (pathname === "/dashboard" && previousPathname.current !== "/dashboard") {
      router.refresh();
    }
    previousPathname.current = pathname;
  }, [pathname, router]);

  useEffect(() => {
    if (pathname !== "/dashboard") return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const refreshAfterHistoryRestore = (event: PageTransitionEvent) => {
      if (event.persisted) router.refresh();
    };

    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("pageshow", refreshAfterHistoryRestore);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("pageshow", refreshAfterHistoryRestore);
    };
  }, [pathname, router]);

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  return (
    <NavigationGroup label="Workspace navigation" className="protected-sidebar__navigation" onClick={() => onNavigate?.()}>
      <NavigationItem href="/dashboard" current={pathname === "/dashboard" && !hash} icon={<WorkspaceIcon name="overview" />}>Overview</NavigationItem>
      <NavigationItem href="/dashboard#organizations" current={pathname === "/dashboard" && hash === "#organizations"} icon={<WorkspaceIcon name="organizations" />}>Organizations</NavigationItem>
      <NavigationItem href="/hostels" current={pathname.startsWith("/hostels")} icon={<WorkspaceIcon name="hostels" />}>Hostels</NavigationItem>
      <NavigationItem href="/room-availability" current={pathname.startsWith("/room-availability")} icon={<WorkspaceIcon name="rooms" />}>Room availability</NavigationItem>
      <NavigationItem href="/students" current={pathname.startsWith("/students")} icon={<WorkspaceIcon name="students" />}>Students</NavigationItem>
      <NavigationItem href="/visitors" current={pathname.startsWith("/visitors")} icon={<WorkspaceIcon name="visitors" />}>Visitor log</NavigationItem>
      <NavigationItem href="/complaints" current={pathname.startsWith("/complaints")} icon={<WorkspaceIcon name="complaints" />}>Complaints</NavigationItem>
      <NavigationItem href="/maintenance" current={pathname.startsWith("/maintenance")} icon={<WorkspaceIcon name="maintenance" />}>Maintenance</NavigationItem>
      <NavigationItem href="/mess" current={pathname.startsWith("/mess")} icon={<WorkspaceIcon name="mess" />}>Mess and menus</NavigationItem>
      <NavigationItem href="/staff" current={pathname.startsWith("/staff")} icon={<WorkspaceIcon name="staff" />}>Staff</NavigationItem>
      <NavigationItem href="/bookings" current={pathname.startsWith("/bookings")} icon={<WorkspaceIcon name="bookings" />}>Bookings</NavigationItem>
      <NavigationItem href="/invoices" current={pathname.startsWith("/invoices")} icon={<WorkspaceIcon name="invoices" />}>Invoices</NavigationItem>
      <NavigationItem href="/my-profile" current={pathname === "/my-profile"} icon={<WorkspaceIcon name="profile" />}>My student profile</NavigationItem>
      <NavigationItem href="/dashboard#dashboard-notifications" current={pathname === "/dashboard" && hash === "#dashboard-notifications"} icon={<WorkspaceIcon name="notifications" />}>Notifications</NavigationItem>
    </NavigationGroup>
  );
}
