"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/text-field";
import { apiBaseUrl } from "@/lib/api-url.mjs";

type OrganizationOption = { id: string; name: string };

export function HostelCreateForm({
  organizations,
}: {
  organizations: OrganizationOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function createHostel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = event.currentTarget;
    const values = new FormData(form);
    const address = String(values.get("address") ?? "").trim();
    const payload = {
      organizationId: String(values.get("organizationId") ?? "") || undefined,
      name: String(values.get("name") ?? "").trim(),
      code: String(values.get("code") ?? "").trim(),
      ...(address ? { address } : {}),
    };

    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/hostels`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403) {
        setError("Your account can no longer create a hostel in that organization.");
        return;
      }
      if (response.status === 409) {
        setError("That hostel code is already in use in this organization.");
        return;
      }
      if (response.status === 400) {
        setError("Check the hostel name, code, and organization, then try again.");
        return;
      }
      if (!response.ok) {
        setError("The hostel could not be created. Please try again.");
        return;
      }

      const createdName = payload.name;
      form.reset();
      setSuccess(`${createdName} was added to your hostel directory.`);
      router.refresh();
    } catch {
      setError("The hostel service is unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="hostel-create-form" onSubmit={createHostel}>
      {organizations.length > 1 ? (
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="hostel-organization">Organization</label>
          <select className="ui-field__control ui-field__control--md" id="hostel-organization" name="organizationId" required defaultValue="">
            <option value="" disabled>Select an organization</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>{organization.name}</option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <input type="hidden" name="organizationId" value={organizations[0]?.id ?? ""} />
          <p className="hostel-create-form__organization">Organization: {organizations[0]?.name}</p>
        </>
      )}
      <div className="form-grid hostel-create-form__fields">
        <TextField label="Hostel name" name="name" autoComplete="organization" maxLength={160} required />
        <TextField
          label="Hostel code"
          name="code"
          maxLength={40}
          pattern="[A-Za-z0-9][A-Za-z0-9_-]*"
          hint="Letters, numbers, hyphens, and underscores."
          required
        />
        <TextAreaField label="Address" name="address" maxLength={500} fieldClassName="full" />
      </div>
      {error ? <p className="hostel-create-form__message hostel-create-form__message--error" role="alert">{error}</p> : null}
      {success ? <p className="hostel-create-form__message" role="status">{success}</p> : null}
      <Button type="submit" loading={pending} loadingLabel="Creating hostel">Add hostel</Button>
    </form>
  );
}
