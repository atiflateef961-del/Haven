import Link from "next/link";
import { notFound } from "next/navigation";
import { SurfaceCard } from "@/components/ui/surface-card";
import { PageHeading } from "@/components/ui/page-heading";
import { getInvoiceDetail } from "@/lib/invoices";
import { OfflinePaymentForm } from "@/components/finance/offline-payment-form";
import { InvoiceIssueButton } from "@/components/finance/invoice-issue-button";
import { InvoicePrintButton } from "@/components/finance/invoice-print-button";
import { formatMoney } from "@/lib/money.mjs";
import { DEMO_MODE, getDemoInvoiceDetail } from "@/lib/demo-data";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const demoInvoice = DEMO_MODE ? getDemoInvoiceDetail(invoiceId) : null;
  const apiResult = demoInvoice ? null : await getInvoiceDetail(invoiceId);
  const result = demoInvoice
    ? { status: "ok" as const, invoice: demoInvoice }
    : apiResult!;
  if (result.status === "forbidden") return <main className="page-content"><SurfaceCard className="dashboard-message" padding="md" role="status">Your account does not have organization-level finance access.</SurfaceCard></main>;
  if (result.status === "unavailable") return <main className="page-content"><SurfaceCard className="dashboard-message" padding="md" role="alert">Invoice details are temporarily unavailable. Please refresh to try again.</SurfaceCard></main>;
  const invoice = result.invoice;
  if (invoice.id !== invoiceId) notFound();

  return (
    <main className="page-content" data-demo-data={demoInvoice ? "true" : undefined}>
      <p className="no-print"><Link href="/invoices">← Invoices</Link></p>
      <PageHeading eyebrow="FINANCE" title={`Invoice ${invoice.number}`} />
      <InvoicePrintButton />
      <p>{invoice.student.firstName} {invoice.student.lastName} · {invoice.student.studentNumber} · {invoice.student.organization.name}</p>
      <SurfaceCard padding="md">
        <p>Status: {invoice.status.toLowerCase().replaceAll("_", " ")}</p>
        <dl>
          <div><dt>Total</dt><dd>{formatMoney(invoice.totalAmount, invoice.currency)}</dd></div>
          <div><dt>Paid</dt><dd>{formatMoney(invoice.paidAmount, invoice.currency)}</dd></div>
          <div><dt>Balance due</dt><dd>{formatMoney(invoice.balanceDue, invoice.currency)}</dd></div>
        </dl>
      </SurfaceCard>
      <div className="no-print">
        {!demoInvoice && invoice.status === "DRAFT" ? <InvoiceIssueButton invoiceId={invoice.id} /> : null}
        {!demoInvoice ? <OfflinePaymentForm invoiceId={invoice.id} currency={invoice.currency} status={invoice.status} /> : null}
      </div>
      <section aria-labelledby="invoice-items-title">
        <h2 id="invoice-items-title">Charges</h2>
        <ul className="booking-review-list">
          {invoice.items.map((item) => <li key={String(item.id)}><SurfaceCard padding="md"><strong>{item.description}</strong><p>{item.quantity} × {formatMoney(item.unitAmount, invoice.currency)} = {formatMoney(item.lineAmount, invoice.currency)}</p></SurfaceCard></li>)}
        </ul>
      </section>
      <section aria-labelledby="invoice-payments-title">
        <h2 id="invoice-payments-title">Payment history</h2>
        {invoice.payments.length === 0 ? <p>{demoInvoice ? "Payment history is empty in this demo record." : "No payments recorded."}</p> : (
          <ul className="booking-review-list">
            {invoice.payments.map((payment) => <li key={String(payment.id)}><SurfaceCard padding="md"><strong>{formatMoney(payment.amount, typeof payment.currency === "string" ? payment.currency : invoice.currency)}</strong><p>{payment.method} · {payment.status}</p></SurfaceCard></li>)}
          </ul>
        )}
      </section>
    </main>
  );
}
