import Link from "next/link";
import { SurfaceCard } from "@/components/ui/surface-card";
import { PageHeading } from "@/components/ui/page-heading";
import { getInvoices } from "@/lib/invoices";
import { InvoiceCsvExport } from "@/components/finance/invoice-csv-export";
import { formatMoney } from "@/lib/money.mjs";
import { StatIcon } from "@/components/ui/stat-icon";
import { DEMO_MODE, demoInvoices, demoInvoicePaidAmounts } from "@/lib/demo-data";

type InvoicesPageProps = { searchParams: Promise<{ page?: string }> };

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const query = await searchParams;
  const requestedPage = Number(query.page ?? "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 1_000_000 ? requestedPage : 1;
  const apiResult = await getInvoices(page);
  const result = DEMO_MODE && page === 1 && apiResult.status === "ok" && apiResult.invoices.length === 0
    ? { ...apiResult, invoices: demoInvoices, hasMore: false }
    : apiResult;
  const isDemo = result.status === "ok" && result.invoices.some((invoice) => demoInvoices.some((demoInvoice) => demoInvoice.id === invoice.id));
  const demoInvoicedTotal = isDemo ? result.invoices.reduce((total, invoice) => total + Number(invoice.totalAmount), 0) : 0;
  const demoCollectedTotal = isDemo ? demoInvoicePaidAmounts.reduce((total, amount) => total + amount, 0) : 0;
  const demoOverdueTotal = isDemo ? result.invoices.reduce((total, invoice, index) => total + (invoice.status === "OVERDUE" ? Number(invoice.totalAmount) - demoInvoicePaidAmounts[index] : 0), 0) : 0;

  return (
    <main className="page-content" data-demo-data={isDemo ? "true" : undefined}>
      <PageHeading eyebrow="FINANCE" title="Invoices" subtitle="Invoices for students in your assigned organizations." />
      {result.status === "forbidden" ? <SurfaceCard className="dashboard-message" padding="md" role="status">Your account does not have organization-level finance access.</SurfaceCard> : null}
      {result.status === "unavailable" ? <SurfaceCard className="dashboard-message" padding="md" role="alert">Invoice information is temporarily unavailable. Please refresh to try again.</SurfaceCard> : null}
      {result.status === "ok" && result.invoices.length === 0 ? <SurfaceCard className="dashboard-message" padding="md" role="status">There are no invoices on this page.</SurfaceCard> : null}
      {result.status === "ok" && result.invoices.length > 0 ? (
        <>
          {isDemo ? <dl className="demo-invoice-kpis" aria-label="Demo invoice totals">
            <div><StatIcon name="invoice-total" /><dt>Invoiced</dt><dd>{formatMoney(demoInvoicedTotal, "PKR")}</dd></div>
            <div><StatIcon name="invoice-collected" /><dt>Collected</dt><dd>{formatMoney(demoCollectedTotal, "PKR")}</dd></div>
            <div><StatIcon name="invoice-due" /><dt>Due</dt><dd>{formatMoney(demoInvoicedTotal - demoCollectedTotal, "PKR")}</dd></div>
            <div><StatIcon name="invoice-overdue" /><dt>Overdue</dt><dd>{formatMoney(demoOverdueTotal, "PKR")}</dd></div>
          </dl> : null}
          <InvoiceCsvExport invoices={result.invoices} page={page} />
          <ul className="booking-review-list" aria-label="Invoices">
            {result.invoices.map((invoice) => (
              <li key={invoice.id}>
                <SurfaceCard as="article" padding="md">
                  <div className="booking-review-list__heading">
                    <div><p>{invoice.student.organization.name}</p><h2><Link href={`/invoices/${encodeURIComponent(invoice.id)}`}>{invoice.number}</Link></h2><span>{invoice.student.firstName} {invoice.student.lastName} · {invoice.student.studentNumber}</span></div>
                    <span className={`booking-review-status pill ${invoice.status === "PAID" ? "pill--up" : invoice.status === "OVERDUE" ? "pill--down" : "pill--warn"} booking-review-status--${invoice.status.toLowerCase()}`}>{invoice.status.toLowerCase().replaceAll("_", " ")}</span>
                  </div>
                  <dl><div><dt>Total</dt><dd>{formatMoney(invoice.totalAmount, invoice.currency)}</dd></div><div><dt>Due</dt><dd>{invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString("en", { dateStyle: "medium" }) : "No due date"}</dd></div></dl>
                </SurfaceCard>
              </li>
            ))}
          </ul>
          <nav className="student-directory-pagination" aria-label="Invoice pages">
            {page > 1 ? <Link href={`/invoices?page=${page - 1}`}>Previous page</Link> : <span />}
            <span>Page {page}</span>
            {result.hasMore ? <Link href={`/invoices?page=${page + 1}`}>Next page</Link> : <span />}
          </nav>
        </>
      ) : null}
    </main>
  );
}
