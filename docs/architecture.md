# Hostel Management System — Phase 0 Architecture

## Inspection report

**Inspection date:** 2026-11-14 (America/Los_Angeles)  
**Workspace:** `D:\Hostel_Application`

The workspace contains no project files or directories. There is no `.git` directory, package manifest, lockfile, source code, test suite, environment file, or existing implementation to preserve. The two user-provided specification files are byte-for-byte equivalent (50,600 characters each).

Environment probes:

| Tool | Result |
|---|---|
| Node.js | v24.19.0 |
| npm | 11.17.0 |
| pnpm | Not found on PATH |
| PostgreSQL `psql` | Not found on PATH |
| Docker | Not found on PATH |

No project dependency/framework versions can be reported because the repository has no dependencies. Phase 1 should select and pin compatible supported versions, install/configure pnpm, and establish PostgreSQL availability before schema/migration work. This is an environment observation, not an installation or a claim that services cannot exist elsewhere.

## Recommended architecture

Use a TypeScript pnpm monorepo with two deployable applications and small shared packages:

- `apps/web`: Next.js App Router frontend. Server-render pages by default; use client components only for interactive controls, motion, and stateful browser behavior. Frontend validation improves usability but is not an authorization boundary.
- `apps/api`: NestJS REST API. Keep business rules in feature services, validate request DTOs at the boundary, guard every protected route, and document endpoints with Swagger/OpenAPI.
- `apps/api/prisma`: PostgreSQL schema and migrations. Prisma owns relational persistence and transaction boundaries.
- `packages/shared-types`: only stable API contracts/enums safe to share; never share server-only authorization or secret-bearing code into the browser bundle.
- `packages/typescript-config`, `packages/eslint-config`: shared build/lint configuration only when duplication justifies it.

Start as a modular monolith; do not introduce microservices, Redis, a second database, or a payment/email/push provider without a specific requirement and an explicit architecture rationale. PostgreSQL is authoritative. Provider integrations remain sandbox/configuration-gated and payment state is established only after trusted server-side verification.

### Request and trust boundaries

1. Browser -> Next.js web UI -> REST API. The API is the authority for identity, authorization, tenant scope, validation, and business state.
2. Authentication uses Argon2id password hashing and secure HTTP-only browser session cookies where appropriate. Session records permit expiry and revocation. Never send secrets to client code.
3. The API derives the caller's organization/hostel permissions from the authenticated identity and membership records. A submitted organization ID is a selector at most, never proof of access.
4. Each organization-owned record has explicit organization ownership or is scoped through a validated parent relation. Services apply tenant and resource ownership predicates on every read/write; cross-tenant access tests are required.
5. Mutations spanning related records (especially bed allocations, check-in/out, invoice/payment reconciliation) use database transactions and idempotency where relevant. Bed capacity/active allocation invariants must also be enforced by database constraints/indexes where PostgreSQL permits.
6. Uploads are validated and stored outside the public web root using private object storage or a documented local development adapter. Downloads are authorized through the API.
7. Audit events cover security- and business-sensitive actions; logs redact secrets and sensitive personal/payment data.

### Module boundaries

Backend modules should follow domain ownership: auth/sessions, organizations/memberships/roles, hostels/buildings/floors/rooms/beds, students/documents/guardians, bookings/allocations/check-in/out, invoices/payments/payment transactions, staff/attendance, visitors, complaints/maintenance, mess/meals, announcements/notifications/leave, reports/exports, uploads, audit logs, and health/configuration. Cross-domain workflows call application services within the modular monolith and use explicit transaction boundaries; avoid circular dependencies.

Frontend feature folders mirror user workflows, while shared UI/layout components remain domain-neutral. Sidebar visibility is role-aware for usability; the API independently enforces every permission on direct URL/API access.

## Proposed complete repository structure

This is the planned target (not created as application code in Phase 0). Keep only files a module actually needs; do not add empty placeholder modules.

```text
hostel-management-system/
├── apps/
│   ├── web/
│   │   ├── public/
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (public)/{login,register,forgot-password,reset-password,terms,privacy}/
│   │       │   └── (dashboard)/{dashboard,hostels,buildings,rooms,students,bookings,allocations,payments,invoices,staff,attendance,visitors,maintenance,complaints,mess,reports,notifications,roles,audit-logs,settings}/
│   │       ├── components/{ui,layout,navigation,forms,tables,charts,modals,shared}/
│   │       ├── features/{auth,dashboard,hostels,students,rooms,bookings,payments,reports}/
│   │       ├── hooks/
│   │       ├── lib/motion.ts
│   │       ├── providers/
│   │       ├── styles/
│   │       ├── types/
│   │       └── middleware.ts
│   └── api/
│       ├── prisma/{schema.prisma,migrations/,seed/}
│       └── src/
│           ├── common/{decorators,guards,filters,interceptors,pipes,middleware,utils}/
│           ├── config/
│           ├── database/
│           ├── modules/{auth,users,organizations,roles,hostels,buildings,floors,rooms,beds,students,bookings,allocations,payments,invoices,staff,attendance,visitors,maintenance,complaints,mess,notifications,reports,uploads,audit-logs}/
│           ├── app.module.ts
│           └── main.ts
├── packages/{shared-types,eslint-config,typescript-config}/
├── docs/{architecture,database-design,api-documentation,ui-guidelines,animation-guidelines,security-checklist,testing-strategy,development-progress,requirements-traceability}.md
├── infra/{docker,nginx}/
├── scripts/
├── .env.example
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## Deployment and operations direction

Keep web and API independently buildable/deployable while sharing one versioned repository. Use environment validation, explicit CORS origins, secure headers, rate limits, production-safe source-map policy, least-privilege database credentials, encrypted transport, backups/restore procedure, dependency scanning, and structured redacted logs. Deployment topology, object storage, email provider, payment provider, and production secrets remain decisions for the relevant implementation task; none are configured in this empty workspace.

## Phase 0 exit boundary

This phase produces planning documents only. No Next.js/NestJS app, database schema/migration, dependency installation, environment configuration, or runtime scaffolding has been added. Phase 1 requires explicit user approval after review.
