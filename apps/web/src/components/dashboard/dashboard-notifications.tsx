"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiBaseUrl } from "@/lib/api-url.mjs";
import type { DashboardEmailFailure, DashboardNotification } from "@/lib/dashboard-summary";
import { demoNotifications } from "@/lib/demo-data";

type PendingAction = { id: string; kind: "mark-read" | "retry-email" };

export function DashboardNotifications({ notifications, emailFailures }: { notifications: DashboardNotification[]; emailFailures: DashboardEmailFailure[] }) {
  const router = useRouter();
  const [items, setItems] = useState(notifications);
  const [failures, setFailures] = useState(emailFailures);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function markRead(id: string) {
    if (pendingAction) return;
    setPendingAction({ id, kind: "mark-read" });
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/notifications/${encodeURIComponent(id)}/read`, {
        method: "PATCH", credentials: "include", cache: "no-store",
      });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (!response.ok) {
        setError("This notification could not be marked as read. Refresh and try again.");
        return;
      }
      const result: unknown = await response.json();
      if (typeof result !== "object" || result === null || typeof (result as { readAt?: unknown }).readAt !== "string") {
        setError("The notification update could not be verified. Refresh and try again.");
        return;
      }
      const readAt = (result as { readAt: string }).readAt;
      setItems((current) => current.map((item) => item.id === id ? { ...item, readAt } : item));
    } catch {
      setError("The notification service is unavailable. Please try again.");
    } finally {
      setPendingAction(null);
    }
  }

  async function retryEmail(id: string) {
    if (pendingAction) return;
    setPendingAction({ id, kind: "retry-email" });
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/notifications/${encodeURIComponent(id)}/email`, {
        method: "POST", credentials: "include", cache: "no-store",
      });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (!response.ok) {
        setError("Email retry failed. Refresh the page and try again.");
        return;
      }
      const result: unknown = await response.json();
      if (typeof result !== "object" || result === null || (result as { emailStatus?: unknown }).emailStatus !== "SENT") {
        setError("The email provider did not accept this message. The failure was recorded for follow-up.");
        return;
      }
      setFailures((current) => current.filter((item) => item.id !== id));
    } catch {
      setError("The email service is unavailable. Please try again.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      {error ? <p role="alert">{error}</p> : null}
      {items.length === 0 ? <p className="dashboard-activity__empty">You have no recent notifications.</p> : (
        <ul className="dashboard-notifications__list">
          {items.map((notification) => {
            const markingRead = pendingAction?.id === notification.id && pendingAction.kind === "mark-read";
            const isDemoNotification = demoNotifications.some((demoNotification) => demoNotification.id === notification.id);
            return <li key={notification.id}>
              <div>
                <strong>{notification.title}</strong>
                <p>{notification.body}</p>
              </div>
              <span className={`dashboard-notification-status pill ${notification.status === "PENDING" ? "pill--warn" : "pill--neutral"} dashboard-notification-status--${notification.status.toLowerCase()}`}>
                {notification.readAt ? "Read" : "Unread"}
              </span>
              <span className="dashboard-notification-email-status">
                {notification.emailStatus === "SENT" ? "Email sent" : notification.emailStatus === "FAILED" ? "Email failed" : "No email sent"}
              </span>
              {!isDemoNotification && !notification.readAt ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pendingAction !== null && !markingRead}
                  loading={markingRead}
                  loadingLabel="Marking read"
                  onClick={() => markRead(notification.id)}
                >
                  Mark read
                </Button>
              ) : null}
              <time dateTime={notification.createdAt}>
                {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(notification.createdAt))}
              </time>
            </li>;
          })}
        </ul>
      )}
      {failures.length > 0 ? (
        <section aria-labelledby="email-delivery-failures-title" className="dashboard-notifications__failures">
          <h3 id="email-delivery-failures-title">Email delivery failures</h3>
          <ul>
            {failures.map((failure) => (
              <li key={failure.id}>
                <div><strong>{failure.title}</strong><p>{failure.email} â€” {failure.emailError ?? "Delivery failed"}</p></div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pendingAction !== null && !(pendingAction.id === failure.id && pendingAction.kind === "retry-email")}
                  loading={pendingAction?.id === failure.id && pendingAction.kind === "retry-email"}
                  loadingLabel="Retrying email"
                  onClick={() => retryEmail(failure.id)}
                >
                  Retry email
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
