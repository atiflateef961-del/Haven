import { Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentWebhookService } from './payment-webhook.service.js';

@Controller('api/v1/webhooks/payments')
export class PaymentWebhookController {
  constructor(private readonly webhooks: PaymentWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  accept(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-payment-signature') signature: string | undefined,
  ) {
    return this.webhooks.accept(request.rawBody, signature);
  }
}
