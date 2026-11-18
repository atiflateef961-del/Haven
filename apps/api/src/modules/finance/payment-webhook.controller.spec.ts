import { PaymentWebhookService } from './payment-webhook.service.js';
import { PaymentWebhookController } from './payment-webhook.controller.js';

describe('PaymentWebhookController', () => {
  it('passes the raw request body and signature header to the verifier', async () => {
    const webhooks = { accept: vi.fn().mockResolvedValue({ status: 'accepted' }) };
    const controller = new PaymentWebhookController(webhooks as unknown as PaymentWebhookService);
    const rawBody = Buffer.from('{"id":"evt"}');
    await expect(controller.accept({ rawBody } as never, 't=1234567890,v1=signature')).resolves.toEqual({ status: 'accepted' });
    expect(webhooks.accept).toHaveBeenCalledWith(rawBody, 't=1234567890,v1=signature');
  });
});
