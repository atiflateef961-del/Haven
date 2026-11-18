"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiBaseUrl } from "@/lib/api-url.mjs";

function isLogoutResponse(value: unknown): value is { status: "ok" } {
  if (typeof value !== "object" || value === null) return false;
  return (value as Record<string, unknown>).status === "ok";
}

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        // The same-origin proxy expires the frontend session cookie even if the API
        // cannot confirm server-side revocation; don't leave the signed-in UI open.
        window.location.replace("/login");
        return;
      }
      let result: unknown;
      try {
        result = await response.json();
      } catch {
        setError("The sign-out result could not be verified. Refresh the page before trying again.");
        router.refresh();
        return;
      }
      if (!isLogoutResponse(result)) {
        setError("The sign-out result could not be verified. Refresh the page before trying again.");
        router.refresh();
        return;
      }
      window.location.replace("/login");
    } catch {
      setError("The sign-out result could not be verified. Try again or refresh the page.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="protected-logout">
      <Button variant="secondary" size="sm" onClick={logout} loading={loading} loadingLabel="Signing out" disabled={loading}>
        Sign out
      </Button>
      {error ? <span className="protected-logout__error" role="alert">{error}</span> : null}
    </div>
  );
}
