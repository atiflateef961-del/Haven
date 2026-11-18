import cookieParser from 'cookie-parser';
import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

export function createSecurityHeaders(isProduction: boolean) {
  return (_request: Request, response: Response, next: NextFunction): void => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    if (isProduction) {
      response.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000',
      );
    }
    next();
  };
}

export function resolveTrustedOrigins(
  webOrigin: string,
  isProduction: boolean,
  interfaces: Array<Pick<NetworkInterfaceInfo, 'address' | 'family'>> = Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? []),
): string[] {
  const configuredOrigin = new URL(webOrigin);
  const origins = new Set([configuredOrigin.origin]);
  if (isProduction) return [...origins];

  if (configuredOrigin.hostname === 'localhost' || configuredOrigin.hostname === '127.0.0.1') {
    configuredOrigin.hostname = configuredOrigin.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
    origins.add(configuredOrigin.origin);
  }

  for (const networkInterface of interfaces) {
    if (networkInterface.family !== 'IPv4') continue;
    const octets = networkInterface.address.split('.').map(Number);
    const [first, second] = octets;
    const isPrivateIpv4 = first === 10 || first === 127 || first === 169 && second === 254 ||
      first === 192 && second === 168 || first === 172 && second !== undefined && second >= 16 && second <= 31;
    if (octets.length !== 4 || !isPrivateIpv4) continue;
    const localOrigin = new URL(webOrigin);
    localOrigin.hostname = networkInterface.address;
    origins.add(localOrigin.origin);
  }

  return [...origins];
}

export function configureHttpSecurity(
  app: NestExpressApplication,
  webOrigin: string,
  isProduction = false,
): void {
  const allowedOrigins = resolveTrustedOrigins(webOrigin, isProduction);
  app.enableCors({
    origin: allowedOrigins.length === 1 ? webOrigin : allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.use(createSecurityHeaders(isProduction));
  app.enableCsrfProtection({ trustedOrigins: allowedOrigins });
  app.use(cookieParser());
}
