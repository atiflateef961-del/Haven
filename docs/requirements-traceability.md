# Requirement Traceability Matrix

Phase 0 planning index for the complete supplied specification (Parts 1–20). “Planned” entries describe intended implementation/evidence; they are not claims of completion.

| Requirement | Planned implementation area | Phase | Acceptance evidence |
|---|---|---:|---|
| Objective: multi-hostel operations, secure scalable system (Part 1) | Architecture; all domain modules | 1–12 | End-to-end acceptance matrix |
| Next.js, TS, Tailwind, Framer, Lucide, RHF/Zod, TanStack Query as appropriate (Part 2) | `apps/web`; keep dependencies justified | 1–4 | Build/type/lint; interaction/API checks |
| NestJS REST, Prisma, DTO/guards/decorators, Swagger (Part 2) | `apps/api` | 1 onward | API docs, validation/auth tests |
| PostgreSQL primary; transactions; no Mongo/Firebase second DB (Part 2) | API Prisma schema and services | 1, 5, 7–9 | PostgreSQL migrations and concurrency tests |
| Tenant isolation, scoped permissions, secure org switching (Part 3) | Identity/membership model and every API service | 3, 5, 11 | Cross-tenant negative tests |
| Seven roles and server-side permissions (Part 4) | Membership, roles/permissions, guards | 3, 11 | Role matrix and direct-endpoint tests |
| Role-specific live dashboard data (5.1) | Dashboard API and UI | 4 | Aggregates reconcile with DB fixtures |
| Hostel/building/floor management (5.2–5.3) | Hostels/buildings/floors modules | 5 | CRUD, ownership, validation tests |
| Rooms/beds and no duplicate active allocation (5.4) | Room/bed/allocation transaction + DB constraint | 5, 7, 11 | Concurrent allocation test proves invariant |
| Student info/documents/guardian/history/status (5.5) | Students, documents, guardians | 6 | Access/privacy/upload checks |
| Booking, approval, allocation, transfer/check-in/out (5.6) | Booking/allocation workflow | 7 | State transition and rollback tests |
| Fees, invoices, payments, trusted provider verification (5.7) | Finance/payment adapter and reconciliation | 8, 11 | Forged frontend/webhook tests, receipts |
| Staff profiles/roles/hostels/schedules/tasks (5.8) | Staff module | 9 | Assignment authorization tests |
| Student/staff attendance and reports (5.9) | Attendance module | 9–10 | Date/tenant/report tests |
| Visitor request/approval/log/check-in/out (5.10) | Visitors module | 9 | Warden/student authorization tests |
| Complaints, maintenance assignment/status/history (5.11) | Complaints and maintenance modules | 9 | Workflow and ownership tests |
| Meal schedules/preferences/attendance/charges (5.12) | Mess module | 9 | CRUD/attendance/charge tests |
| Reports and PDF/CSV exports (5.13) | Reports/export module | 10 | Permission and output correctness tests |
| In-app/email notifications, reminders, announcements (5.14) | Notifications and provider adapters | 10 | Delivery/config and permission checks |
| Profile/hostel/user/notification/theme/security/system settings (5.15) | Settings/profile modules and UI | 2–4 | Persisted settings and authorization tests |
| Audit events and restricted audit viewing (5.16) | Audit module/interceptors/domain services | 3 onward | Event completeness and access tests |
| Dark/light tokenized premium design (6.1–6.2) | `ui-guidelines.md`; web styles | 2 | Visual/theme/contrast checks |
| Ambient layer, glass/neumorphic surfaces, accessible buttons (6.3–6.6) | Design system components | 2 | Reduced motion, fallback, component state/a11y checks |
| Typography (6.7) | Fonts/tokens | 2 | Font loading/hierarchy review |
| Functional permission-aware sidebar (7) | Dashboard layout/navigation and API guards | 2, 4 | Each route/link works; unauthorized direct access denied |
| Central motion tokens/library, placement, resources, budget (8) | `animation-guidelines.md`, `web/src/lib/motion.ts` | 2 | Motion/reduced-motion/perf-budget checks |
| Responsive layout/overflow (9) | Shared layout and feature pages | 2 onward | Mobile/tablet/desktop viewport audit |
| Private auth, Argon2id, secure sessions (10) | Auth module and public pages | 3 | Auth/session security tests |
| Terms and privacy pages (11) | Public routes; policy content review | 2–3 | Routes render and content is approved |
| Vulnerability controls and security verification (12) | `security-checklist.md`, API/web/infrastructure | 3, 11–12 | Each checklist item has a passing evidence record |
| Normalized entities, keys/indexes/deletes/tenant ownership (13) | `database-design.md`, Prisma schema | 1, 5–10 | Migration/schema review and DB tests |
| Monorepo target structure (14) | `architecture.md` | 1 | Structure created only after approval |
| Phases 0–12 and acceptance gates (15) | `development-progress.md` | 0–12 | Phase evidence and approval trail |
| One task at a time, review-plan-implement-test-report-approval (16) | Every work task | All | Task report and user approval before next task |
| Quality rules (17) | Code review/task implementation | All | Review, static checks, tests, no fake data/inert flows |
| All visible controls functional and states accessible (18) | Every UI feature | 2 onward | Keyboard/click/form/API/empty/error/loading verification |
| Performance and scalable modular monolith (19) | Query design, frontend loading, animation budgets | 1–12 | Query/build/bundle/viewport evidence |
| Final acceptance criteria (20) | System-wide | 12 | Each criterion mapped to evidence, incomplete clearly stated |

Trace status at Phase 0: all runtime requirements are **planned / unimplemented**. Only repository inspection and planning documents are complete.
