# Live-site QA and repair report

## Scope and evidence

- The supplied `SITE_URL` was the placeholder `https://your-website.example.com`; no deployment URL is configured in `.env` or `.env.example`. No external production site was tested.
- A local Next.js and NestJS app was started using the repository's configured database, then inspected in the installed Chromium headless shell at `http://localhost:3000`.
- Headless-browser evidence and screenshots are in `qa-screenshots/`; `inventory.json` records route/network/console/responsive results and `dom/` stores full DOM snapshots. The provided browser run uses Chromium directly over CDP because the repository has no Playwright/Puppeteer package.
- No test login credentials were supplied. Protected pages were confirmed to redirect anonymous visitors to `/login`; authenticated data workflows, role-specific views, logout, and their API requests could not be exercised in the browser.
- The 100-record fictional fixture is generated separately by `node scripts/generate_pakistani_student_fixture.mjs` and saved at `scripts/fixtures/pakistani-students.json`. It was later imported into the configured local QA database under the explicitly approved Round 3 mapping; it is not production data.

## Anonymous route inventory

All pages rendered the sign-in UI after expected redirects. Final browser response was HTTP 200 for `/login`; each protected route returned HTTP 307 to `/login`.

| Requested URL | Final URL | Page title | Components observed | HTTP result | Console/network | Desktop/mobile |
|---|---|---|---|---|---|---|
| `/` | `/login` | Hostel Management System | Login form, theme toggle, password reveal, submit | 307 → 200 | No browser console errors, failed requests, broken images, or 4xx/5xx browser responses | No overflow at 1280px or 375px |
| `/login` | `/login` | Hostel Management System | Login form, theme toggle, password reveal, submit | 200 | No browser console errors, failed requests, broken images, or 4xx/5xx browser responses | No overflow at 1280px or 375px |
| `/dashboard` | `/login` | Hostel Management System | Protected route redirects anonymously | 307 → 200 | Same | No overflow at 1280px or 375px |
| `/hostels` | `/login` | Hostel Management System | Protected route redirects anonymously | 307 → 200 | Same | No overflow at 1280px or 375px |
| `/students` | `/login` | Hostel Management System | Protected route redirects anonymously | 307 → 200 | Same | No overflow at 1280px or 375px |
| `/bookings` | `/login` | Hostel Management System | Protected route redirects anonymously | 307 → 200 | Same | No overflow at 1280px or 375px |
| `/invoices` | `/login` | Hostel Management System | Protected route redirects anonymously | 307 → 200 | Same | No overflow at 1280px or 375px |
| `/my-profile` | `/login` | Hostel Management System | Protected route redirects anonymously | 307 → 200 | Same | No overflow at 1280px or 375px |

## Initial findings before app fixes

| # | Page/component | Severity | Symptom | Root cause | File:line | Fix plan |
|---|---|---|---|---|---|---|
| 1 | Live-site coverage | Blocker (environment) | The requested production site cannot be opened because the provided URL is still `your-website.example.com`; there is no deployment URL in repository configuration. | Missing target URL, not an application defect. | User-provided QA instructions | Complete local browser QA now; production verification requires the actual URL. |
| 2 | Authenticated workflows | Major (test-data dependency) | Login with a test account and authenticated dashboard/CRUD/payment workflows could not be exercised. | No test account credentials were provided or safely discoverable from configuration. | `/login`; authenticated routes under `apps/web/src/app/(protected)/` | Verify anonymous route protection and public interactions locally; request a designated test account for authenticated/live validation. |
| 3 | Registration and password recovery | Major (product gap) | Login page has no registration or self-service recovery action. | Current UI describes administrator-mediated access/recovery; no initiation API or signup flow is present. | `apps/web/src/app/login/page.tsx:100-101` | Keep this explicit gap in the final report; do not invent an unsafe public account-creation policy during visual QA. |
| 4 | Root README | Minor (documentation) | No repository-root `README.md` exists, so the requested separate frontend/backend command guide is absent. | Only generated starter README and API-specific README exist. | `README.md` (missing) | Write the root README with repository-specific frontend/backend commands, prerequisites, environment keys, QA/fixture instructions, and deployment limitations. |

## Browser checks observed

- Login required-field validation blocks an empty submission; both inputs have associated labels.
- Password reveal/hide and theme toggle worked after allowing React hydration to complete. All three visible buttons have readable names.
- The final pass used the locally served production build and Chromium headless shell. Eight requested routes were visited; all resolved through the expected anonymous redirects, with `/login` returning HTTP 200. No console errors/warnings, failed requests, 4xx/5xx responses, or broken image assets were observed.
- Production-build LCP entries were 0.248–0.904 seconds across the tested routes. At 1280px desktop and 375px mobile, all route captures had no horizontal overflow. The login blank-submit, password reveal/hide, theme toggle, input labels, and button labels all passed.
- Screenshots (`*-desktop.png`, `*-mobile.png`), full rendered DOM (`dom/*.html`), and route/network inventory (`inventory.json`) are under `qa-screenshots/`. These are local production-build results; they do not verify a deployed site.
- Authenticated forms, data accuracy, backend XHRs initiated after login, and business mutations remain unverified without a test account. The server-side anonymous `/auth/me` check is not visible as browser XHR.

## Repair and final status

- Added the repository-root `README.md` with distinct frontend/backend command sections, detected pnpm scripts, prerequisites, environment variable names only, repository layout, local browser QA steps, and current limitations.
- Added a deterministic generator for exactly 100 fictional records and a checked-in JSON fixture. The output passed its schema/format/uniqueness validation and repeat-generation hash check. It was imported into the configured QA database during Round 3 after schema migration and written approval.
- No application-code defect was reproduced in the anonymous login and route-protection checks, so no speculative application patch was made.
- Outstanding acceptance blockers: provide the actual deployed `SITE_URL` and a designated low-privilege QA account through the approved secret channel. Authenticated CRUD, logout, API-backed data accuracy, protected page interactions, and live deployment performance/security remain unverified. The login has no public self-registration or self-service recovery flow; account creation/recovery is administrator-mediated.

## Live + authenticated run

### Environment and coverage

| Check | Result | Evidence / blocker |
|---|---|---|
| Live target configured | BLOCKED | `LIVE_SITE_URL` was absent from the local process environment. No live URL was opened. |
| QA account configured | BLOCKED | `QA_USER` and `QA_PASS` were absent. Credential values were never printed or written. |
| Live render, navigation, visual, forms, API, data accuracy, performance, accessibility | BLOCKED | Requires the deployed URL; there are no live before/after screenshots. Prior local-production results remain in `qa-screenshots/inventory.json`. |
| Authenticated pages, role UI, session persistence, logout, anonymous redirects | BLOCKED | Requires the designated QA account and live target. |
| Seeded records visible on the live list and detail pages | BLOCKED | The fixture is in the configured local database, but live page visibility still requires `LIVE_SITE_URL`, `QA_USER`, and `QA_PASS`. |

### Database fixture insertion

| Check | Result | Evidence / blocker |
|---|---|---|
| Database and ORM detected | PASS | Prisma 7.10.1 / PostgreSQL. `prisma migrate status` reports schema up to date after applying `20261116000000_add_student_fixture_source_status`. |
| StudentStatus values and storage | PASS | Before migration: DB enum and Prisma enum values were `ACTIVE`, `INACTIVE`, `SUSPENDED`, `GRADUATED`; API Zod enum mirrored them. After migration, both DB and Prisma also include `PROBATION`, `LEAVE_OF_ABSENCE`; API Zod accepts both. |
| Fixture mapped and imported atomically | PASS | Added nullable Student fields and nullable `source_status`; created QA organization `QA Test University (Do Not Use In Production)` (`d0c20db9-fda0-4cf8-9846-ca7c39998924`). The seed script creates the organization and inserts the full fixture in one transaction using composite `ON CONFLICT DO NOTHING` on `(studentNumber,email,phone,nationalId)`. |
| Independent SQL count | PASS | `SELECT COUNT(*) FROM "Student" WHERE "organizationId" = 'd0c20db9-fda0-4cf8-9846-ca7c39998924'::uuid` returned **100**. |
| Source status preservation | PASS | SQL status counts: `ACTIVE`/`Active` 38; `PROBATION`/`Probation` 20; `SUSPENDED`/`Suspended` 14; `LEAVE_OF_ABSENCE`/`Leave of Absence` 14; `GRADUATED`/`Graduated` 14. |
| Three-record field round-trip | PASS | Seed transaction checked 3 randomly selected rows across every fixture field; independent query below captures 3 complete rows with every Student column. |
| Live page visibility | BLOCKED | The database import is local. No live target or QA login credentials are configured; list/detail visibility and image HTTP loads remain unverified. |

No failed-row insert occurred. An initial interactive `prisma migrate dev --create-only` attempt was rejected because this agent runs non-interactively and wrote no migration; Prisma `migrate diff` then generated the reviewed SQL from the configured database to the approved schema. API build, lint, and all 226 unit tests passed. Git is not initialized in this workspace, so no commit SHA exists; migration filename is the evidence reference. The prepared reverse SQL is `apps/api/prisma/rollbacks/20261116000000_add_student_fixture_source_status.rollback.sql`.

#### Independent SELECT sample rows (all Student columns)

```json
[
  {
    "id": "a14aa342-f6ff-42bc-8f95-fc3089a95671",
    "organizationId": "d0c20db9-fda0-4cf8-9846-ca7c39998924",
    "userId": null,
    "studentNumber": "PK2023-00092",
    "firstName": "Rehman",
    "lastName": "Farooqi",
    "email": "rehman.farooqi@uni.edu.pk",
    "phone": "+92 334 9868868",
    "dateOfBirth": "2004-08-10T00:00:00.000Z",
    "archivedAt": null,
    "createdAt": "2026-11-15T13:22:19.176Z",
    "updatedAt": "2026-11-15T13:22:19.176Z",
    "educationInstitution": null,
    "educationProgram": "BS Urdu",
    "educationYear": "2nd Year",
    "status": "ACTIVE",
    "bio": "2nd Year BS Urdu student from Sahiwal who enjoys chess.",
    "enrollmentDate": "2023-08-10T00:00:00.000Z",
    "fatherName": "Anas Farooqi",
    "gender": "Male",
    "homeAddress": "House 80, Street 14, Block E, Iqbal Town, Sahiwal, Punjab 57000",
    "nationalId": "36275-2436758-3",
    "profilePhotoUrl": "https://i.pravatar.cc/150?u=rehman.farooqi@uni.edu.pk",
    "source_status": "Active"
  },
  {
    "id": "eae3a690-4564-4e52-a4ec-20a7cb1d76a9",
    "organizationId": "d0c20db9-fda0-4cf8-9846-ca7c39998924",
    "userId": null,
    "studentNumber": "PK2019-00063",
    "firstName": "Saad",
    "lastName": "Ansari",
    "email": "saad.ansari@uni.edu.pk",
    "phone": "+92 307 3754274",
    "dateOfBirth": "2002-08-28T00:00:00.000Z",
    "archivedAt": null,
    "createdAt": "2026-11-15T13:22:19.176Z",
    "updatedAt": "2026-11-15T13:22:19.176Z",
    "educationInstitution": null,
    "educationProgram": "BS Mathematics",
    "educationYear": "1st Year",
    "status": "ACTIVE",
    "bio": "1st Year BS Mathematics student from Multan who enjoys chess.",
    "enrollmentDate": "2019-08-28T00:00:00.000Z",
    "fatherName": "Fahad Ansari",
    "gender": "Male",
    "homeAddress": "House 50, Street 30, Block C, Iqbal Town, Multan, Punjab 60000",
    "nationalId": "39929-1257508-5",
    "profilePhotoUrl": "https://i.pravatar.cc/150?u=saad.ansari@uni.edu.pk",
    "source_status": "Active"
  },
  {
    "id": "b5fac1f5-41d6-45c8-86bd-75e506147cfe",
    "organizationId": "d0c20db9-fda0-4cf8-9846-ca7c39998924",
    "userId": null,
    "studentNumber": "PK2023-00047",
    "firstName": "Hafsa",
    "lastName": "Iqbal",
    "email": "hafsa.iqbal@uni.edu.pk",
    "phone": "+92 346 1204539",
    "dateOfBirth": "2005-09-25T00:00:00.000Z",
    "archivedAt": null,
    "createdAt": "2026-11-15T13:22:19.176Z",
    "updatedAt": "2026-11-15T13:22:19.176Z",
    "educationInstitution": null,
    "educationProgram": "BS English",
    "educationYear": "4th Year",
    "status": "SUSPENDED",
    "bio": "4th Year BS English student from Karachi who enjoys poetry.",
    "enrollmentDate": "2023-09-25T00:00:00.000Z",
    "fatherName": "Usman Iqbal",
    "gender": "Female",
    "homeAddress": "House 361, Street 2, Block D, Cantt Area, Karachi, Sindh 74000",
    "nationalId": "47198-3043621-6",
    "profilePhotoUrl": "https://i.pravatar.cc/150?u=hafsa.iqbal@uni.edu.pk",
    "source_status": "Suspended"
  }
]
```
