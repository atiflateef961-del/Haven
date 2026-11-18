import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { FinanceService } from './finance.service.js';

describe('FinanceService', () => {
  const roleFindMany = vi.fn();
  const studentFindFirst = vi.fn();
  const invoiceCreate = vi.fn();
  const invoiceUpdateMany = vi.fn();
  const invoiceFindFirst = vi.fn();
  const invoiceFindMany = vi.fn();
  const transaction = vi.fn();
  const payableInvoiceFindFirst = vi.fn();
  const paymentAggregate = vi.fn();
  const paymentCreate = vi.fn();
  const invoiceStatusUpdate = vi.fn();
  const service = new FinanceService({
    userRole: { findMany: roleFindMany }, student: { findFirst: studentFindFirst }, invoice: { create: invoiceCreate, updateMany: invoiceUpdateMany, findFirst: invoiceFindFirst, findMany: invoiceFindMany },
    $transaction: transaction,
  } as unknown as PrismaService);

  beforeEach(() => {
    vi.clearAllMocks();
    roleFindMany.mockResolvedValue([{ organizationId: 'org-1', hostelId: null, role: { name: 'HOSTEL_ADMIN' } }]);
    studentFindFirst.mockResolvedValue({ id: 'student-1', organization: { currency: 'CAD' } });
    invoiceCreate.mockResolvedValue({ id: 'invoice-1', status: 'DRAFT' });
    invoiceUpdateMany.mockResolvedValue({ count: 1 });
    invoiceFindFirst.mockResolvedValue({ id: 'invoice-1', status: 'ISSUED' });
    invoiceFindMany.mockResolvedValue([]);
    payableInvoiceFindFirst.mockResolvedValue({ id: 'invoice-1', totalAmount: { toString: () => '100.00' }, currency: 'CAD' });
    paymentAggregate.mockResolvedValue({ _sum: { amount: { toString: () => '30.00' } } });
    paymentCreate.mockResolvedValue({ id: 'payment-1', status: 'SUCCEEDED' });
    invoiceStatusUpdate.mockResolvedValue({ count: 1 });
    transaction.mockImplementation((callback) => callback({
      invoice: { findFirst: payableInvoiceFindFirst, updateMany: invoiceStatusUpdate },
      payment: { aggregate: paymentAggregate, create: paymentCreate },
    }));
  });

  it('creates an itemized draft using decimal arithmetic and the organization currency', async () => {
    await expect(service.createDraftInvoice('admin-1', {
      studentId: '93a3e2e6-0d6a-4fac-9e39-e3cc8dab1dd0', number: 'INV-001',
      items: [
        { description: 'Room fee', quantity: 2, unitAmount: '125.35' },
        { description: 'Key deposit', quantity: 1, unitAmount: '20.00' },
      ],
    })).resolves.toEqual({ id: 'invoice-1', status: 'DRAFT' });
    expect(invoiceCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        studentId: 'student-1', number: 'INV-001', currency: 'CAD', status: 'DRAFT', totalAmount: expect.any(Object),
        items: { create: expect.arrayContaining([
          expect.objectContaining({ description: 'Room fee', quantity: expect.any(Object), unitAmount: expect.any(Object), lineAmount: expect.any(Object) }),
          expect.objectContaining({ description: 'Key deposit' }),
        ]) },
      }),
    }));
    const createData = invoiceCreate.mock.calls[0]?.[0].data;
    expect(createData.totalAmount.toString()).toBe('270.7');
    expect(createData.items.create[0].lineAmount.toString()).toBe('250.7');
  });

  it('denies users without organization-level finance scope', async () => {
    roleFindMany.mockResolvedValue([{ organizationId: null, hostelId: 'hostel-1', role: { name: 'WARDEN' } }]);
    await expect(service.createDraftInvoice('warden', {
      studentId: '93a3e2e6-0d6a-4fac-9e39-e3cc8dab1dd0', number: 'INV-001', items: [{ description: 'Fee', quantity: 1, unitAmount: '5.00' }],
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(studentFindFirst).not.toHaveBeenCalled();
  });

  it('hides students outside authorized active organizations', async () => {
    studentFindFirst.mockResolvedValue(null);
    await expect(service.createDraftInvoice('admin-1', {
      studentId: '93a3e2e6-0d6a-4fac-9e39-e3cc8dab1dd0', number: 'INV-001', items: [{ description: 'Fee', quantity: 1, unitAmount: '5.00' }],
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(invoiceCreate).not.toHaveBeenCalled();
  });

  it('issues a draft invoice atomically within the caller organization', async () => {
    await expect(service.issueInvoice('admin-1', 'invoice-1')).resolves.toEqual({ id: 'invoice-1', status: 'ISSUED' });
    expect(invoiceUpdateMany).toHaveBeenCalledWith({
      where: { id: 'invoice-1', status: 'DRAFT', student: { archivedAt: null, organization: { archivedAt: null, id: { in: ['org-1'] } } } },
      data: { status: 'ISSUED', issuedAt: expect.any(Date) },
    });
    expect(invoiceFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'invoice-1', student: { archivedAt: null, organization: { archivedAt: null, id: { in: ['org-1'] } } } } }));
  });

  it('hides missing invoices and conflicts when the invoice is no longer a draft', async () => {
    invoiceUpdateMany.mockResolvedValueOnce({ count: 0 });
    invoiceFindFirst.mockResolvedValueOnce(null);
    await expect(service.issueInvoice('admin-1', 'invoice-2')).rejects.toBeInstanceOf(NotFoundException);
    invoiceUpdateMany.mockResolvedValueOnce({ count: 0 });
    invoiceFindFirst.mockResolvedValueOnce({ id: 'invoice-1' });
    await expect(service.issueInvoice('admin-1', 'invoice-1')).rejects.toThrow('Only a draft invoice can be issued');
  });

  it('lists only invoices for active students in authorized organizations with bounded pagination', async () => {
    invoiceFindMany.mockResolvedValueOnce([{ id: 'invoice-1' }, { id: 'invoice-2' }]);
    await expect(service.listInvoices('admin-1', { page: 2, pageSize: 1 })).resolves.toEqual({
      invoices: [{ id: 'invoice-1' }], page: 2, pageSize: 1, hasMore: true,
    });
    expect(invoiceFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { student: { archivedAt: null, organization: { archivedAt: null, id: { in: ['org-1'] } } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: 1, take: 2,
    }));
  });

  it('records an offline receipt with exact decimal balance and updates invoice status transactionally', async () => {
    await expect(service.recordOfflinePayment('admin-1', 'invoice-1', { amount: '70.00', method: 'CASH' })).resolves.toEqual({
      payment: { id: 'payment-1', status: 'SUCCEEDED' }, invoiceStatus: 'PAID', balanceDue: '0.00',
    });
    expect(paymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ invoiceId: 'invoice-1', actorId: 'admin-1', amount: expect.any(Object), currency: 'CAD', method: 'CASH', status: 'SUCCEEDED', receivedAt: expect.any(Date) }),
      select: expect.any(Object),
    });
    expect(invoiceStatusUpdate).toHaveBeenCalledWith({ where: { id: 'invoice-1', status: { in: ['ISSUED', 'PARTIALLY_PAID'] } }, data: { status: 'PAID' } });
  });

  it('rejects offline amounts above the outstanding balance without creating payment', async () => {
    await expect(service.recordOfflinePayment('admin-1', 'invoice-1', { amount: '70.01', method: 'BANK_TRANSFER' }))
      .rejects.toThrow('Payment amount exceeds the outstanding invoice balance');
    expect(paymentCreate).not.toHaveBeenCalled();
    expect(invoiceStatusUpdate).not.toHaveBeenCalled();
  });

  it('returns authorized invoice details with exact paid and due balances', async () => {
    invoiceFindFirst.mockResolvedValueOnce({
      id: 'invoice-1', totalAmount: { toString: () => '120.00' }, items: [{ id: 'item-1' }], payments: [{ id: 'payment-1', amount: { toString: () => '20' }, status: 'SUCCEEDED' }],
    });
    await expect(service.getInvoice('admin-1', 'invoice-1')).resolves.toMatchObject({
      id: 'invoice-1', paidAmount: '20.00', balanceDue: '100.00', items: [{ id: 'item-1' }], payments: [{ id: 'payment-1' }],
    });
    expect(invoiceFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'invoice-1', student: { archivedAt: null, organization: { archivedAt: null, id: { in: ['org-1'] } } } },
    }));
  });
});
