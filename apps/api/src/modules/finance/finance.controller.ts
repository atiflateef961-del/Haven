import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { FinanceService } from './finance.service.js';
import { createInvoiceSchema, invoiceIdSchema } from './create-invoice.dto.js';
import type { CreateInvoiceDto } from './create-invoice.dto.js';
import { studentsListSchema } from '../students/students-list.dto.js';
import type { StudentsListDto } from '../students/students-list.dto.js';
import { recordOfflinePaymentSchema } from './offline-payment.dto.js';
import type { RecordOfflinePaymentDto } from './offline-payment.dto.js';

@Controller('api/v1/invoices')
@UseGuards(SessionAuthGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query({ schema: studentsListSchema }) query: StudentsListDto) {
    return this.financeService.listInvoices(user.id, query);
  }

  @Get(':invoiceId')
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('invoiceId', { schema: invoiceIdSchema }) invoiceId: string) {
    return this.financeService.getInvoice(user.id, invoiceId);
  }

  @Post()
  createDraft(@CurrentUser() user: AuthenticatedUser, @Body({ schema: createInvoiceSchema }) body: CreateInvoiceDto) {
    return this.financeService.createDraftInvoice(user.id, body);
  }

  @Patch(':invoiceId/issue')
  issue(@CurrentUser() user: AuthenticatedUser, @Param('invoiceId', { schema: invoiceIdSchema }) invoiceId: string) {
    return this.financeService.issueInvoice(user.id, invoiceId);
  }

  @Post(':invoiceId/payments/offline')
  recordOfflinePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('invoiceId', { schema: invoiceIdSchema }) invoiceId: string,
    @Body({ schema: recordOfflinePaymentSchema }) body: RecordOfflinePaymentDto,
  ) {
    return this.financeService.recordOfflinePayment(user.id, invoiceId, body);
  }
}
