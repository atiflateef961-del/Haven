import { createHmac, timingSafeEqual } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

const REPLAY_WINDOW_MS = 5 * 60 * 1000;
const MAX_BODY_BYTES = 64 * 1024;
const PAYMENT_STATUSES = new Set(['SUCCEEDED', 'FAILED', 'REFUNDED']);

type PaymentWebhookEvent = {
  id: string;
  type: 'payment.updated';
  data: { paymentId: string; status: 'SUCCEEDED' | 'FAILED' | 'REFUNDED'; amount: string; currency: string };
};

@Injectable()
export class PaymentWebhookService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async accept(rawBody: Buffer | undefined, signatureHeader: string | undefined) {
    const secret = this.config.get<string>('PAYMENT_WEBHOOK_SECRET');
    if (!secret || !rawBody || rawBody.length === 0 || rawBody.length > MAX_BODY_BYTES) {
      throw new UnauthorizedException('Invalid payment webhook');
    }
    const signature = this.parseSignature(signatureHeader);
    if (!signature) throw new UnauthorizedException('Invalid payment webhook');
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - signature.timestamp) > REPLAY_WINDOW_MS / 1000) {
      throw new UnauthorizedException('Invalid payment webhook');
    }
    const expected = createHmac('sha256', secret)
      .update(`${signature.timestamp}.`)
      .update(rawBody)
      .digest();
    const supplied = Buffer.from(signature.digest, 'hex');
    if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) {
      throw new UnauthorizedException('Invalid payment webhook');
    }

    let event: PaymentWebhookEvent;
    try {
      event = JSON.parse(rawBody.toString('utf8')) as PaymentWebhookEvent;
    } catch {
      throw new UnauthorizedException('Invalid payment webhook');
    }
    if (!this.isValidEvent(event)) throw new UnauthorizedException('Invalid payment webhook');

    try {
      await this.prisma.$transaction(async (transaction) => {
        const payment = await transaction.payment.findUnique({
          where: { id: event.data.paymentId },
          select: { id: true, amount: true, currency: true, status: true, receivedAt: true },
        });
        if (!payment || payment.amount.toString() !== event.data.amount || payment.currency.trim() !== event.data.currency) {
          throw new UnauthorizedException('Invalid payment webhook');
        }
        await transaction.paymentTransaction.create({
          data: {
            paymentId: payment.id,
            provider: 'hmac-webhook',
            providerRef: event.id,
            idempotencyKey: `webhook/${event.id}`,
            verified: true,
            result: event as never,
          },
        });
        const expectedStatus = event.data.status === 'REFUNDED' ? 'SUCCEEDED' : 'PENDING';
        if (payment.status !== expectedStatus) throw new ConflictException('Payment status transition is not allowed');
        const changed = await transaction.payment.updateMany({
          where: { id: payment.id, status: expectedStatus },
          data: {
            status: event.data.status,
            receivedAt: event.data.status === 'SUCCEEDED' ? new Date() : payment.receivedAt,
          },
        });
        if (changed.count !== 1) throw new ConflictException('Payment status changed while applying webhook');
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('Payment webhook event already processed');
      throw error;
    }
    return { status: 'accepted' as const };
  }

  private parseSignature(header: string | undefined): { timestamp: number; digest: string } | null {
    if (!header || header.length > 256) return null;
    const match = /^t=(\d{10}),v1=([a-f0-9]{64})$/.exec(header);
    if (!match) return null;
    return { timestamp: Number(match[1]), digest: match[2] };
  }

  private isValidEvent(value: unknown): value is PaymentWebhookEvent {
    if (!value || typeof value !== 'object') return false;
    const event = value as Record<string, unknown>;
    if (typeof event.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(event.id) || event.type !== 'payment.updated') return false;
    if (!event.data || typeof event.data !== 'object') return false;
    const data = event.data as Record<string, unknown>;
    return typeof data.paymentId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.paymentId)
      && typeof data.status === 'string' && PAYMENT_STATUSES.has(data.status)
      && typeof data.amount === 'string' && /^\d{1,10}(?:\.\d{1,2})?$/.test(data.amount)
      && typeof data.currency === 'string' && /^[A-Z]{3}$/.test(data.currency);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
