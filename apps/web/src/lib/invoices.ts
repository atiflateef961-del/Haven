import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type InvoiceSummary = {
  id: string; number: string; status: string; currency: string; totalAmount: string | number;
  issuedAt: string | null; dueAt: string | null; createdAt: string;
  student: { id: string; studentNumber: string; firstName: string; lastName: string; organization: { id: string; name: string } };
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function authenticatedFetch(path: string) {
  const session = (await cookies()).get("hms_session")?.value;
  if (!session) redirect("/login");
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, { headers: { Cookie: `hms_session=${encodeURIComponent(session)}` }, cache: "no-store" });
  } catch {
    return { status: "unavailable" as const };
  }
  if (response.status === 401) redirect("/login");
  if (response.status === 403) return { status: "forbidden" as const };
  if (!response.ok) return { status: "unavailable" as const };
  try {
    return { status: "ok" as const, payload: await response.json() as unknown };
  } catch {
    return { status: "unavailable" as const };
  }
}

function isInvoice(value: unknown): value is InvoiceSummary {
  if (typeof value !== "object" || value === null) return false;
  const invoice = value as Record<string, unknown>;
  const student = invoice.student as Record<string, unknown> | null;
  const organization = student?.organization as Record<string, unknown> | null;
  return typeof invoice.id === "string" && typeof invoice.number === "string" && typeof invoice.status === "string" &&
    typeof invoice.currency === "string" && (typeof invoice.totalAmount === "string" || typeof invoice.totalAmount === "number") &&
    (invoice.issuedAt === null || typeof invoice.issuedAt === "string") && (invoice.dueAt === null || typeof invoice.dueAt === "string") &&
    typeof invoice.createdAt === "string" && typeof student?.id === "string" && typeof student.studentNumber === "string" &&
    typeof student.firstName === "string" && typeof student.lastName === "string" && typeof organization?.id === "string" && typeof organization.name === "string";
}

export async function getInvoices(page: number) {
  const result = await authenticatedFetch(`/api/v1/invoices?page=${page}&pageSize=25`);
  if (result.status !== "ok") return result;
  const payload = result.payload;
  if (typeof payload !== "object" || payload === null) return { status: "unavailable" as const };
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.invoices) || !record.invoices.every(isInvoice) || record.invoices.length > 25 ||
    record.page !== page || record.pageSize !== 25 || typeof record.hasMore !== "boolean") return { status: "unavailable" as const };
  return { status: "ok" as const, invoices: record.invoices, page, hasMore: record.hasMore };
}

export async function getInvoiceDetail(id: string) {
  const result = await authenticatedFetch(`/api/v1/invoices/${encodeURIComponent(id)}`);
  if (result.status !== "ok") return result;
  const value = result.payload;
  if (typeof value !== "object" || value === null) return { status: "unavailable" as const };
  const invoice = value as Record<string, unknown>;
  const summary = invoice as unknown as InvoiceSummary;
  const items = invoice.items;
  const payments = invoice.payments;
  const validItem = (item: unknown) => typeof item === "object" && item !== null &&
    typeof (item as Record<string, unknown>).id === "string" && typeof (item as Record<string, unknown>).description === "string" &&
    ["quantity", "unitAmount", "lineAmount"].every((field) => typeof (item as Record<string, unknown>)[field] === "string" || typeof (item as Record<string, unknown>)[field] === "number");
  const validPayment = (payment: unknown) => typeof payment === "object" && payment !== null &&
    typeof (payment as Record<string, unknown>).id === "string" && typeof (payment as Record<string, unknown>).method === "string" &&
    typeof (payment as Record<string, unknown>).status === "string" &&
    ["amount", "currency"].every((field) => typeof (payment as Record<string, unknown>)[field] === "string" || typeof (payment as Record<string, unknown>)[field] === "number");
  if (!isInvoice(summary) || !Array.isArray(items) || !items.every(validItem) || !Array.isArray(payments) || !payments.every(validPayment) ||
    typeof invoice.paidAmount !== "string" || typeof invoice.balanceDue !== "string") return { status: "unavailable" as const };
  return { status: "ok" as const, invoice: value as Record<string, unknown> & InvoiceSummary & { paidAmount: string; balanceDue: string; items: Array<Record<string, string | number>>; payments: Array<Record<string, string | number | null>> } };
}
