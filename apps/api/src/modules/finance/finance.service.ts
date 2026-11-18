import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { CreateInvoiceDto } from './create-invoice.dto.js';
import type { StudentsListDto } from '../students/students-list.dto.js';
import type { RecordOfflinePaymentDto } from './offline-payment.dto.js';

type FinanceAssignment = { organizationId: string | null; hostelId: string | null; role: { name: string } };
const maximumTotalCents = 999_999_999_999n;

function toCents(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new Error('Invalid stored decimal amount');
  return BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

function fromCents(value: bigint) {
  return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async createDraftInvoice(userId: string, input: CreateInvoiceDto) {
    const assignments = await this.prisma.userRole.findMany({
      where: { userId, role: { name: { in: ['SUPER_ADMIN', 'HOSTEL_ADMIN'] } } },
      select: { organizationId: true, hostelId: true, role: { select: { name: true } } },
    }) as FinanceAssignment[];
    const globalAccess = assignments.some((row) => row.role.name === 'SUPER_ADMIN' && row.organizationId === null && row.hostelId === null);
    const organizationIds = [...new Set(assignments.filter((row) => row.organizationId !== null && row.hostelId === null).map((row) => row.organizationId!))];
    if (!globalAccess && organizationIds.length === 0) throw new ForbiddenException('Invoice creation is not assigned to this account');

    const student = await this.prisma.student.findFirst({
      where: { id: input.studentId, archivedAt: null, organization: { archivedAt: null, ...(globalAccess ? {} : { id: { in: organizationIds } }) } },
      select: { id: true, organization: { select: { currency: true } } },
    });
    if (!student) throw new NotFoundException('Active student not found');

    let totalCents = 0n;
    const items = input.items.map((item) => {
      const lineCents = toCents(item.unitAmount) * BigInt(item.quantity);
      if (lineCents <= 0n) throw new BadRequestException('Invoice items must have a positive amount');
      totalCents += lineCents;
      if (totalCents > maximumTotalCents) throw new BadRequestException('Invoice total exceeds the supported amount');
      return {
        description: item.description,
        quantity: new Prisma.Decimal(item.quantity),
        unitAmount: new Prisma.Decimal(item.unitAmount),
        lineAmount: new Prisma.Decimal(fromCents(lineCents)),
      };
    });

    try {
      return await this.prisma.invoice.create({
        data: {
          studentId: student.id,
          number: input.number,
          currency: student.organization.currency,
          status: 'DRAFT',
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          totalAmount: new Prisma.Decimal(fromCents(totalCents)),
          items: { create: items },
        },
        select: { id: true, number: true, status: true, currency: true, totalAmount: true, dueAt: true, items: { select: { id: true, description: true, quantity: true, unitAmount: true, lineAmount: true } } },
      });
    } catch (error) {
      if (isUniqueConflict(error)) throw new ConflictException('Invoice number already exists for this student');
      throw error;
    }
  }

  async issueInvoice(userId: string, invoiceId: string) {
    const assignments = await this.prisma.userRole.findMany({
      where: { userId, role: { name: { in: ['SUPER_ADMIN', 'HOSTEL_ADMIN'] } } },
      select: { organizationId: true, hostelId: true, role: { select: { name: true } } },
    }) as FinanceAssignment[];
    const globalAccess = assignments.some((row) => row.role.name === 'SUPER_ADMIN' && row.organizationId === null && row.hostelId === null);
    const organizationIds = [...new Set(assignments.filter((row) => row.organizationId !== null && row.hostelId === null).map((row) => row.organizationId!))];
    if (!globalAccess && organizationIds.length === 0) throw new ForbiddenException('Invoice management is not assigned to this account');
    const invoiceWhere = {
      id: invoiceId,
      student: { archivedAt: null, organization: { archivedAt: null, ...(globalAccess ? {} : { id: { in: organizationIds } }) } },
    };
    const issuedAt = new Date();
    const updated = await this.prisma.invoice.updateMany({
      where: { ...invoiceWhere, status: 'DRAFT' },
      data: { status: 'ISSUED', issuedAt },
    });
    if (updated.count !== 1) {
      const existing = await this.prisma.invoice.findFirst({ where: invoiceWhere, select: { id: true } });
      if (!existing) throw new NotFoundException('Invoice not found');
      throw new ConflictException('Only a draft invoice can be issued');
    }
    return this.prisma.invoice.findFirst({
      where: invoiceWhere,
      select: { id: true, number: true, status: true, currency: true, totalAmount: true, issuedAt: true, dueAt: true },
    });
  }

  async listInvoices(userId: string, pagination: StudentsListDto) {
    const assignments = await this.prisma.userRole.findMany({
      where: { userId, role: { name: { in: ['SUPER_ADMIN', 'HOSTEL_ADMIN'] } } },
      select: { organizationId: true, hostelId: true, role: { select: { name: true } } },
    }) as FinanceAssignment[];
    const globalAccess = assignments.some((row) => row.role.name === 'SUPER_ADMIN' && row.organizationId === null && row.hostelId === null);
    const organizationIds = [...new Set(assignments.filter((row) => row.organizationId !== null && row.hostelId === null).map((row) => row.organizationId!))];
    if (!globalAccess && organizationIds.length === 0) throw new ForbiddenException('Invoice access is not assigned to this account');
    const rows = await this.prisma.invoice.findMany({
      where: { student: { archivedAt: null, organization: { archivedAt: null, ...(globalAccess ? {} : { id: { in: organizationIds } }) } } },
      select: {
        id: true, number: true, status: true, currency: true, totalAmount: true, issuedAt: true, dueAt: true, createdAt: true,
        student: { select: { id: true, studentNumber: true, firstName: true, lastName: true, organization: { select: { id: true, name: true } } } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize + 1,
    });
    const hasMore = rows.length > pagination.pageSize;
    return { invoices: rows.slice(0, pagination.pageSize), page: pagination.page, pageSize: pagination.pageSize, hasMore };
  }

  async recordOfflinePayment(userId: string, invoiceId: string, input: RecordOfflinePaymentDto) {
    const assignments = await this.prisma.userRole.findMany({
      where: { userId, role: { name: { in: ['SUPER_ADMIN', 'HOSTEL_ADMIN'] } } },
      select: { organizationId: true, hostelId: true, role: { select: { name: true } } },
    }) as FinanceAssignment[];
    const globalAccess = assignments.some((row) => row.role.name === 'SUPER_ADMIN' && row.organizationId === null && row.hostelId === null);
    const organizationIds = [...new Set(assignments.filter((row) => row.organizationId !== null && row.hostelId === null).map((row) => row.organizationId!))];
    if (!globalAccess && organizationIds.length === 0) throw new ForbiddenException('Payment recording is not assigned to this account');
    const amountCents = toCents(input.amount);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const invoice = await transaction.invoice.findFirst({
          where: { id: invoiceId, status: { in: ['ISSUED', 'PARTIALLY_PAID'] }, student: { archivedAt: null, organization: { archivedAt: null, ...(globalAccess ? {} : { id: { in: organizationIds } }) } } },
          select: { id: true, totalAmount: true, currency: true, student: { select: { organization: { select: { currency: true } } } } },
        });
        if (!invoice) throw new NotFoundException('Payable invoice not found');
        const paid = await transaction.payment.aggregate({
          where: { invoiceId, status: 'SUCCEEDED', currency: invoice.currency },
          _sum: { amount: true },
        });
        const totalCents = toCents(invoice.totalAmount.toString());
        const paidCents = paid._sum.amount ? toCents(paid._sum.amount.toString()) : 0n;
        if (amountCents <= 0n || amountCents > totalCents - paidCents) throw new ConflictException('Payment amount exceeds the outstanding invoice balance');
        const newStatus = paidCents + amountCents === totalCents ? 'PAID' : 'PARTIALLY_PAID';
        const payment = await transaction.payment.create({
          data: { invoiceId, actorId: userId, amount: new Prisma.Decimal(input.amount), currency: invoice.currency, method: input.method, status: 'SUCCEEDED', receivedAt: new Date() },
          select: { id: true, invoiceId: true, amount: true, currency: true, method: true, status: true, receivedAt: true },
        });
        const updated = await transaction.invoice.updateMany({
          where: { id: invoiceId, status: { in: ['ISSUED', 'PARTIALLY_PAID'] } },
          data: { status: newStatus },
        });
        if (updated.count !== 1) throw new ConflictException('Invoice status changed while recording payment');
        return { payment, invoiceStatus: newStatus, balanceDue: fromCents(totalCents - paidCents - amountCents) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      if (isSerializationConflict(error)) throw new ConflictException('Invoice changed while recording payment; refresh and retry');
      throw error;
    }
  }

  async getInvoice(userId: string, invoiceId: string) {
    const assignments = await this.prisma.userRole.findMany({
      where: { userId, role: { name: { in: ['SUPER_ADMIN', 'HOSTEL_ADMIN'] } } },
      select: { organizationId: true, hostelId: true, role: { select: { name: true } } },
    }) as FinanceAssignment[];
    const globalAccess = assignments.some((row) => row.role.name === 'SUPER_ADMIN' && row.organizationId === null && row.hostelId === null);
    const organizationIds = [...new Set(assignments.filter((row) => row.organizationId !== null && row.hostelId === null).map((row) => row.organizationId!))];
    if (!globalAccess && organizationIds.length === 0) throw new ForbiddenException('Invoice access is not assigned to this account');
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, student: { archivedAt: null, organization: { archivedAt: null, ...(globalAccess ? {} : { id: { in: organizationIds } }) } } },
      select: {
        id: true, number: true, status: true, currency: true, totalAmount: true, issuedAt: true, dueAt: true, createdAt: true,
        student: { select: { id: true, studentNumber: true, firstName: true, lastName: true, organization: { select: { id: true, name: true } } } },
        items: { select: { id: true, description: true, quantity: true, unitAmount: true, lineAmount: true }, orderBy: { id: 'asc' } },
        payments: { select: { id: true, amount: true, currency: true, method: true, status: true, receivedAt: true, createdAt: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const paidCents = invoice.payments.filter((payment) => payment.status === 'SUCCEEDED').reduce((sum, payment) => sum + toCents(payment.amount.toString()), 0n);
    const totalCents = toCents(invoice.totalAmount.toString());
    return { ...invoice, paidAmount: fromCents(paidCents), balanceDue: fromCents(totalCents > paidCents ? totalCents - paidCents : 0n) };
  }
}

function isUniqueConflict(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2002';
}

function isSerializationConflict(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2034';
}
