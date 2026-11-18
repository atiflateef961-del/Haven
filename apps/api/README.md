# Hostel Management API

NestJS API for the Hostel Management System. From the repository root, install dependencies with `pnpm install`, configure `.env` using `.env.example`, then run `pnpm --filter @hms/api start:dev`.

Student profiles store optional educational institution, program/course, and year-of-study values plus a descriptive status (`ACTIVE`, `INACTIVE`, `SUSPENDED`, or `GRADUATED`; defaults to `ACTIVE`). Organization administrators manage these fields in create/edit flows; linked students can view them on `/my-profile` but cannot change them there. Status is descriptive and separate from soft archival.

## Student documents

The authenticated student document endpoints are:

- `GET /api/v1/students/{studentId}/documents` lists document metadata.
- `POST /api/v1/students/{studentId}/documents` accepts `multipart/form-data` with a `documentType` field and one `file` field.
- `GET /api/v1/students/{studentId}/documents/{documentId}/file` downloads a file as an attachment.
- `DELETE /api/v1/students/{studentId}/documents/{documentId}` removes a document and its private file.

All four endpoints require an active session and an organization-level `HOSTEL_ADMIN` or global `SUPER_ADMIN` assignment that can access the active student. Upload, download, and delete additionally verify document ownership. Uploads are limited to 5 MiB and PDF, JPEG, or PNG; the API checks the file signature against the declared media type. Stored filenames are random UUIDs, files are kept outside the web root with private permissions, and object keys are never returned to clients.

In development, files use the ignored `apps/api/var/private/student-documents` directory. Production must set `STUDENT_DOCUMENT_STORAGE_DIR` to an absolute path on private persistent storage, outside any public web root. Back up this directory with the database and restrict access to the API process. Production must also set `STUDENT_DOCUMENT_SCANNER_PATH` to the absolute path of the ClamAV `clamscan` executable and keep its signature database updated. Upload bytes are sent over stdin for scanning before any file is persisted. Infected files receive `422`; scanner startup failures, errors, and timeouts fail closed with `503`. Local development may omit the scanner.

## Notifications and email delivery

Notifications are limited to the authenticated user and active organizations assigned to that account. `GET /api/v1/notifications` lists them, and `PATCH /api/v1/notifications/{notificationId}/read` marks one read. Organization admins and accountants can inspect `GET /api/v1/notifications/email-failures` and retry a delivery with `POST /api/v1/notifications/{notificationId}/email`.

Email delivery uses the Resend-compatible HTTP API. Configure `EMAIL_API_KEY` and `EMAIL_FROM` in the runtime environment; `EMAIL_API_URL` defaults to `https://api.resend.com/emails`. Delivery status and a safe failure reason are stored on the notification. The API never returns provider credentials or provider response bodies.

## Checks

Run API validation with `pnpm --filter @hms/api lint`, `pnpm --filter @hms/api build`, `pnpm --filter @hms/api test`, and `pnpm --filter @hms/api test:e2e`.

## Super Admin bootstrap

To provision one organization-scoped Super Admin, set `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` (at least 12 characters), `SUPER_ADMIN_FIRST_NAME`, `SUPER_ADMIN_LAST_NAME`, `SUPER_ADMIN_ORGANIZATION_NAME`, and `SUPER_ADMIN_ORGANIZATION_SLUG` in the ignored root `.env` file. Keep the organization slug stable. Then run `pnpm --filter @hms/api bootstrap:super-admin` from the repository root after configuring the database. The command builds the API, creates the organization and administrator only when absent, activates the configured account, adds its organization membership and organization-scoped `SUPER_ADMIN` role, and associates all existing permission records with that role. It uses the API's Argon2id password hasher and never prints credential values.

Rerunning the command preserves an existing password hash and existing administrator profile names. It only fills a missing password hash, normalizes email casing, and ensures the account is active and has the configured organization membership and role. It refuses an archived organization or a slug that already names a different organization. No arbitrary email gains access; only the explicitly configured administrator does. The current application authorizes primarily by role name and scope, so permission rows supplement that existing authorization rather than replacing it.
