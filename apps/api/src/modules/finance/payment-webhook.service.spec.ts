import { createHmac } from 'node:crypto';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service.js';
import { PaymentWebhookService } from './payment-webhook.service.js';

describe('PaymentWebhookService', () => {
  const secret = 'a-test-secret-with-more-than-32-characters';
  const transaction = {
    payment: { findUnique: vi.fn(), updateMany: vi.fn() },
    paymentTransaction: { create: vi.fn() },
  };
  const prisma = { $transaction: vi.fn() };
  const config = { get: vi.fn(() => secret) };
  const service = new PaymentWebhookService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
  );
  const paymentId = '11111111-1111-4111-8111-111111111111';

  function signed(event: object, timestamp = Math.floor(Date.now() / 1000)) {
    const rawBody = Buffer.from(JSON.stringify(event));
    const digest = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest('hex');
    return { rawBody, header: `t=${timestamp},v1=${digest}` };
  }

  function event(id = 'evt_001') {
    return { id, type: 'payment.updated', data: { paymentId, status: 'SUCCEEDED', amount: '12.50', currency: 'USD' } };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    config.get.mockReturnValue(secret);
    prisma.$transaction.mockImplementation(async (callback) => callback(transaction));
    transaction.payment.findUnique.mockResolvedValue({ id: paymentId, amount: { toString: () => '12.50' }, currency: 'USD', status: 'PENDING', receivedAt: null });
    transaction.paymentTransaction.create.mockResolvedValue({ id: 'tx-1' });
    transaction.payment.updateMany.mockResolvedValue({ count: 1 });
  });

  it('accepts a valid signature and records the event before applying payment status', async () => {
    const request = signed(event());
    await expect(service.accept(request.rawBody, request.header)).resolves.toEqual({ status: 'accepted' });
    expect(transaction.paymentTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ idempotencyKey: 'webhook/evt_001', verified: true }),
    }));
    expect(transaction.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: paymentId, status: 'PENDING' }, data: expect.objectContaining({ status: 'SUCCEEDED' }) }));
  });

  it('rejects a tampered payload', async () => {
    const request = signed(event());
    const changed = Buffer.from(JSON.stringify({ ...event(), data: { ...event().data, amount: '99.99' } }));
    await expect(service.accept(changed, request.header)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects duplicate event IDs using the persisted unique idempotency key', async () => {
    transaction.paymentTransaction.create.mockRejectedValue({ code: 'P2002' });
    const request = signed(event());
    await expect(service.accept(request.rawBody, request.header)).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.payment.updateMany).not.toHaveBeenCalled();
  });

  it('rejects timestamps outside the five-minute replay window', async () => {
    const request = signed(event(), Math.floor(Date.now() / 1000) - 301);
    await expect(service.accept(request.rawBody, request.header)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
