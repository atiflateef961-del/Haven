"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { apiBaseUrl } from "@/lib/api-url.mjs";
import { displayCurrencyCode } from "@/lib/money.mjs";

export function OfflinePaymentForm({ invoiceId, currency, status }: { invoiceId: string; currency: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const amount = String(values.get("amount") ?? "").trim();
    const method = String(values.get("method") ?? "");
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/invoices/${encodeURIComponent(invoiceId)}/payments/offline`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, method }),
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
        setError("The amount exceeds the remaining balance or the invoice changed. Refresh and try again.");
        return;
      }
      if (response.status === 400) {
        setError("Enter a positive amount with exactly two decimal places.");
        return;
      }
      if (!response.ok) {
        setError("The payment could not be recorded. Please try again.");
        return;
      }
      setMessage("The receipt was recorded.");
      form.reset();
      router.refresh();
    } catch {
      setError("The finance service is unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (status !== "ISSUED" && status !== "PARTIALLY_PAID") return null;
  return (
    <section aria-labelledby="record-offline-payment-title">
      <h2 id="record-offline-payment-title">Record received payment</h2>
      <form className="student-bookings-panel__form" onSubmit={submit}>
        <TextField label={`Amount (${displayCurrencyCode(currency)})`} name="amount" type="text" inputMode="decimal" pattern="[1-9][0-9]{0,9}\\.[0-9]{2}" required />
        <label className="ui-field">
          <span className="ui-field__label">Method</span>
          <select className="ui-field__control ui-field__control--md" name="method" defaultValue="CASH">
            <option value="CASH">Cash</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
          </select>
        </label>
        {error ? <p className="student-self-profile__error" role="alert">{error}</p> : null}
        {message ? <p className="student-self-profile__note" role="status">{message}</p> : null}
        <Button type="submit" loading={pending} loadingLabel="Recording receipt">Record receipt</Button>
      </form>
    </section>
  );
}
