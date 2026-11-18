"use client";

import { Button } from "@/components/ui/button";
import type { InvoiceSummary } from "@/lib/invoices";
import { createInvoiceCsv } from "@/lib/invoice-csv.mjs";

export function InvoiceCsvExport({
  invoices,
  page,
}: {
  invoices: InvoiceSummary[];
  page: number;
}) {
  function downloadCsv() {
    const blob = new Blob([createInvoiceCsv(invoices)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `invoices-page-${page}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <Button className="no-print" variant="secondary" onClick={downloadCsv}>
      Download this page as CSV
    </Button>
  );
}
