const NONCE_PATTERN = /^[A-Za-z0-9+/_=-]+$/;

export function createContentSecurityPolicy({
  nonce,
  apiOrigin,
  isProduction,
}) {
  if (!NONCE_PATTERN.test(nonce)) {
    throw new TypeError('CSP nonce contains unsupported characters');
  }

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProduction ? '' : " 'unsafe-eval'"}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://i.pravatar.cc",
    "font-src 'self' data:",
    `connect-src ${["'self'", apiOrigin].filter(Boolean).join(' ')}${isProduction ? '' : ' ws: wss:'}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  if (isProduction) {
    directives.push('upgrade-insecure-requests');
  }

  return directives.join('; ');
}
