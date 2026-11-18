"use client";

import { Button } from "@/components/ui/button";

export function InvoicePrintButton() {
  return (
    <Button
      className="no-print"
      variant="secondary"
      onClick={() => window.print()}
    >
      Save invoice as PDF
    </Button>
  );
}
