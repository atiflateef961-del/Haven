export type StatIconName =
  | "hostel" | "building" | "room" | "bed" | "occupied-bed" | "available-bed"
  | "graduation-cap" | "wallet" | "organization"
  | "complaint-total" | "complaint-open" | "complaint-progress" | "complaint-resolved"
  | "maintenance-total" | "maintenance-open" | "maintenance-assigned" | "maintenance-complete"
  | "meal-schedule" | "meal-days" | "meal-attendance" | "meal-rate"
  | "invoice-total" | "invoice-collected" | "invoice-due" | "invoice-overdue";

const iconPaths: Record<StatIconName, string> = {
  hostel: "M3 11 12 4l9 7 M5 10v10h14V10 M9 20v-6h6v6",
  building: "M5 21V3h14v18 M8 7h2v2H8z M14 7h2v2h-2z M8 12h2v2H8z M14 12h2v2h-2z M10 21v-4h4v4",
  room: "M6 21V3h12v18 M10 21V7h8 M15 14h.01",
  bed: "M3 19v-9 M3 15h18v4 M6 15v-4h5a3 3 0 0 1 3 3 M14 15h7v-3a2 2 0 0 0-2-2h-5 M3 19v2 M21 19v2",
  "occupied-bed": "M3 19v-9 M3 15h18v4 M6 15v-4h5a3 3 0 0 1 3 3 M14 15h7v-3a2 2 0 0 0-2-2h-5 M17 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M15 8l2-2 2 2",
  "available-bed": "M3 19v-9 M3 15h18v4 M6 15v-4h5a3 3 0 0 1 3 3 M14 15h7v-3a2 2 0 0 0-2-2h-5 M19 2v6 M16 5h6",
  "graduation-cap": "m2 9 10-5 10 5-10 5L2 9z M6 11v5c3 3 9 3 12 0v-5 M22 9v6",
  wallet: "M4 6h15a2 2 0 0 1 2 2v12H5a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h13 M16 12h5v4h-5a2 2 0 0 1 0-4z M17 14h.01",
  organization: "M3 21V9l5-3 5 3v12 M13 21V5l4-2 4 2v16 M6 12h1 M9 12h1 M6 16h1 M9 16h1 M16 8h2 M16 12h2 M16 16h2 M8 21v-3h3",
  "complaint-total": "M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 0 1 12.5 3H13a8.5 8.5 0 0 1 8 8.5z M12 8v4 M12 16h.01",
  "complaint-open": "M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 0 1 12.5 3H13a8.5 8.5 0 0 1 8 8.5z M12 7v5l3 2",
  "complaint-progress": "M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 0 1 12.5 3H13a8.5 8.5 0 0 1 8 8.5z M8 12h8 M12 8v8",
  "complaint-resolved": "M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 0 1 12.5 3H13a8.5 8.5 0 0 1 8 8.5z M8.5 12l2.2 2.2 4.8-5",
  "maintenance-total": "M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3z M19 4v4 M17 6h4",
  "maintenance-open": "M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3z M20 3v5 M20 11h.01",
  "maintenance-assigned": "M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3z M19 3v5 M16.5 5.5h5",
  "maintenance-complete": "M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3z M17 4l2 2 4-4",
  "meal-schedule": "M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16 M8 14h3 M8 17h5",
  "meal-days": "M3 5h18v16H3z M7 3v4 M17 3v4 M3 10h18 M7 14h2 M12 14h2 M17 14h.01 M7 18h2 M12 18h2",
  "meal-attendance": "M4 5h12v16H4z M8 3v4 M12 3v4 M7 11h6 M7 15l2 2 4-4 M19 8v12 M17 10h4",
  "meal-rate": "M3 20h18 M5 16l5-5 4 3 6-8 M16 6h4v4",
  "invoice-total": "M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6 M9 16h3",
  "invoice-collected": "M4 6h15a2 2 0 0 1 2 2v12H5a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h13 M16 12h5v4h-5a2 2 0 0 1 0-4z M17 14h.01",
  "invoice-due": "M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16 M12 13v3l2 1",
  "invoice-overdue": "M6 3h12v18l-3-2-3 2-3-2-3 2z M12 8v4 M12 16h.01 M9 14h6",
};

export function StatIcon({ name }: { name: StatIconName }) {
  return (
    <span className="stat-icon-tile" data-icon={name} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d={iconPaths[name]} />
      </svg>
    </span>
  );
}
