import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FinanceController } from './finance.controller.js';
import { FinanceService } from './finance.service.js';
import { PaymentWebhookController } from './payment-webhook.controller.js';
import { PaymentWebhookService } from './payment-webhook.service.js';

@Module({ imports: [AuthModule], controllers: [FinanceController, PaymentWebhookController], providers: [FinanceService, PaymentWebhookService] })
export class FinanceModule {}
