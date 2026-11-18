# Security Implementation Checklist

Unchecked items remain unimplemented or untested. Mark an item complete only after its protection exists and appropriate test evidence has passed. Installing a library alone is not evidence.

## Threat and control checklist

- [ ] XSS: context-appropriate output encoding, safe rendering, CSP, no unsafe HTML injection; test hostile inputs and CSP behavior.
- [x] CSRF: Nest CSRF protection checks browser request metadata/origin; credentialed CORS and trusted origin are restricted to `WEB_ORIGIN`; auth cookies use SameSite=Lax and Secure in production; e2e test rejects a cross-origin logout request.
- [ ] Insecure uploads: allowlist MIME/extension, verify content, size limits, private safe storage, malware scan where available, authorization on upload/download; test spoofed and oversized files. Student document signature validation, over-limit rejection, private storage, and tenant/ownership checks have unit/API test coverage. Configured ClamAV scans before storage and production requires its executable path; live scanner integration with the deployment image and current signature database remains unverified.
- [ ] Path traversal: normalize names, use safe path/object-key construction, prevent arbitrary file access; test traversal payloads.
- [ ] SSRF: constrain outbound requests/destination URLs, block private/reserved ranges where appropriate, handle redirects safely; test internal IP and redirect bypass attempts.
- [x] Password reset: cryptographically secure hashed tokens, 15-minute expiry, single use, user binding, sibling-token invalidation, session revocation, throttled initiation, and uniform response/timing for known and unknown accounts; covered by reset service/controller/DTO tests. Email delivery uses configured provider environment variables and still requires deployment configuration.
- [ ] Session management: secure HTTP-only cookies, expiry, revocation, rotation, invalidate after sensitive changes; test logout/revocation and fixation scenarios.
- [ ] JWT secrets (if JWTs are used): strong validated secrets, secure storage, expiry and rotation; never hardcode. Prefer server-side session cookies where suitable.
- [ ] CORS: explicit production origins and correct credential policy, no unrestricted wildcard; test denied origins.
- [ ] Rate limiting: login, password reset, API and account-level abuse protections; test thresholds and lockout/recovery behavior.
- [ ] Environment exposure: ignore `.env`, safe `.env.example`, environment separation and startup validation; scan repository/build output for secrets.
- [ ] Default credentials/provisioning: no production defaults or public admin account; secure one-time initial admin process; test provisioning closure.
- [x] Webhooks: raw-body HMAC-SHA256 verification, timing-safe signature comparison, five-minute timestamp window, and persisted event idempotency before payment state changes; four dedicated tests cover valid, tampered, duplicate, and expired requests. Provider-specific signature compatibility requires configuring the deployed provider to the documented `x-payment-signature` contract.
- [ ] Payment trust: backend verifies provider state; trusted provider response and reconciliation only; frontend success is never proof; test forged success and transaction mismatch.
- [ ] IDOR/BOLA and tenant isolation: server-side resource ownership, organization membership and role checks on every route; test cross-user and cross-organization reads/writes and direct URL access.
- [ ] API/input safety: strict DTO/schema validation, normalization, parameterized ORM queries and encoded output; test malformed and over-posted requests.
- [ ] Logging/errors: redact secrets and sensitive data, restrict log access, return safe errors without stack traces; inspect test logs and error responses.
- [ ] Source maps: production source-map policy avoids sensitive public source exposure; verify deployed artifact behavior.
- [x] Password storage: Argon2id implemented with 19 MiB memory, 2 iterations, and 1 lane; hash verification and malformed-hash behavior covered by unit tests. Migration/rehash strategy remains for follow-up.
- [x] Secure headers: API production headers (including HSTS and anti-framing) and frontend nonce CSP configured and verified; see Phase 11 tasks 11.1-11.4 in `docs/development-progress.md`.
- [ ] Least privilege: role/permission and infrastructure/database grants constrained; authorization matrix tested.
- [ ] Audit logs: record login/failure, student changes, allocations, payment and role/permission changes/admin actions; restrict access and protect history from mutation.
- [ ] Database: TLS/connection secret protection, least-privilege accounts, backups and restore procedure tested, migration safety reviewed.
- [ ] Dependency security: vulnerability scanning and remediation process integrated; record scan date and exceptions.
- [ ] Security and authorization tests: unit/integration/API tests for tenant isolation, role boundaries, auth/session, uploads, payment verification, and all listed threat cases.

## Evidence record (fill during implementation)

| Control group | Test/evidence | Status/date | Owner/notes |
|---|---|---|---|
| Secure headers | API `nosniff`, frame denial, referrer and permissions policy; production-only HSTS; nonce-based frontend CSP with rendered nonce check | IMPLEMENTED / TESTED (2026-11-15) | Phase 11 tasks 11.1-11.4; API 229 unit tests and Oxlint; web CSP suite 3 tests, ESLint, typecheck, production build, and HTTP header/nonce check |
| Remaining threat controls | Provider/deployment/infra and unverified threat classes | PARTIAL | Tracked individually as Phase 11 tasks 11.5-11.12 |
| Password storage | Argon2id hash, correct-password verification, wrong-password rejection, malformed-hash rejection | IMPLEMENTED / TESTED (2026-11-15) | `apps/api/src/modules/auth/password-hasher.service.spec.ts`; rehash-on-login policy remains open |
| Session lifecycle | Random opaque token creation, SHA-256-only persistence, absolute and idle expiry, account-state validation, revocation, HttpOnly cookie transport, CSRF checks, active-session guard/current-user route, atomic token rotation, server-checked protected web route and sign-out action | PARTIAL / TESTED (2026-11-15) | API service/guard/e2e specs plus `apps/web/src/lib/authenticated-user.ts` and protected route; broader fixation/concurrency and sensitive-change invalidation tests remain open |
| CSRF | Cross-origin logout rejected; configured frontend origin permitted; session cookie uses HttpOnly/SameSite=Lax and Secure in production | IMPLEMENTED / TESTED (2026-11-15) | `apps/api/test/app.e2e-spec.ts`; CSRF checks and credentialed CORS configured in `apps/api/src/config/http-security.ts` |
| Student document upload controls | Signature mismatch and scanner rejection prevent storage; multipart size and missing-file cases rejected at the API boundary; scanner errors/timeouts fail closed; production requires an absolute executable path | IMPLEMENTED / TESTED (2026-11-15) | API lint/build, 189 unit tests, and 45 e2e tests passed; `apps/api/test/student-document-upload.e2e-spec.ts`; real ClamAV integration with the deployment image and current signature database remains unverified |
| Payment webhooks | Raw-body HMAC-SHA256, timing-safe signature comparison, timestamp replay window, payment detail checks, transactional state transition and unique persisted event key | IMPLEMENTED / TESTED (2026-11-16) | `apps/api/src/modules/finance/payment-webhook.service.spec.ts`: four security cases; controller raw-body forwarding test; full API suite 43 files / 261 tests, lint, no-emit typecheck, and build passed. Live vendor-format integration is not configured |
| Password reset delivery and tokens | Hashed one-time tokens, 15-minute expiry, account binding, sibling-token invalidation after password change, session revocation, uniform throttled request response and timing floor | IMPLEMENTED / TESTED (2026-11-16) | `apps/api/src/modules/auth/password-reset.service.spec.ts`, `password-reset.dto.spec.ts`, and `auth.controller.spec.ts`; four security checks plus controller coverage; full API suite 43 files / 261 tests, lint, no-emit typecheck, and build passed. Provider delivery depends on runtime email configuration |
