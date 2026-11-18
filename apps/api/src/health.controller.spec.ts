import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('reports that the API process is live', () => {
    expect(new HealthController().getLiveness()).toEqual({ status: 'ok' });
  });
});
