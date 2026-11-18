import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createContentSecurityPolicy } from './csp-policy.mjs';

describe('createContentSecurityPolicy', () => {
  it('allows the request nonce and configured app dependencies without unsafe scripts', () => {
    const policy = createContentSecurityPolicy({
      nonce: 'randomNonce123=',
      apiOrigin: 'https://api.example.test',
      isProduction: true,
    });

    assert.match(policy, /script-src 'self' 'nonce-randomNonce123=' 'strict-dynamic'/);
    assert.match(policy, /connect-src 'self' https:\/\/api\.example\.test/);
    assert.match(policy, /img-src 'self' data: blob: https:\/\/i\.pravatar\.cc/);
    assert.match(policy, /style-src-attr 'unsafe-inline'/);
    assert.match(policy, /frame-ancestors 'none'/);
    assert.match(policy, /upgrade-insecure-requests/);
    assert.doesNotMatch(policy, /script-src[^;]*unsafe-inline/);
    assert.doesNotMatch(policy, /unsafe-eval/);
  });

  it('allows development eval and HMR sockets only outside production', () => {
    const policy = createContentSecurityPolicy({
      nonce: 'devNonce_123',
      apiOrigin: 'http://localhost:4000',
      isProduction: false,
    });

    assert.match(policy, /script-src[^;]*unsafe-eval/);
    assert.match(policy, /connect-src 'self' http:\/\/localhost:4000 ws: wss:/);
    assert.doesNotMatch(policy, /upgrade-insecure-requests/);
  });

  it('rejects a nonce that could inject another CSP directive', () => {
    assert.throws(
      () => createContentSecurityPolicy({
        nonce: "bad'; script-src *",
        apiOrigin: 'https://api.example.test',
        isProduction: true,
      }),
      /unsupported characters/,
    );
  });
});
