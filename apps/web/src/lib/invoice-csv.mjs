const CSV_COLUMNS = [
  'Invoice number',
  'Status',
  'Student name',
  'Student number',
  'Organization',
  'Currency',
  'Total amount',
  'Due date',
];

function cell(value) {
  let text = String(value ?? '');
  if (/^[\t\r ]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

export function createInvoiceCsv(invoices) {
  const rows = invoices.map((invoice) => [
    invoice.number,
    invoice.status,
    `${invoice.student.firstName} ${invoice.student.lastName}`,
    invoice.student.studentNumber,
    invoice.student.organization.name,
    invoice.currency,
    invoice.totalAmount,
    invoice.dueAt ?? '',
  ]);

  return [CSV_COLUMNS, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
}
