import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createInvoiceCsv } from './invoice-csv.mjs';

describe('createInvoiceCsv', () => {
  it('exports the supplied invoice page with quoted values and CRLF rows', () => {
    const csv = createInvoiceCsv([{
      number: 'INV-001',
      status: 'PARTIALLY_PAID',
      currency: 'PKR',
      totalAmount: '1500.00',
      dueAt: '2026-12-01T00:00:00.000Z',
      student: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        studentNumber: 'ST-7',
        organization: { name: 'North, Hall' },
      },
    }]);

    assert.equal(csv.split('\r\n').length, 2);
    assert.match(csv, /^"Invoice number","Status","Student name"/);
    assert.match(csv, /"North, Hall"/);
    assert.match(csv, /"1500\.00","2026-12-01T00:00:00\.000Z"$/);
  });

  it('escapes quotes and neutralizes spreadsheet formula cells', () => {
    const csv = createInvoiceCsv([{
      number: '=HYPERLINK("https://bad.test")',
      status: 'DRAFT',
      currency: 'USD',
      totalAmount: 1,
      dueAt: null,
      student: {
        firstName: 'Sam',
        lastName: 'Row',
        studentNumber: '@SUM(A1:A2)',
        organization: { name: 'Hall "A"' },
      },
    }]);

    assert.match(csv, /"'=HYPERLINK\(""https:\/\/bad\.test""\)"/);
    assert.match(csv, /"'@SUM\(A1:A2\)"/);
    assert.match(csv, /"Hall ""A"""/);
  });
});
