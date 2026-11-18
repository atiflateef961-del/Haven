# Haven Hostel Management System

Haven is a multi-tenant hostel management workspace built with Next.js, NestJS, Prisma, and PostgreSQL. It provides authenticated hostel, room, student, booking/allocation, and invoice workflows with organization-scoped API access; production payment-provider callbacks and several daily-operations/reporting modules are still in progress.

## Prerequisites

- Node.js 24 or later.
- pnpm 11.28.0, available through Corepack (`corepack enable`).
- PostgreSQL 16 or later and a database created for the application.
- A root `.env` file based on `.env.example`. Required API keys: `DATABASE_URL`, `NODE_ENV`, and `PORT`. `WEB_ORIGIN` is required in production and identifies the allowed browser origin.
- Private document storage: `STUDENT_DOCUMENT_STORAGE_DIR` is required in production and must point to absolute persistent storage outside the web root.
- Upload malware scanning: `STUDENT_DOCUMENT_SCANNER_PATH` is required in production and must point to an installed ClamAV `clamscan` executable. Development may omit both document settings.
- API upstream for the Next.js same-origin proxy: `NEXT_PUBLIC_API_URL`; production must set it to the API origin. In development it defaults to `http://localhost:4000`. Browser code calls `/api/...` on the frontend origin; the upstream URL is used by server-side code only.

Do not commit `.env`, credentials, session secrets, private document files, or production data. The repository does not currently configure an email provider, payment provider, or production `SITE_URL`.

## Repository layout

```text
apps/web/                 Next.js App Router application
apps/api/                 NestJS REST API and Prisma schema/migrations
apps/api/prisma/           Database schema, migrations, and database checks
packages/typescript-config Shared TypeScript configuration
docs/                     Architecture, API, security, QA, and progress docs
scripts/                   Demo-data generator and local Chromium QA harness
scripts/fixtures/          Fictional 100-record student JSON fixture
qa-screenshots/             Local QA screenshots, DOM snapshots, inventory
```

## Installation

Run these commands from the repository root in Windows PowerShell:

```powershell
corepack enable
corepack pnpm install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

Set `DATABASE_URL` in `.env` to a running PostgreSQL database. Keep the `.env` file private.

## Quick start

This is a pnpm workspace; the root package does not define `npm run dev`. First apply the database migrations and generate Prisma Client:

```powershell
corepack pnpm --filter @hms/api db:validate
corepack pnpm --filter @hms/api db:migrate:deploy
corepack pnpm --filter @hms/api db:generate
```

Start the backend and frontend in **two separate PowerShell windows**, both opened at the repository root.

**Window 1 — backend:**

```powershell
corepack pnpm --filter @hms/api start:dev
```

**Window 2 — frontend:**

```powershell
corepack pnpm --filter @hms/web dev
```

Open <http://localhost:3000>. The API runs at <http://localhost:4000>; its liveness check is <http://localhost:4000/health/live>. You need a PostgreSQL server and a valid `DATABASE_URL` before starting the backend.

## Frontend commands

Run these from the repository root. The web app is in `apps/web` and uses Next.js 16.

```bash
# Start the web development server at http://localhost:3000
corepack pnpm --filter @hms/web dev

# Check lint and TypeScript
corepack pnpm --filter @hms/web lint
corepack pnpm --filter @hms/web typecheck

# Create and serve a production build
corepack pnpm --filter @hms/web build
corepack pnpm --filter @hms/web start
```

Protected pages redirect to `/login` unless an active session cookie is present.

## Frontend and backend commands

Run these from the repository root. The repo requires Node 24+.

```bash
# Start the Next.js web app at http://localhost:3000
corepack pnpm --filter @hms/web dev
```

```bash
# Validate schema, apply checked-in migrations, and generate the client
corepack pnpm --filter @hms/api db:validate
corepack pnpm --filter @hms/api db:migrate:deploy
corepack pnpm --filter @hms/api db:generate

# Start the API development server at http://localhost:4000
corepack pnpm --filter @hms/api start:dev

# Run checks
corepack pnpm --filter @hms/api lint
corepack pnpm --filter @hms/api build
corepack pnpm --filter @hms/api test
corepack pnpm --filter @hms/api test:e2e
```

The liveness endpoint is `GET /health/live`. API routes are under `/api/v1`.

## Generate fictional QA data

The deterministic generator uses seed `20261115` and writes exactly 100 fictional Pakistani student records. It validates all 15 fields, required values, format relationships, region/gender CNIC digits, mobile prefixes, age at enrollment, and unique identifiers.

```bash
node scripts/generate_pakistani_student_fixture.mjs
```

Output: `scripts/fixtures/pakistani-students.json`. This dataset is fictional QA data. Its importer maps the fixture into the Student model, retains original labels in `source_status`, and creates a clearly named QA organization. Do not use the importer with a production database.

To apply the checked-in schema migration and import the fixture into the configured QA database, run from the repository root:

```powershell
corepack pnpm --filter @hms/api db:migrate:deploy
corepack pnpm --filter @hms/api db:generate
corepack pnpm --filter @hms/api build
node apps/api/scripts/seed_fixture_students.mjs
```

The importer wraps organization creation/reuse, all 100 insert attempts, count verification, and three sampled field round-trips in one transaction. The target is `QA Test University (Do Not Use In Production)`.

## Local browser QA

`scripts/run_local_browser_qa.mjs` captures routes, DOM snapshots, console/network events, screenshots at 1280px and 375px, and login-page interactions through the Chrome DevTools Protocol. It requires the web app running at `http://localhost:3000` and Chromium headless shell listening on port `9222`.

Set `QA_SITE_URL` to the local site origin and run:

```bash
$env:QA_SITE_URL = 'http://localhost:3000'
node scripts/run_local_browser_qa.mjs
```

Screenshots, DOM snapshots, and inventory JSON are saved under `qa-screenshots/`. The report at `docs/qa-live-report.md` records which checks were possible. A production-site run still needs a real deployment URL and a designated test account; never place credentials in the repository or screenshots.

## Current limitations

- No production website URL is configured in the repository.
- No QA login credentials are supplied, so the documented browser run verifies anonymous protection and public login interactions, not authenticated workflows.
- Public self-registration is available from the login screen and creates a new organization account. Password recovery remains administrator-mediated.
- Production online payment-provider integration, refunds, financial reporting, several operations modules, and final deployment validation remain in progress. Do not treat local build/test success as production acceptance.

 corepack pnpm --filter @hms/web dev

corepack pnpm --filter @hms/api start:dev