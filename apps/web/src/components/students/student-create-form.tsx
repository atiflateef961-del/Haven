"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { apiBaseUrl } from "@/lib/api-url.mjs";

type OrganizationOption = { id: string; name: string };

function isValidDateOfBirth(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value &&
    value <= new Date().toISOString().slice(0, 10);
}

export function StudentCreateForm({ organizations }: { organizations: OrganizationOption[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function createStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || organizations.length === 0) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const optional = (key: string) => String(values.get(key) ?? "").trim();
    const dateOfBirth = optional("dateOfBirth");
    if (dateOfBirth && !isValidDateOfBirth(dateOfBirth)) {
      setError("Enter a valid date of birth with a four-digit year. The date cannot be in the future.");
      return;
    }
    const payload = {
      organizationId: String(values.get("organizationId") ?? "") || undefined,
      studentNumber: optional("studentNumber"),
      firstName: optional("firstName"),
      lastName: optional("lastName"),
      ...(optional("email") ? { email: optional("email") } : {}),
      ...(optional("phone") ? { phone: optional("phone") } : {}),
      ...(dateOfBirth ? { dateOfBirth } : {}),
      ...(optional("educationInstitution") ? { educationInstitution: optional("educationInstitution") } : {}),
      ...(optional("educationProgram") ? { educationProgram: optional("educationProgram") } : {}),
      ...(optional("educationYear") ? { educationYear: optional("educationYear") } : {}),
      status: String(values.get("status") ?? "ACTIVE"),
    };

    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const apiOrigin = apiBaseUrl;
      const response = await fetch(`${apiOrigin}/api/v1/students`, {
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
      if (response.status === 403 || response.status === 404) {
        setError("Your account can no longer add students in that organization.");
        return;
      }
      if (response.status === 409) {
        setError("That student number is already in use in this organization.");
        return;
      }
      if (response.status === 400) {
        let message = "";
        try {
          const body: unknown = await response.json();
          if (typeof body === "object" && body !== null && "message" in body) {
            const detail = (body as { message?: unknown }).message;
            message = Array.isArray(detail) ? detail.filter((item): item is string => typeof item === "string").join(" ") : typeof detail === "string" ? detail : "";
          }
        } catch {
          // Keep the form usable if the API did not return a JSON error body.
        }
        setError(/dateOfBirth/i.test(message)
          ? "Enter a valid date of birth with a four-digit year. The date cannot be in the future."
          : /organizationId|required.*organization/i.test(message)
            ? "Select an organization you can manage, then try again."
            : "Check the student number, name, and contact details, then try again.");
        return;
      }
      if (!response.ok) {
        setError("The student could not be created. Please try again.");
        return;
      }
      const fullName = `${payload.firstName} ${payload.lastName}`;
      form.reset();
      setSuccess(`${fullName} was added to the student directory.`);
      router.refresh();
    } catch {
      setError("The student service is unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="student-create-form" onSubmit={createStudent}>
      {organizations.length > 1 ? (
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="student-organization">Organization</label>
          <select className="ui-field__control ui-field__control--md" id="student-organization" name="organizationId" defaultValue="" required>
            <option value="" disabled>Select an organization</option>
            {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
          </select>
        </div>
      ) : (
        <>
          <input type="hidden" name="organizationId" value={organizations[0]?.id ?? ""} />
          <p className="student-create-form__organization">Organization: {organizations[0]?.name}</p>
        </>
      )}
      <div className="form-grid student-create-form__fields">
        <TextField label="Student number" name="studentNumber" maxLength={60} required />
        <TextField label="First name" name="firstName" autoComplete="given-name" maxLength={100} required />
        <TextField label="Last name" name="lastName" autoComplete="family-name" maxLength={100} required />
        <TextField label="Email" name="email" type="email" autoComplete="email" maxLength={320} />
        <TextField label="Phone" name="phone" type="tel" autoComplete="tel" maxLength={32} />
        <TextField label="Date of birth" name="dateOfBirth" type="date" max={new Date().toISOString().slice(0, 10)} />
        <TextField label="Educational institution" name="educationInstitution" maxLength={180} />
        <TextField label="Program or course" name="educationProgram" maxLength={180} />
        <TextField label="Year of study" name="educationYear" maxLength={40} hint="For example, Year 2 or Grade 11." />
        <label className="student-status-field" htmlFor="student-status-new">
          Student status
          <select id="student-status-new" className="ui-field__control ui-field__control--md" name="status" defaultValue="ACTIVE">
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="GRADUATED">Graduated</option>
          </select>
          <span className="student-status-field__hint">Status is informational. Archiving is a separate action.</span>
        </label>
      </div>
      {error ? <p className="student-create-form__message student-create-form__message--error" role="alert">{error}</p> : null}
      {success ? <p className="student-create-form__message" role="status">{success}</p> : null}
      <Button type="submit" loading={pending} loadingLabel="Adding student">Add student</Button>
    </form>
  );
}
