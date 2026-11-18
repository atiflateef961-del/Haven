import { describe, expect, it, vi } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { configureHttpSecurity, createSecurityHeaders, resolveTrustedOrigins } from './http-security.js';

describe('HTTP security configuration', () => {
  it('sets baseline browser security headers and continues the request', () => {
    const setHeader = vi.fn();
    const next = vi.fn<NextFunction>();

    createSecurityHeaders(false)(
      {} as Request,
      { setHeader } as unknown as Response,
      next,
    );

    expect(setHeader.mock.calls).toEqual([
      ['X-Content-Type-Options', 'nosniff'],
      ['X-Frame-Options', 'DENY'],
      ['Referrer-Policy', 'no-referrer'],
      ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
    ]);
    expect(next).toHaveBeenCalledOnce();
  });

  it('enables HSTS only in production', () => {
    const setHeader = vi.fn();
    const next = vi.fn<NextFunction>();
    const response = { setHeader } as unknown as Response;

    createSecurityHeaders(true)({} as Request, response, next);

    expect(setHeader).toHaveBeenCalledWith(
      'Strict-Transport-Security',
      'max-age=31536000',
    );
    setHeader.mockClear();
    createSecurityHeaders(false)({} as Request, response, next);
    expect(setHeader).not.toHaveBeenCalledWith(
      'Strict-Transport-Security',
      expect.anything(),
    );
  });

  it('restricts credentialed CORS and CSRF trust to the configured web origin', () => {
    const enableCors = vi.fn();
    const enableCsrfProtection = vi.fn();
    const use = vi.fn();
    const app = {
      enableCors,
      enableCsrfProtection,
      use,
    } as unknown as NestExpressApplication;

    configureHttpSecurity(app, 'https://web.example.test', true);

    expect(enableCors).toHaveBeenCalledWith({
      origin: 'https://web.example.test',
      credentials: true,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    });
    expect(enableCsrfProtection).toHaveBeenCalledWith({
      trustedOrigins: ['https://web.example.test'],
    });
    expect(use).toHaveBeenCalledWith(expect.any(Function));
  });

  it('allows the alternate localhost loopback origin in development only', () => {
    const enableCors = vi.fn();
    const enableCsrfProtection = vi.fn();
    const app = {
      enableCors,
      enableCsrfProtection,
      use: vi.fn(),
    } as unknown as NestExpressApplication;

    configureHttpSecurity(app, 'http://localhost:3000', false);

    const allowedOrigins = enableCors.mock.calls[0]?.[0].origin as string[];
    expect(allowedOrigins).toContain('http://localhost:3000');
    expect(allowedOrigins).toContain('http://127.0.0.1:3000');
    expect(enableCsrfProtection).toHaveBeenCalledWith({ trustedOrigins: allowedOrigins });
  });

  it('adds only local private network addresses in development and no network aliases in production', () => {
    const interfaces = [
      { address: '192.168.1.14', family: 'IPv4' },
      { address: '10.0.0.8', family: 'IPv4' },
      { address: '203.0.113.10', family: 'IPv4' },
      { address: 'fe80::1', family: 'IPv6' },
    ] as const;

    expect(resolveTrustedOrigins('http://localhost:3000', false, [...interfaces])).toEqual([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://192.168.1.14:3000',
      'http://10.0.0.8:3000',
    ]);
    expect(resolveTrustedOrigins('http://localhost:3000', true, [...interfaces])).toEqual([
      'http://localhost:3000',
    ]);
  });
});
