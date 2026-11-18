"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { WorkspaceNavigation } from "@/components/navigation/workspace-navigation";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { DEMO_MODE } from "@/lib/demo-data";

function getAccountPresentation(account: { firstName: string; lastName: string }) {
  const firstName = account.firstName.trim();
  const lastName = account.lastName.trim();
  const distinctLastName = lastName && lastName.toLowerCase() !== firstName.toLowerCase()
    ? lastName
    : "";
  const names = [firstName, distinctLastName].filter(Boolean);

  return {
    name: names.join(" "),
    initials: names.map((name) => name.charAt(0).toUpperCase()).join("").slice(0, 2),
  };
}

export function ProtectedWorkspaceShell({
  children,
  accountAction,
  account,
}: {
  children: ReactNode;
  accountAction: ReactNode;
  account: { firstName: string; lastName: string };
}) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [demoDataActive, setDemoDataActive] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const accountPresentation = getAccountPresentation(account);

  useEffect(() => {
    if (!DEMO_MODE) return;
    const refreshDemoStatus = () => setDemoDataActive(Boolean(document.querySelector("[data-demo-data='true']")));
    const observer = new MutationObserver(refreshDemoStatus);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-demo-data"] });
    const frame = window.requestAnimationFrame(refreshDemoStatus);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!navigationOpen) return;

    navigationRef.current?.querySelector<HTMLAnchorElement>("a[href]")?.focus({ preventScroll: true });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setNavigationOpen(false);
      menuButtonRef.current?.focus();
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [navigationOpen]);

  const closeNavigation = () => {
    setNavigationOpen(false);
    if (navigationOpen) menuButtonRef.current?.focus();
  };

  return (
    <div className="protected-shell">
      <aside
        className={`protected-sidebar${navigationOpen ? " protected-sidebar--open" : ""}`}
        id="workspace-navigation"
        ref={navigationRef}
        aria-label="Workspace menu"
      >
        <Link className="protected-brand" href="/dashboard" onClick={closeNavigation}>Haven <span>Management</span></Link>
        <p className="protected-sidebar__label">WORKSPACE</p>
        <WorkspaceNavigation onNavigate={closeNavigation} />
      </aside>
      {navigationOpen ? (
        <button className="protected-scrim" type="button" aria-label="Close navigation" onClick={closeNavigation} />
      ) : null}
      <div className="protected-main">
        <header className="protected-header">
          <button
            ref={menuButtonRef}
            className="protected-menu-button"
            type="button"
            aria-label={navigationOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={navigationOpen}
            aria-controls="workspace-navigation"
            onClick={() => setNavigationOpen((open) => !open)}
          >
            <span /><span /><span />
          </button>
          <span className="protected-header__title">Workspace</span>
          {demoDataActive ? <span className="demo-data-badge">Demo data</span> : null}
          <div className="protected-theme-control"><ThemeToggle /></div>
          <div className="protected-account">
            <div className="protected-account__identity">
              <span className="protected-account__avatar" aria-hidden="true">{accountPresentation.initials}</span>
              <span className="protected-account__name">{accountPresentation.name}</span>
            </div>
            {accountAction}
          </div>
        </header>
        <div className="protected-content">{children}</div>
      </div>
    </div>
  );
}
