# API Documentation

The API is implemented incrementally. Generate and maintain the canonical NestJS Swagger/OpenAPI contract as the endpoint set grows.

Planned REST conventions:

- Version the API path (`/api/v1`); use resource-oriented routes and consistent JSON/error envelopes.
- Authenticate using secure session cookies where appropriate. Never accept caller-supplied tenant or role claims as authorization.
- Resolve organization and hostel scope from authenticated membership and validate every referenced resource's ownership.
- Validate request DTOs strictly; normalize identifiers and user-provided text. Paginate list endpoints and define stable sorting/filtering limits.
- Use appropriate status codes and safe error messages; do not expose stack traces or secrets.
- Use idempotency keys for payment/provider callbacks and other replay-sensitive operations. Verify webhook signatures before state changes.
- Document authentication, permissions, request/response schemas, pagination, errors, and sandbox/external integration configuration in generated OpenAPI.

## Implemented authentication endpoint

### `POST /api/v1/auth/login`

- Request JSON: `{ "email": "user@example.com", "password": "..." }`; unknown fields are rejected.
- Success: `200` with `{ "userId": "..." }`; the opaque session token is set only in the `hms_session` HttpOnly, SameSite=Lax cookie. The cookie is Secure in production and expires with the server-side session.
- Invalid input: `400`; invalid credentials or inactive account: generic `401`; login throttle exceeded: `429`.
- Limit: 5 requests per minute per client IP, using the Nest throttler's in-memory storage.

### `POST /api/v1/auth/register`

- Request JSON: `{ "fullName": "...", "email": "...", "password": "...", "confirmPassword": "..." }`; names and email are trimmed, passwords must contain at least 8 characters, and unknown fields are rejected.
- Success: `201` with `{ "userId": "..." }` and the normal `hms_session` cookie. User, organization, membership, and configured default role are created transactionally. `DEFAULT_SIGNUP_ROLE` is `HOSTEL_ADMIN` by default and may be configured as `ACCOUNTANT`.
- Duplicate email returns `409`; invalid input returns `400`; the registration throttle limit is 3 requests per minute per client IP.

### `POST /api/v1/auth/logout`

- Reads the `hms_session` cookie, revokes that server-side session when present, and clears the cookie using matching HttpOnly, SameSite, Secure, and path settings.
- Idempotent success: `200` with `{ "status": "ok" }`, including when no session cookie is present.
- Cookie-authenticated state changes pass through Nest CSRF protection. The configured `WEB_ORIGIN` is the sole credentialed CORS and trusted frontend origin.

### `GET /api/v1/auth/me`

- Requires an active, unexpired server-side session from the `hms_session` cookie; missing, expired, revoked, or inactive-user sessions return `401`.
- Sessions expire after 30 minutes without a valid request or after the seven-day absolute lifetime, whichever comes first.
- Success returns only `{ "id", "email", "firstName", "lastName" }` for the authenticated user.

### `POST /api/v1/auth/rotate`

- Requires an active session cookie and CSRF validation.
- Atomically revokes the current session and issues a new opaque session token, replacing the HttpOnly cookie. The old token cannot be reused.
- Success: `200` with `{ "status": "ok" }`; inactive or already-rotated sessions return `401`.
- Limit: 5 requests per minute per client IP.

### `POST /api/v1/auth/password-reset/complete`

- Request JSON: `{ "token": "<reset token>", "newPassword": "<15 or more characters>" }`; unknown fields are rejected.
- On success, atomically consumes the token, stores the new Argon2id password hash, invalidates other outstanding reset tokens, and revokes all sessions for the account.
- Success: `200` with `{ "status": "ok" }`; invalid or expired tokens return `401`; malformed input returns `400`.
- Limit: 5 requests per minute per client IP. Reset initiation and delivery are not available until an email provider is configured.

## Browser session behavior

- The web app verifies the successful login or registration response contains a user ID, then sends the browser to `/dashboard`. The server-rendered protected route forwards the HttpOnly `hms_session` cookie to `GET /api/v1/auth/me` without caching; missing or invalid sessions are redirected to `/login`.
- The dashboard sign-out action calls `POST /api/v1/auth/logout`, which revokes the server-side session and clears the browser cookie before returning to sign-in.

## Implemented dashboard endpoint

## Notifications and email delivery

- `GET /api/v1/notifications` returns up to 50 recent notifications for the authenticated user in their assigned active organizations.
- `PATCH /api/v1/notifications/{notificationId}/read` marks only that user's scoped notification as read; unknown and out-of-scope IDs return `404`.
- `GET /api/v1/notifications/email-failures` returns organization-scoped failed deliveries to super admins, hostel admins, and accountants.
- `POST /api/v1/notifications/{notificationId}/email` retries delivery for a notification in the caller's organization scope. The provider result is persisted as `SENT` or `FAILED`.
- Configure `EMAIL_API_KEY` and `EMAIL_FROM` using secret environment settings. `EMAIL_API_URL` defaults to `https://api.resend.com/emails`. Missing configuration is recorded as a delivery failure; secrets and provider response bodies are never returned.

## Implemented student directory endpoint

## Booking request review

### `GET /api/v1/bookings`

- Requires an active session and an organization-level `HOSTEL_ADMIN` / `SUPER_ADMIN` assignment, or an unscoped global `SUPER_ADMIN` assignment. Hostel-only roles cannot review organization-wide booking requests.
- Accepts `page` (default `1`) and `pageSize` (default `25`, maximum `100`); unknown query parameters are rejected. Returns booking date/status/notes plus student ID, student number, name, and organization ID/name. Archived student profiles and organizations are excluded; requests are ordered oldest first.
- Users without qualifying organization-level access receive `403`; unauthenticated requests receive `401`.

## Finance

### `GET /api/v1/invoices`

- Requires organization-level invoice access and returns bounded pages of invoices for active students in active organizations within the caller's persisted scope. Each row includes invoice status, currency, total, issue/due/creation times, and limited student/organization summary fields.
- Accepts `page` (default `1`) and `pageSize` (default `25`, maximum `100`). Users without organization access receive `403`; unauthenticated requests receive `401`.

### `GET /api/v1/invoices/{invoiceId}`

- Requires organization-level invoice access and returns one active-scope invoice with limited student identity, itemized decimal charges, and payment method/status/amount/timestamps. Private provider transaction payloads and references are excluded. `paidAmount` and `balanceDue` are calculated from successful payments using exact decimal cents.
- Missing/out-of-scope invoices return `404`; users without organization access receive `403`; unauthenticated requests receive `401`.

### `POST /api/v1/invoices`

- Requires an active session and an organization-level `HOSTEL_ADMIN` / `SUPER_ADMIN` assignment or global `SUPER_ADMIN`. The student must belong to an active organization in the caller's scope.
- Creates a `DRAFT` invoice with 1–100 item rows. Each item has a trimmed description, positive integer quantity, and positive fixed two-decimal `unitAmount` string. Optional `dueAt` must include a timezone offset. The invoice currency is snapshotted from the organization; line totals and invoice total are calculated using decimal arithmetic.
- Duplicate invoice numbers for the student return `409`; missing/out-of-scope students return `404`; unauthorized roles return `403`; invalid amounts/body return `400`; unauthenticated requests return `401`. Drafts are not payable until issued.

### `PATCH /api/v1/invoices/{invoiceId}/issue`

- Requires organization-level invoice management access and atomically changes a scoped `DRAFT` invoice to `ISSUED`, recording the server issue time. Issued invoices cannot be edited through draft creation or re-issued.
- Missing/out-of-scope invoices return `404`; non-draft invoices return `409`; users without organization access receive `403`; unauthenticated requests receive `401`.

### `POST /api/v1/invoices/{invoiceId}/payments/offline`

- Requires organization-level invoice management access. Accepts only a positive fixed two-decimal amount string and `CASH` or `BANK_TRANSFER`; the amount must not exceed the outstanding balance.
- In a serializable transaction, records the authenticated actor and server receipt time, creates a successful offline payment in the invoice currency, and updates invoice status to `PARTIALLY_PAID` or `PAID`. This endpoint represents staff-verified funds received; online provider events use separate verification flows.
- Missing, draft, void, or out-of-scope invoices return `404`; overpayment or concurrent invoice changes return `409`; invalid input returns `400`; unauthorized roles return `403`; unauthenticated requests return `401`.

### `PATCH /api/v1/bookings/{bookingId}/approve`

- Requires an active session and organization-level hostel administrator/super administrator or global super administrator access to the request. Accepts only `{ "bedId": "<uuid>" }` and requires an active bed in the student's organization and an active hostel/room path.
- In one transaction, converts requested organization-local date boundaries to UTC instants, creates the allocation, and changes the booking from `REQUESTED` to `APPROVED`. PostgreSQL interval exclusion constraints serialize and reject overlapping student or bed assignments.
- Missing, archived, or out-of-scope bookings/beds return `404`; already-reviewed requests or interval conflicts return `409`; invalid input returns `400`; unauthenticated requests return `401`.

### `GET /api/v1/bookings/{bookingId}/available-beds`

- Requires the same organization access as booking review. Returns bounded pages of active beds in the student's active organization whose active allocation interval does not overlap the request. If the student has another overlapping allocation, the list is empty.
- Accepts `page` (default `1`) and `pageSize` (default `25`, maximum `100`); response includes bed ID/label and room, floor, building, and hostel names/codes. Booking dates are converted with the organization timezone for interval checks.
- Missing, archived, or out-of-scope bookings return `404`; users without organization-level review access receive `403`; unauthenticated requests return `401`.

### `PATCH /api/v1/bookings/{bookingId}/reject`

- Requires the same organization access as approval and changes only a scoped `REQUESTED` booking to `REJECTED` atomically.
- Missing, archived, or out-of-scope bookings return `404`; already-reviewed requests return `409`; unauthenticated requests return `401`.

### `PATCH /api/v1/bookings/allocations/{allocationId}/check-in`

- Requires organization-level booking review access and an active allocation for a student in the caller's organization scope. Accepts an optional notes field (maximum 1000 characters) and records the check-in at the server's current time.
- Missing/out-of-scope/ended allocations return `404`; duplicate check-ins return `409`; unauthenticated requests return `401`.

### `PATCH /api/v1/bookings/allocations/{allocationId}/check-out`

- Requires organization-level booking review access and an active allocation for a student in the caller's organization scope. Accepts optional notes and atomically records checkout and sets the allocation's effective end time and status to `COMPLETED`, releasing the remaining reserved interval.
- Missing/out-of-scope/ended allocations return `404`; unauthenticated requests return `401`.

### `PATCH /api/v1/bookings/allocations/{allocationId}/transfer`

- Requires organization-level booking review access and accepts only `{ "bedId": "<uuid>" }` for a different active bed in the same active organization.
- The current allocation is closed at the transfer time (or cancelled if it has not started yet), and a replacement allocation preserves the booking and planned end date. Bed and student interval constraints reject conflicts atomically.
- Missing/out-of-scope allocations or beds return `404`; stale allocations and interval conflicts return `409`; unauthenticated requests return `401`.

### `GET /api/v1/students/me`

- Requires an active session and returns only the active student profile linked to the authenticated user ID. No caller-supplied student identifier is accepted.
- Returns student ID, organization ID, student number, name, email, phone, date of birth, educational institution, program, year of study, and administrative status. Guardian contacts, documents, credentials, and other student records are excluded.
- Returns `404` if the user has no linked active student profile or its organization is archived; missing or invalid sessions return `401`.

### `GET /api/v1/students/me/room-history`

- Requires an active session and resolves the student solely through the authenticated user's active student profile and organization; no student ID or role assignment is accepted from the caller.
- Returns the same allocation date, status, bed, room, floor, building, and hostel fields as the administrator room-history endpoint, limited to the authenticated student's own allocations.
- Returns `404` if the user has no linked active student profile or its organization is archived; missing or invalid sessions return `401`.

### `PATCH /api/v1/students/me`

- Requires an active session and updates only the active student profile linked to that authenticated user. It accepts a strict partial body containing email and/or phone; either contact can be set to `null` to clear it. Names, student number, organization, and account linkage cannot be changed by this route.
- The update is scoped atomically by authenticated user ID and excludes archived students and organizations. Success returns the updated basic profile; no linked active student returns `404`; invalid input returns `400`.

### `POST /api/v1/students/me/bookings`

- Requires an active session and creates a `REQUESTED` booking only for the active student profile linked to the authenticated user. Student IDs and booking status are not accepted from the caller.
- Accepts strict `requestedFrom` (ISO calendar date), optional `requestedUntil` (exclusive ISO calendar date or `null` for no planned end), and optional notes (up to 1000 characters). An end date must be after the start date. Dates are stored as organization-local calendar dates; allocation approval later converts boundaries using the organization's timezone.
- Returns booking ID, requested dates, `REQUESTED` status, notes, and creation time. Missing/archived student profiles or organizations return `404`; invalid input returns `400`; unauthenticated requests return `401`.

### `GET /api/v1/students/me/bookings`

- Requires an active session and lists only booking requests belonging to the active student profile linked to the authenticated user.
- Accepts `page` (default `1`) and `pageSize` (default `25`, maximum `100`); unknown query parameters are rejected. Returns `{ "bookings": [...], "page": 1, "pageSize": 25, "hasMore": false }`, ordered newest first with request dates, status, notes, and creation time.
- Missing/archived student profiles or organizations return `404`; unauthenticated requests return `401`.

### `PATCH /api/v1/students/me/bookings/{bookingId}/cancel`

- Requires an active session and cancels only a `REQUESTED` booking belonging to the active student profile linked to the authenticated user. The ownership, active student/organization, and pending status predicates are applied atomically.
- Success returns `{ "id": "…", "status": "CANCELLED" }`. Missing or other-student bookings return `404`; already-reviewed requests return `409`; unauthenticated requests return `401`.

### `GET /api/v1/students`

- Requires an active session and either an organization-scoped `HOSTEL_ADMIN` / `SUPER_ADMIN` assignment or an unscoped global `SUPER_ADMIN` assignment. Hostel-scoped roles cannot use this organization-wide student directory.
- Accepts `page` (default `1`) and `pageSize` (default `25`, maximum `100`); unknown query parameters are rejected. Returns `{ "students": [...], "page": 1, "pageSize": 25, "hasMore": false, "creatableOrganizations": [{ "id", "name" }] }`. Student rows contain non-archived profiles in non-archived organizations visible to the caller, ordered by last name, first name, then ID, and include education fields and administrative status. The organization choices contain only active organizations in the caller's create scope and support organization selection in the student form. Student rows exclude user credentials, documents, guardians, and other related records.
- Accounts without qualifying access receive `403`; missing or invalid sessions receive `401`.

### `POST /api/v1/students`

- Requires an active session and an organization-level `HOSTEL_ADMIN` / `SUPER_ADMIN`, or global `SUPER_ADMIN`. Hostel-only assignments cannot create organization-wide student records.
- Accepts `studentNumber`, `firstName`, `lastName`, optional `organizationId`, `email`, `phone`, ISO `dateOfBirth`, educational fields, and optional status (`ACTIVE`, `INACTIVE`, `SUSPENDED`, or `GRADUATED`; default `ACTIVE`). Fields are trimmed, lengths are bounded, and unknown properties are rejected. Status is descriptive and does not control account access, allocation, or archival. Email is stored lowercased. `userId` and account credentials cannot be set through this endpoint.
- A single organization assignment is selected automatically. Multiple organization assignments and global administrators must supply `organizationId`, which is checked against persisted authorization and active organization state.
- Returns the created profile fields. Duplicate organization/student numbers return `409`; unauthorized organization scope returns `403`; inactive or missing organizations return `404`; invalid requests return `400`.

### `PATCH /api/v1/students/{studentId}`

- Requires an active session and organization-level `HOSTEL_ADMIN` / `SUPER_ADMIN`, or global `SUPER_ADMIN`.
- Accepts a strict partial profile with student number, first/last name, email, phone, date of birth, educational institution/program/year, and status. Nullable contact, date, and educational fields can be set to `null` to clear them; status must be a supported value. Organization and account linkage cannot be changed. Status remains descriptive; archival is separate.
- The update is atomic and scoped to an active student and active organization in the caller's persisted scope. Out-of-scope or archived students return `404`; duplicate organization/student numbers return `409`; invalid input returns `400`.

### `GET /api/v1/students/{studentId}/guardians`

- Requires an active session and organization-level `HOSTEL_ADMIN` / `SUPER_ADMIN`, or global `SUPER_ADMIN`.
- Lists guardian name, relationship, email, and phone only after confirming the student is active and within the caller's active organization scope. Out-of-scope or archived students return `404`.

### `GET /api/v1/students/{studentId}/room-history`

- Requires an active session and organization-level `HOSTEL_ADMIN` / `SUPER_ADMIN`, or global `SUPER_ADMIN`; hostel-only assignments cannot access the organization-wide student history.
- Returns `{ "allocations": [...] }` for the active student after checking the caller's persisted organization scope. Each row contains allocation ID, start/end/ended timestamps, allocation status, and the bed label plus room, floor, building, and hostel name/code. Rows are ordered newest start date first; student account and contact details are excluded.
- Out-of-scope or archived students return `404`; unauthenticated requests return `401`.

### `POST /api/v1/students/{studentId}/guardians`

- Uses the same authorization and active-student scope as the guardian list endpoint.
- Accepts a strict name and phone, with optional relationship and email; the API sets the student relation from the path and normalizes email to lowercase.
- Returns the created guardian contact fields. Unknown student, archived student, or out-of-scope student returns `404`; invalid fields return `400`.

### `PATCH /api/v1/students/{studentId}/guardians/{guardianId}`

- Requires the same active student and organization scope as guardian listing. The guardian ID must belong to the student in the path; mismatches return `404`.
- Accepts a strict partial update of name, relationship, email, or phone. Nullable relationship and email can be cleared with `null`; email is normalized to lowercase.
- Returns the updated guardian contact fields; invalid input returns `400`.

### `GET /api/v1/students/{studentId}/documents`

- Requires an authenticated organization-level hostel administrator or global super administrator with access to the active student.
- Returns `{ "documents": [...] }` with document ID, type, content type, and creation time. Private storage keys are never returned.
- Out-of-scope or archived students return `404`; unauthenticated requests return `401`.

### `POST /api/v1/students/{studentId}/documents`

- Requires an authenticated organization-level hostel administrator or global super administrator with access to the active student. Upload is limited to 10 requests per minute per client.
- Accepts `multipart/form-data` with `documentType` (1-80 characters) and one `file` (maximum 5 MiB). Only signature-verified PDF, JPEG, and PNG files are accepted, and the signature must match the declared media type.
- When `documentType` is `Student photograph` (case-insensitive), only JPEG and PNG images are accepted.
- In production, upload bytes are scanned with the configured ClamAV `clamscan` executable before storage. Infected files return `422`; scanner errors and timeouts fail closed with `503`. Local development may omit the scanner.
- Stores files under generated private UUID keys and returns metadata only. The original filename is discarded.
- Out-of-scope or archived students return `404`; invalid file/type returns `400`; unauthenticated requests return `401`; size limit returns `413`.

### `GET /api/v1/students/{studentId}/documents/{documentId}/file`

- Requires the same active student and organization scope as document listing. The document ID must belong to the student in the path; otherwise `404` is returned.
- Streams the verified document as an attachment with `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`.
- The storage key is read only by the API and is never exposed to clients.

### `DELETE /api/v1/students/{studentId}/documents/{documentId}`

- Requires the same active student and organization scope as document listing. The document ID must belong to the student in the path; otherwise `404` is returned.
- Removes the private file and its metadata. If metadata deletion fails after removing the file, the API attempts to restore the file before returning the error.
- Unauthenticated requests return `401`; requests outside the caller's scope return `404`.

### `POST /api/v1/students/{studentId}/archive`

- Requires an active session and organization-level `HOSTEL_ADMIN` / `SUPER_ADMIN`, or global `SUPER_ADMIN`.
- Sets `archivedAt` without deleting the student or dependent history. The atomic update requires an active student in an active organization within the caller's persisted scope and no allocation with `endedAt = null`.
- Returns `{ "id", "archivedAt" }`. Active allocations return `409`; missing, archived, or out-of-scope students return `404`.

## Implemented dashboard endpoint

### `GET /api/v1/dashboard/summary`

- Requires an active session and a `SUPER_ADMIN`, `HOSTEL_ADMIN`, `WARDEN`, or `ACCOUNTANT` assignment.
- Returns per-organization hostel, building, room, active-bed, occupied-bed, available-bed, occupancy-rate, active-student counts, and up to five registrations and audit events from the last 30 days. Each organization includes a `hostelOccupancy` breakdown containing the scoped hostel ID/name, active, occupied, and available bed counts, and a one-decimal occupancy rate (`null` for zero capacity). Registration names are returned only to `HOSTEL_ADMIN` and `WARDEN` scopes; hostel-scoped wardens see students actively allocated within assigned hostels. Activity rows expose only action, resource type, and timestamp; the field is `null` for hostel-scoped roles because audit events currently carry organization scope only. Available beds equal active beds less active allocations on active beds. Occupancy rate is the occupied-to-active-bed percentage rounded to one decimal, or `null` when capacity is zero. Organization-wide roles see their assigned organization; hostel-scoped roles see counts limited to their assigned hostels. Global `SUPER_ADMIN` assignments can see all non-archived organizations.
- Organization and hostel scope comes only from persisted role assignments; the request does not accept a caller-selected tenant identifier. Users without a supported dashboard role receive `403`.

## Hostel directory

### `GET /api/v1/hostels`

- Requires an active session and a global `SUPER_ADMIN`, organization-level `HOSTEL_ADMIN`, or explicit hostel assignment for `HOSTEL_ADMIN`/`WARDEN`.
- Returns `{ "hostels": [...], "creatableOrganizations": [...], "manageableHostelIds": [...] }`. Hostel rows include ID, organization ID/name, name, code, address, and creation time; archived hostels and organizations are excluded. `creatableOrganizations` includes only active organizations where the caller may create a hostel (empty for read-only scopes). `manageableHostelIds` lists only returned hostels the caller may edit and archive.
- Scope comes only from persisted role assignments; the endpoint accepts no caller-selected organization or hostel identifier. Users without an eligible assignment receive `403`.

### `POST /api/v1/hostels`

- Requires an active session and an organization-level `HOSTEL_ADMIN` or global `SUPER_ADMIN` assignment. Wardens and hostel-scoped administrators cannot create hostels.
- Accepts strict JSON `{ "name": string, "code": string, "address"?: string, "organizationId"?: UUID }`. Names are trimmed; codes are normalized to uppercase and must be unique within the organization. Unknown fields are rejected.
- An organization administrator can create only inside assigned organizations; `organizationId` may be omitted when exactly one organization is assigned and is required when multiple are assigned. A global super administrator must provide an active `organizationId`.
- Returns the created hostel with its organization name. An unauthorized organization returns `403`, an inactive/missing organization returns `404`, and a duplicate code returns `409`.

### `PATCH /api/v1/hostels/{id}`

- Requires an active session and a global `SUPER_ADMIN` or `HOSTEL_ADMIN` assignment to the hostel's organization/hostel. Warden assignments cannot edit hostel records.
- Accepts a strict partial object containing one or more of `name`, `code`, or `address`. Use `address: null` to clear an address. Organization ownership cannot be changed through this endpoint; names/codes follow the same validation and uppercase code normalization as creation.
- The update predicate includes the persisted role scope and excludes hostels in archived organizations. Out-of-scope and missing hostels return `404`; a duplicate organization-local code returns `409`.

### `POST /api/v1/hostels/{id}/archive`

- Requires an active session and a global `SUPER_ADMIN` or `HOSTEL_ADMIN` assignment to the hostel's organization/hostel.
- Sets `archivedAt` without deleting the hostel or its related history. Archived hostels are omitted from the directory and dashboard counts; hostels in archived organizations cannot be changed.
- The archive write uses an atomic authorization predicate. Out-of-scope, already archived, or missing hostels return `404`; success returns `{ "status": "archived" }`.

### `GET /api/v1/hostels/{hostelId}/buildings`

- Requires an active session and persisted access to the active hostel through a global `SUPER_ADMIN`, organization-scoped `SUPER_ADMIN`/`HOSTEL_ADMIN`, or explicit `SUPER_ADMIN`/`HOSTEL_ADMIN`/`WARDEN` hostel assignment.
- Returns buildings in the authorized hostel, ordered by name, with ID, hostel ID, name, and `roomCount` (the sum of rooms across the building's floors). Hostels in archived organizations and archived hostels are not accessible.
- An inaccessible or missing hostel returns `404`.

### `POST /api/v1/hostels/{hostelId}/buildings`

- Requires an active session and global `SUPER_ADMIN` or `HOSTEL_ADMIN` assignment to the hostel's organization/hostel. Wardens cannot create buildings.
- Accepts strict JSON `{ "name": string }`; the name is trimmed, required, and limited to 120 characters. Hostel ownership is taken from the authorized route resource, never from the body.
- Returns the created building's ID, hostel ID, and name. Inaccessible or inactive hostels return `404`; duplicate names within a hostel return `409`.

### `PATCH /api/v1/hostels/{hostelId}/buildings/{buildingId}`

- Requires an active session and global `SUPER_ADMIN` or `HOSTEL_ADMIN` assignment to the building's hostel/organization; wardens cannot edit buildings.
- Accepts strict JSON `{ "name": string }`; the name is trimmed and limited to 120 characters. The route binds the building to its parent hostel and cannot move a building between hostels.
- The database update predicate includes the persisted role scope and active-hostel/organization checks. Out-of-scope or missing buildings return `404`; duplicate names within a hostel return `409`.

### `GET /api/v1/hostels/{hostelId}/buildings/{buildingId}/floors`

- Requires an active session and persisted read access to the active parent hostel. Wardens can read floors for their assigned hostels.
- Returns floors ordered by number with ID, building ID, and integer number. A building must belong to the hostel in the route; inaccessible or missing resources return `404`.

### `POST /api/v1/hostels/{hostelId}/buildings/{buildingId}/floors`

- Requires an active session and global `SUPER_ADMIN` or `HOSTEL_ADMIN` assignment to the parent hostel/organization. Wardens cannot create floors.
- Accepts strict JSON `{ "number": integer }`, including negative basement numbers and zero for ground level. The building ID comes only from the authorized route.
- Returns the created floor's ID, building ID, and number. Duplicate numbers within a building return `409`; missing or out-of-scope parents return `404`.

### `PATCH /api/v1/hostels/{hostelId}/buildings/{buildingId}/floors/{floorId}`

- Requires an active session and global `SUPER_ADMIN` or `HOSTEL_ADMIN` assignment to the floor's parent hostel/organization; wardens cannot edit floors.
- Accepts strict JSON `{ "number": integer }`, including negative basement numbers and zero for ground level. The floor remains attached to its existing building.
- The atomic update predicate verifies the floor, building, active hostel/organization, and persisted role scope. Out-of-scope or missing resources return `404`; duplicate floor numbers in the building return `409`.

### `GET /api/v1/hostels/{hostelId}/rooms/availability`

- Requires an active session and persisted read access to the active hostel. Inaccessible or missing hostels return `404`.
- Returns active rooms with building and floor labels, capacity from active beds, occupied beds from active allocations, and free beds as capacity minus occupied beds. Status is `No beds` for zero capacity, `Free` for unoccupied rooms with beds, `Partly occupied` when some beds are free, and `Full` when no beds are free. Student and allocation details are not exposed.

### `GET /api/v1/hostels/{hostelId}/buildings/{buildingId}/floors/{floorId}/rooms`

- Requires an active session and persisted read access to the active hostel. The floor and building must belong to the hostel in the route.
- Returns active rooms ordered by room number with ID, floor ID, number, type, and description. Archived rooms and inaccessible or missing parent resources are omitted or return `404`.

### `POST /api/v1/hostels/{hostelId}/buildings/{buildingId}/floors/{floorId}/rooms`

- Requires an active session and global `SUPER_ADMIN` or `HOSTEL_ADMIN` assignment to the parent hostel/organization. Wardens cannot create rooms.
- Accepts strict JSON `{ "number": string, "roomType"?: string, "description"?: string }`. Room numbers are unique within each floor; ownership is derived from the authorized route and cannot be supplied in the body.
- Returns the created room. Duplicate floor-local room numbers return `409`; missing or out-of-scope parent resources return `404`.

### `PATCH /api/v1/hostels/{hostelId}/buildings/{buildingId}/floors/{floorId}/rooms/{roomId}`

- Requires an active session and global `SUPER_ADMIN` or `HOSTEL_ADMIN` assignment to the room's parent hostel/organization. Wardens cannot edit rooms.
- Accepts a strict partial object containing one or more of `number`, `roomType`, or `description`; send `null` for `roomType` or `description` to clear either field. The room cannot be moved to a different floor.
- The atomic update predicate verifies the room, floor, building, active hostel/organization, and persisted role scope. Out-of-scope resources return `404`; duplicate room numbers on a floor return `409`.

### `POST /api/v1/hostels/{hostelId}/buildings/{buildingId}/floors/{floorId}/rooms/{roomId}/archive`

- Requires an active session and global `SUPER_ADMIN` or `HOSTEL_ADMIN` assignment to the room's parent hostel/organization.
- Sets `archivedAt` and retains the room, beds, and related history. A room with an active bed allocation cannot be archived and returns `409`; archived rooms are excluded from active room and bed capacity dashboard totals.
- The archive predicate checks the complete parent path, active organization, persisted role scope, and absence of active allocations atomically. Out-of-scope, already archived, or missing resources return `404`.

### `GET /api/v1/hostels/{hostelId}/buildings/{buildingId}/floors/{floorId}/rooms/{roomId}/beds`

- Requires an active session and persisted read access to the active hostel. The room, floor, and building must match the complete route parent path; archived rooms and inaccessible resources return `404`.
- Returns beds ordered by label with ID, room ID, label, active state, and `isOccupied`, derived from an active allocation with no end time. Inactive beds remain visible so administrators can inspect existing capacity records; allocation/student details are not exposed.

### `GET /api/v1/hostels/{hostelId}/buildings/{buildingId}/floors/{floorId}/beds`

- Requires an active session and persisted read access to the active hostel. The floor and building must match the route; archived rooms are excluded.
- Returns all beds on the floor in room/label order with room ID, label, active state, and an `isOccupied` flag derived from active allocations. Allocation/student details are not exposed. This bulk view supports loading all room-bed cards with one request.

### `POST /api/v1/hostels/{hostelId}/buildings/{buildingId}/floors/{floorId}/rooms/{roomId}/beds`

- Requires an active session and global `SUPER_ADMIN` or `HOSTEL_ADMIN` assignment to the parent hostel/organization. Wardens cannot create beds.
- Accepts strict JSON `{ "label": string }`; labels are trimmed and limited to 40 characters. Room ownership comes from the authorized route.
- Returns the created active, unoccupied bed. Duplicate labels within a room return `409`; inaccessible or missing parent resources return `404`.

### `PATCH /api/v1/hostels/{hostelId}/buildings/{buildingId}/floors/{floorId}/rooms/{roomId}/beds/{bedId}`

- Requires an active session and global `SUPER_ADMIN` or `HOSTEL_ADMIN` assignment to the bed's parent hostel/organization. Wardens cannot edit beds.
- Accepts strict JSON containing `label` (trimmed, at most 40 characters) and/or `isActive` (boolean). The bed cannot be moved to another room.
- Deactivation is rejected with `409` while the bed has an active allocation. The atomic update predicate checks the bed, room, floor, building, active hostel/organization, persisted role scope, and absence of active allocations when deactivating. Duplicate room-local labels return `409`; inaccessible or missing resources return `404`.
- Returns the updated bed with `isOccupied`, derived from active allocation state without exposing student details.

### `GET /api/v1/dashboard/notifications`

- Requires an active session and returns up to five newest `PENDING` or `SENT` notifications addressed to that authenticated user. Failed deliveries and notifications for other users are excluded.
- The web dashboard renders notification content as escaped text; delivery state is shown as “Sending” or “Sent.”

### Complaints and maintenance

- `GET /api/v1/complaints` returns complaints visible to the current student or operations role. Operations responses include each student's organization ID and staff organization IDs so assignment choices stay within the complaint's organization.
- `GET /api/v1/maintenance` returns requests and creation choices for the assigned hostel scope. Hostel options include organization IDs, staff options include their hostel assignments, and complaint options include student organization IDs so the client can show only valid choices.
- Maintenance creation and assignment validate that the hostel, complaint organization, and staff hostel assignment agree. Status updates must follow the allowed transition sequence; invalid transitions return `409`.

### Mess schedules and attendance

- `GET /api/v1/mess-schedules` returns schedules, accessible hostels, and active residents. Each resident's `hostelIds` reflects their current active allocations so attendance controls can be restricted to the schedule's hostel.
- `POST /api/v1/mess-schedules` creates a schedule only in the authenticated hostel scope and requires the end time to be after the start time. `PATCH /api/v1/mess-schedules/{scheduleId}` updates its menu and/or times with the same time-order validation.
- `POST /api/v1/mess-schedules/{scheduleId}/attendance` records attendance only for a currently active resident of that schedule's hostel. Repeated submissions use the student/schedule unique key and do not create duplicate attendance records.

### Visitor log

- `GET /api/v1/visitors` returns the latest 100 visitor entries and active students visible to the authenticated organization's or hostel's scope.
- `POST /api/v1/visitors` requires an active in-scope student, a valid visitor name and purpose, and an ISO visit time. The visitor identity and approved visit entry are created in one transaction; out-of-scope students return `404`.

Planned resource groups: auth/sessions; organizations/memberships/roles; hostels/buildings/floors/rooms/beds; students/documents/guardians; bookings/allocations/check-in/out; invoices/payments; staff/attendance; visitors; complaints/maintenance; mess/meals; announcements/notifications/leave; reports/exports; audit logs; health.
