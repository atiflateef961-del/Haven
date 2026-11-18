"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiBaseUrl } from "@/lib/api-url.mjs";

export function InvoiceIssueButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function issue() {
    if (pending) return;
    if (!window.confirm("Issue this invoice? Its charges will be fixed and it will become payable.")) return;
    setPending(true);
    setError(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/invoices/${encodeURIComponent(invoiceId)}/issue`, {
        method: "PATCH",
        credentials: "include",
      });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("This invoice is no longer available for your account.");
        return;
      }
      if (response.status === 409) {
        setError("This invoice has already changed. Refresh to see its current status.");
        return;
      }
      if (!response.ok) {
        setError("The invoice could not be issued. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("The finance service is unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return <div>{error ? <p className="student-self-profile__error" role="alert">{error}</p> : null}<Button onClick={issue} loading={pending} loadingLabel="Issuing invoice">Issue invoice</Button></div>;
}
