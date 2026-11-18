# Testing Strategy (Planned)

Testing begins with implementation tasks; no application tests were run in Phase 0 because no application or test setup exists. Add tests alongside the feature and run relevant checks before declaring that task done.

- **Frontend:** TypeScript, ESLint, unit/component tests for validation and states, accessibility/keyboard checks, API contract/error handling, responsive viewport review, and production build when appropriate.
- **Backend:** unit tests for domain services/authorization, controller/DTO validation tests, PostgreSQL integration tests for constraints/transactions, API integration tests, and Swagger contract review.
- **Cross-cutting security:** tenant isolation and role matrix across routes; IDOR/BOLA; session lifecycle/reset; upload validation and private download authorization; payment signature/idempotency/forgery; CSRF/CORS/rate limits; safe logging/errors.
- **Critical database race:** concurrent allocation attempts for one bed/student must leave no duplicate active allocation. Webhook replay must not double-apply payment.
- **End to end:** role-based workflows from login through student/room booking, approval/allocation/check-in, invoice/payment, operations, notification and reporting. Exercise empty, loading, success, failure and disabled states.
- **Final QA:** unit/integration/E2E, frontend and backend production builds, type checks, lint, accessibility, responsive/no-overflow, dependency/security checks, deployment/env documentation, and evidence for each final acceptance criterion.

Do not disable or skip failing checks to obtain a pass. Record command, result, and resolved failure in each task report. Scope and tool choice for test dependencies will be decided when Phase 1 is approved.
