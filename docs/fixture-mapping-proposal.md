# Fixture-to-Student mapping proposal

**Status: applied to the configured local database.** The implementation follows the approved mapping in sections Aâ€“D below. The migration is `20261116000000_add_student_fixture_source_status`; the QA organization ID is `d0c20db9-fda0-4cf8-9846-ca7c39998924`; the independent Student count is 100. Track 2 live/authenticated verification remains blocked by missing live URL and QA account environment variables.

## Schema discovery (read-only)

The ORM is **Prisma 7.10.1** with PostgreSQL and the Prisma `prisma-client` generator. The API package scripts define the migration commands:

```powershell
# Local development: create/apply a migration and regenerate the client
corepack pnpm --filter @hms/api db:migrate:dev

# Deploy checked-in migrations in a deployment environment
corepack pnpm --filter @hms/api db:migrate:deploy
```

The relevant checked-in model is `apps/api/prisma/schema.prisma`. The descriptions below reflect the live local PostgreSQL catalog's column types/nullability and indexes, plus Prisma's declared relations. `NOT NULL` and `NULL` are database nullability; Prisma `@default(uuid())` is client-side and does not create a PostgreSQL column default.

### Organization

| Column | PostgreSQL type | Nullable | Default / constraint |
|---|---|---:|---|
| `id` | uuid | No | Prisma-generated UUID; primary key |
| `name` | varchar(160) | No | â€” |
| `slug` | varchar(80) | No | Unique index `Organization_slug_key` |
| `timezone` | varchar(64) | No | `'UTC'` |
| `currency` | char(3) | No | `'USD'` |
| `createdAt` | timestamptz(6) | No | `CURRENT_TIMESTAMP` |
| `updatedAt` | timestamptz(6) | No | Set by Prisma `@updatedAt`; no database default |
| `archivedAt` | timestamptz(6) | Yes | â€” |

Indexes/constraints: primary key on `id`; unique `slug`. No foreign keys on Organization.

### Student

| Column | PostgreSQL type | Nullable | Default / constraint |
|---|---|---:|---|
| `id` | uuid | No | Prisma-generated UUID; primary key |
| `organizationId` | uuid | No | FK to `Organization(id)`, `ON DELETE RESTRICT` |
| `userId` | uuid | Yes | Unique index `Student_userId_key`; FK to `User(id)`, `ON DELETE RESTRICT` |
| `studentNumber` | varchar(60) | No | â€” |
| `firstName` | varchar(100) | No | â€” |
| `lastName` | varchar(100) | No | â€” |
| `email` | varchar(320) | Yes | â€” |
| `phone` | varchar(32) | Yes | â€” |
| `dateOfBirth` | date | Yes | â€” |
| `educationInstitution` | varchar(180) | Yes | â€” |
| `educationProgram` | varchar(180) | Yes | â€” |
| `educationYear` | varchar(40) | Yes | â€” |
| `fatherName` | varchar(160) | Yes | Added by fixture migration |
| `gender` | varchar(20) | Yes | Added by fixture migration |
| `nationalId` | varchar(15) | Yes | Added by fixture migration |
| `homeAddress` | varchar(500) | Yes | Added by fixture migration |
| `profilePhotoUrl` | varchar(500) | Yes | Added by fixture migration |
| `bio` | text | Yes | Added by fixture migration |
| `enrollmentDate` | date | Yes | Added by fixture migration |
| `source_status` | text | Yes | Added by fixture migration; stores the original fixture label |
| `status` | enum `StudentStatus` | No | `'ACTIVE'`; values now `ACTIVE`, `INACTIVE`, `SUSPENDED`, `GRADUATED`, `PROBATION`, `LEAVE_OF_ABSENCE` |
| `archivedAt` | timestamptz(6) | Yes | â€” |
| `createdAt` | timestamptz(6) | No | `CURRENT_TIMESTAMP` |
| `updatedAt` | timestamptz(6) | No | Set by Prisma `@updatedAt`; no database default |

Indexes/constraints: primary key `id`; unique `(organizationId, studentNumber)`; unique nullable `userId`; unique composite `(studentNumber, email, phone, nationalId)` named `Student_fixture_identity_key`; non-unique index `(organizationId, lastName, firstName)`. `organizationId` and optional `userId` foreign keys both use `ON DELETE RESTRICT` and `ON UPDATE CASCADE`.

### Related hostel/allocation models

Student has no direct Hostel, Building, Floor, Room, or Bed foreign key. It is tenant-linked directly through `Student.organizationId`; a room/bed connection is indirect through `BedAllocation.studentId -> Student.id` and `BedAllocation.bedId -> Bed.id -> Room.id -> Floor.id -> Building.id -> Hostel.id`.

| Model | Columns (`column: type [NULL/NOT NULL]`) | Foreign keys | Unique/index constraints |
|---|---|---|---|
| `Hostel` | `id: uuid [NOT NULL]`; `organizationId: uuid [NOT NULL]`; `name: varchar(160) [NOT NULL]`; `code: varchar(40) [NOT NULL]`; `address: varchar(500) [NULL]`; `createdAt: timestamptz(6) [NOT NULL]`; `updatedAt: timestamptz(6) [NOT NULL]`; `archivedAt: timestamptz(6) [NULL]` | `organizationId -> Organization(id)`, RESTRICT | PK `id`; unique `(organizationId, code)`; indexes `(organizationId, name)` and `(organizationId, archivedAt, name)` |
| `Building` | `id: uuid [NOT NULL]`; `hostelId: uuid [NOT NULL]`; `name: varchar(120) [NOT NULL]` | `hostelId -> Hostel(id)`, RESTRICT | PK `id`; unique `(hostelId, name)` |
| `Floor` | `id: uuid [NOT NULL]`; `buildingId: uuid [NOT NULL]`; `number: integer [NOT NULL]` | `buildingId -> Building(id)`, RESTRICT | PK `id`; unique `(buildingId, number)` |
| `Room` | `id: uuid [NOT NULL]`; `floorId: uuid [NOT NULL]`; `number: varchar(40) [NOT NULL]`; `roomType: varchar(60) [NULL]`; `description: varchar(500) [NULL]`; `archivedAt: timestamptz(6) [NULL]` | `floorId -> Floor(id)`, RESTRICT | PK `id`; unique `(floorId, number)`; index `(floorId, archivedAt, number)` |
| `Bed` | `id: uuid [NOT NULL]`; `roomId: uuid [NOT NULL]`; `label: varchar(40) [NOT NULL]`; `isActive: boolean [NOT NULL]`, default `true` | `roomId -> Room(id)`, RESTRICT | PK `id`; unique `(roomId, label)`; index `(roomId, isActive)` |
| `BedAllocation` | `id: uuid [NOT NULL]`; `bookingId: uuid [NULL]`; `studentId: uuid [NOT NULL]`; `bedId: uuid [NOT NULL]`; `status: enum AllocationStatus [NOT NULL]`, default `ACTIVE`; `startsAt: timestamptz(6) [NOT NULL]`; `endsAt: timestamptz(6) [NULL]`; `endedAt: timestamptz(6) [NULL]`; `createdAt: timestamptz(6) [NOT NULL]`, default `CURRENT_TIMESTAMP` | `bookingId -> Booking(id)`, `studentId -> Student(id)`, `bedId -> Bed(id)`, all RESTRICT | PK `id`; indexes `(studentId, startsAt)`, `(bedId, startsAt)`; GiST exclusion constraints prevent overlapping active time ranges per bed and per student |

The related models do not need rows for this student-only fixture. The proposal creates no Hostel/Building/Floor/Room/Bed/allocation records.

## A. Fixture â†’ Student column mapping

| Fixture field | Existing column? | Proposed action |
|---|---|---|
| `student_id` | Yes: `studentNumber` (`varchar(60) NOT NULL`) | Map to `studentNumber`; it is currently unique only together with `organizationId`. |
| `full_name` | Partly: `firstName` and `lastName` (`varchar(100) NOT NULL` each) | Split the fixture's exactly two whitespace-separated tokens: token 1 â†’ `firstName`, token 2 â†’ `lastName`. |
| `father_name` | No | NEW column needed: `fatherName varchar(160) nullable=YES`; keep separate from Guardian because this fixture has no guardian phone, which the Guardian model requires. |
| `date_of_birth` | Yes: `dateOfBirth` (`date NULL`) | Direct insert as a date. |
| `gender` | No | NEW column needed: `gender varchar(20) nullable=YES`; fixture values are `Male`/`Female`; no gender enum exists. |
| `grade_year` | Yes: `educationYear` (`varchar(40) NULL`) | Direct insert. |
| `major` | Yes: `educationProgram` (`varchar(180) NULL`) | Direct insert. |
| `email` | Yes: `email` (`varchar(320) NULL`) | Direct insert. Existing column is not independently unique. |
| `phone` | Yes: `phone` (`varchar(32) NULL`) | Direct insert. Existing column is not independently unique. |
| `cnic` | No | NEW column added: `nationalId varchar(15) nullable=YES`; retains fixture punctuation. |
| `home_address` | No | NEW column needed: `homeAddress varchar(500) nullable=YES`. |
| `profile_photo_url` | No | NEW column added: `profilePhotoUrl varchar(500) nullable=YES`; stores the QA fixture's external `pravatar.cc` URL. |
| `bio` | No | NEW column needed: `bio text nullable=YES`. |
| `enrollment_date` | No | NEW column needed: `enrollmentDate date nullable=YES`. |
| `status` | Yes: `status` (`StudentStatus NOT NULL`) plus NEW `source_status text nullable=YES` | Preserve the original label in `source_status`; map 1:1: `Active` â†’ `ACTIVE`, `Probation` â†’ `PROBATION`, `Suspended` â†’ `SUSPENDED`, `Leave of Absence` â†’ `LEAVE_OF_ABSENCE`, `Graduated` â†’ `GRADUATED`. |
| `organization_id` | Required existing FK: `organizationId` (`uuid NOT NULL`) | **NEW row in Organization table first, then FK on every student.** The FK targets `Organization(id)` and uses `ON DELETE RESTRICT`. The database currently has no Organization row. |

### Remaining live-QA dependency

The Organization and fixture rows do not create a User, membership, or role. To see them in an authenticated student list, the designated QA account must have a least-privilege membership for this organization. That account and the deployed URL are not configured in the local environment, so live visibility remains untested.

## B. Proposed QA Organization row

The import created only this clearly isolated QA tenant; it did not create hostels, rooms, users, financial records, provider settings, or external integrations.

| Field | Proposed value/source |
|---|---|
| `id` | `d0c20db9-fda0-4cf8-9846-ca7c39998924` |
| `name` | `QA Test University (Do Not Use In Production)` |
| `slug` | `qa-test-university-do-not-use-production` (unique) |
| `timezone` | `UTC` |
| `currency` | Existing model/database default `USD` |
| `createdAt` | Database default `CURRENT_TIMESTAMP` |
| `updatedAt` | Set by Prisma `@updatedAt` |
| `archivedAt` | `NULL` |

The row was created with Prisma `Organization.create`; the model's existing currency default was retained. No finance or provider configuration was added.

## C. Applied migration

Migration path: `apps/api/prisma/migrations/20261116000000_add_student_fixture_source_status/migration.sql`.

```sql
-- AlterEnum
ALTER TYPE "StudentStatus" ADD VALUE 'PROBATION';
ALTER TYPE "StudentStatus" ADD VALUE 'LEAVE_OF_ABSENCE';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN "bio" TEXT,
ADD COLUMN "enrollmentDate" DATE,
ADD COLUMN "fatherName" VARCHAR(160),
ADD COLUMN "gender" VARCHAR(20),
ADD COLUMN "homeAddress" VARCHAR(500),
ADD COLUMN "nationalId" VARCHAR(15),
ADD COLUMN "profilePhotoUrl" VARCHAR(500),
ADD COLUMN "source_status" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Student_fixture_identity_key"
  ON "Student" ("studentNumber", "email", "phone", "nationalId");
```

The Prisma model adds the nullable fields shown above, maps `sourceStatus` to DB column `source_status`, and declares the composite unique index. The API Zod enum now accepts both new StudentStatus values. `prisma migrate deploy` applied this migration successfully; `prisma migrate status` reports the DB schema up to date.

## D. Applied seed

The executable seed is [apps/api/scripts/seed_fixture_students.mjs](../apps/api/scripts/seed_fixture_students.mjs). It reads the root `.env` without printing values. The organization create/reuse, 100 insert attempts, count check, and three random round-trip checks are inside one Prisma transaction. The inserts use `ON CONFLICT DO NOTHING` on `(studentNumber, email, phone, nationalId)` backed by `Student_fixture_identity_key`.

The source-to-enum status mapping is lossless because each original label is also stored in nullable `source_status`:

| `source_status` | `Student.status` |
|---|---|
| `Active` | `ACTIVE` |
| `Probation` | `PROBATION` |
| `Suspended` | `SUSPENDED` |
| `Leave of Absence` | `LEAVE_OF_ABSENCE` |
| `Graduated` | `GRADUATED` |

The source distribution was Active 38, Probation 20, Suspended 14, Leave of Absence 14, Graduated 14. The organization ID is `d0c20db9-fda0-4cf8-9846-ca7c39998924`; an independent SQL count returned 100, and three randomly selected records passed all-field round-trip verification. Full sample rows are in `docs/qa-live-report.md`.

## E. Risks and rollback

- All eight new Student columns (`fatherName`, `gender`, `nationalId`, `homeAddress`, `profilePhotoUrl`, `bio`, `enrollmentDate`, `source_status`) are nullable. No existing Student column changed nullability.
- StudentStatus is a PostgreSQL enum. Its original values remain, and `PROBATION` plus `LEAVE_OF_ABSENCE` were appended. Prisma and API validation use the same values.
- The new composite unique index enforces uniqueness of the four-column tuple, not each value independently; this matches the approved conflict target. It is global across organizations.
- The reverse SQL helper is `apps/api/prisma/rollbacks/20261116000000_add_student_fixture_source_status.rollback.sql`. Prisma does not apply down migrations automatically. After confirming no non-QA student uses either new enum value, the manual rollback commands are:

```powershell
corepack pnpm --filter @hms/api exec prisma db execute --schema prisma/schema.prisma --file prisma/rollbacks/20261116000000_add_student_fixture_source_status.rollback.sql
corepack pnpm --filter @hms/api exec prisma migrate resolve --rolled-back 20261116000000_add_student_fixture_source_status
```

The rollback helper removes the specifically named QA organization and its student rows, restores the original four-value enum, and drops the added columns/index. Restrictive foreign keys will abort the rollback if dependent tenant/Student records exist.

## Approval and execution record

The user approved the migration and seed with the exact 1:1 status mapping above. Migration and seed are applied. No git repository is initialized, so there is no commit SHA; the migration filename is the change evidence. The deployed URL and QA credentials remain unavailable, so live/authenticated UI verification remains open.

### Status enum discovery

Before migration, the exact PostgreSQL `StudentStatus` DB enum values were `ACTIVE`, `INACTIVE`, `SUSPENDED`, `GRADUATED`. Prisma declared the same DB enum, and `apps/api/src/modules/students/student-status.dto.ts` defined an API-level Zod enum with those same four literals. The fixture had 20 `Probation` and 14 `Leave of Absence` rows that had no prior enum values; the other fixture labels mapped to existing values.
