-- Minimum table privileges used by the implemented hostel screens and actions.
-- Execute as the owner of these objects or another role with grant authority.
-- No sequence privileges are granted: Prisma supplies UUIDs from the application.
-- DELETE is limited to the two join/document cleanup paths that call deleteMany.
BEGIN;

GRANT USAGE ON SCHEMA public TO hostel_app;

-- Hostel and room inventory, including available/occupied bed calculations.
GRANT INSERT, UPDATE ON TABLE public."Hostel" TO hostel_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."Building" TO hostel_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."Floor" TO hostel_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."Room" TO hostel_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."Bed" TO hostel_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."BedAllocation" TO hostel_app;

-- Resident records, profile, guardians, documents, attendance, and room history.
GRANT SELECT, INSERT, UPDATE ON TABLE public."Student" TO hostel_app;
GRANT SELECT, INSERT, DELETE ON TABLE public."StudentDocument" TO hostel_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."Guardian" TO hostel_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."Attendance" TO hostel_app;

-- Staff, visitor log, bookings, and check-in/out.
GRANT SELECT, INSERT, UPDATE ON TABLE public."Staff" TO hostel_app;
GRANT SELECT, INSERT, DELETE ON TABLE public."StaffHostel" TO hostel_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."Booking" TO hostel_app;
GRANT SELECT, INSERT ON TABLE public."CheckIn" TO hostel_app;
GRANT SELECT, INSERT ON TABLE public."CheckOut" TO hostel_app;
GRANT SELECT, INSERT ON TABLE public."Visitor" TO hostel_app;
GRANT SELECT, INSERT ON TABLE public."VisitorRequest" TO hostel_app;

-- Invoices, payments, complaints, maintenance, meals, and notifications.
GRANT SELECT, INSERT, UPDATE ON TABLE public."Invoice" TO hostel_app;
GRANT SELECT, INSERT ON TABLE public."InvoiceItem" TO hostel_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."Payment" TO hostel_app;
GRANT SELECT, INSERT ON TABLE public."PaymentTransaction" TO hostel_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."Complaint" TO hostel_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."MaintenanceRequest" TO hostel_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."MessSchedule" TO hostel_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."MealAttendance" TO hostel_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."Notification" TO hostel_app;
GRANT SELECT ON TABLE public."AuditLog" TO hostel_app;

-- Abort and roll back if any privilege used by the feature tables is missing.
DO $verify$
DECLARE
  missing_privileges TEXT;
BEGIN
  IF NOT has_schema_privilege('hostel_app', 'public', 'USAGE') THEN
    RAISE EXCEPTION 'Required hostel_app privilege is missing: public schema USAGE';
  END IF;

  SELECT string_agg(required.table_name || ':' || required.privilege_type, ', ')
    INTO missing_privileges
  FROM (VALUES
    ('Hostel', 'INSERT'), ('Hostel', 'UPDATE'),
    ('Building', 'SELECT'), ('Building', 'INSERT'), ('Building', 'UPDATE'),
    ('Floor', 'SELECT'), ('Floor', 'INSERT'), ('Floor', 'UPDATE'),
    ('Room', 'SELECT'), ('Room', 'INSERT'), ('Room', 'UPDATE'),
    ('Bed', 'SELECT'), ('Bed', 'INSERT'), ('Bed', 'UPDATE'),
    ('BedAllocation', 'SELECT'), ('BedAllocation', 'INSERT'), ('BedAllocation', 'UPDATE'),
    ('Student', 'SELECT'), ('Student', 'INSERT'), ('Student', 'UPDATE'),
    ('StudentDocument', 'SELECT'), ('StudentDocument', 'INSERT'), ('StudentDocument', 'DELETE'),
    ('Guardian', 'SELECT'), ('Guardian', 'INSERT'), ('Guardian', 'UPDATE'),
    ('Attendance', 'SELECT'), ('Attendance', 'INSERT'), ('Attendance', 'UPDATE'),
    ('Staff', 'SELECT'), ('Staff', 'INSERT'), ('Staff', 'UPDATE'),
    ('StaffHostel', 'SELECT'), ('StaffHostel', 'INSERT'), ('StaffHostel', 'DELETE'),
    ('Booking', 'SELECT'), ('Booking', 'INSERT'), ('Booking', 'UPDATE'),
    ('CheckIn', 'SELECT'), ('CheckIn', 'INSERT'),
    ('CheckOut', 'SELECT'), ('CheckOut', 'INSERT'),
    ('Visitor', 'SELECT'), ('Visitor', 'INSERT'),
    ('VisitorRequest', 'SELECT'), ('VisitorRequest', 'INSERT'),
    ('Invoice', 'SELECT'), ('Invoice', 'INSERT'), ('Invoice', 'UPDATE'),
    ('InvoiceItem', 'SELECT'), ('InvoiceItem', 'INSERT'),
    ('Payment', 'SELECT'), ('Payment', 'INSERT'), ('Payment', 'UPDATE'),
    ('PaymentTransaction', 'SELECT'), ('PaymentTransaction', 'INSERT'),
    ('Complaint', 'SELECT'), ('Complaint', 'INSERT'), ('Complaint', 'UPDATE'),
    ('MaintenanceRequest', 'SELECT'), ('MaintenanceRequest', 'INSERT'), ('MaintenanceRequest', 'UPDATE'),
    ('MessSchedule', 'SELECT'), ('MessSchedule', 'INSERT'), ('MessSchedule', 'UPDATE'),
    ('MealAttendance', 'SELECT'), ('MealAttendance', 'INSERT'), ('MealAttendance', 'UPDATE'),
    ('Notification', 'SELECT'), ('Notification', 'INSERT'), ('Notification', 'UPDATE'),
    ('AuditLog', 'SELECT')
  ) AS required(table_name, privilege_type)
  WHERE NOT has_table_privilege(
    'hostel_app',
    format('%I.%I', 'public', required.table_name),
    required.privilege_type
  );

  IF missing_privileges IS NOT NULL THEN
    RAISE EXCEPTION 'Required hostel_app feature privileges are missing: %', missing_privileges;
  END IF;
END;
$verify$;

COMMIT;

-- Return zero rows only when all expected feature privileges are present.
WITH required(table_name, privilege_type) AS (
  VALUES
    ('Hostel', 'INSERT'), ('Hostel', 'UPDATE'),
    ('Building', 'SELECT'), ('Building', 'INSERT'), ('Building', 'UPDATE'),
    ('Floor', 'SELECT'), ('Floor', 'INSERT'), ('Floor', 'UPDATE'),
    ('Room', 'SELECT'), ('Room', 'INSERT'), ('Room', 'UPDATE'),
    ('Bed', 'SELECT'), ('Bed', 'INSERT'), ('Bed', 'UPDATE'),
    ('BedAllocation', 'SELECT'), ('BedAllocation', 'INSERT'), ('BedAllocation', 'UPDATE'),
    ('Student', 'SELECT'), ('Student', 'INSERT'), ('Student', 'UPDATE'),
    ('StudentDocument', 'SELECT'), ('StudentDocument', 'INSERT'), ('StudentDocument', 'DELETE'),
    ('Guardian', 'SELECT'), ('Guardian', 'INSERT'), ('Guardian', 'UPDATE'),
    ('Attendance', 'SELECT'), ('Attendance', 'INSERT'), ('Attendance', 'UPDATE'),
    ('Staff', 'SELECT'), ('Staff', 'INSERT'), ('Staff', 'UPDATE'),
    ('StaffHostel', 'SELECT'), ('StaffHostel', 'INSERT'), ('StaffHostel', 'DELETE'),
    ('Booking', 'SELECT'), ('Booking', 'INSERT'), ('Booking', 'UPDATE'),
    ('CheckIn', 'SELECT'), ('CheckIn', 'INSERT'),
    ('CheckOut', 'SELECT'), ('CheckOut', 'INSERT'),
    ('Visitor', 'SELECT'), ('Visitor', 'INSERT'),
    ('VisitorRequest', 'SELECT'), ('VisitorRequest', 'INSERT'),
    ('Invoice', 'SELECT'), ('Invoice', 'INSERT'), ('Invoice', 'UPDATE'),
    ('InvoiceItem', 'SELECT'), ('InvoiceItem', 'INSERT'),
    ('Payment', 'SELECT'), ('Payment', 'INSERT'), ('Payment', 'UPDATE'),
    ('PaymentTransaction', 'SELECT'), ('PaymentTransaction', 'INSERT'),
    ('Complaint', 'SELECT'), ('Complaint', 'INSERT'), ('Complaint', 'UPDATE'),
    ('MaintenanceRequest', 'SELECT'), ('MaintenanceRequest', 'INSERT'), ('MaintenanceRequest', 'UPDATE'),
    ('MessSchedule', 'SELECT'), ('MessSchedule', 'INSERT'), ('MessSchedule', 'UPDATE'),
    ('MealAttendance', 'SELECT'), ('MealAttendance', 'INSERT'), ('MealAttendance', 'UPDATE'),
    ('Notification', 'SELECT'), ('Notification', 'INSERT'), ('Notification', 'UPDATE'),
    ('AuditLog', 'SELECT')
)
SELECT table_name, privilege_type
FROM required
WHERE NOT has_table_privilege(
  'hostel_app',
  format('%I.%I', 'public', table_name),
  privilege_type
)
ORDER BY table_name, privilege_type;

-- List actual direct table grants for review. This script grants no sequence privileges.
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'hostel_app'
  AND table_schema = 'public'
  AND table_name IN (
    'Hostel', 'Building', 'Floor', 'Room', 'Bed', 'BedAllocation', 'Student',
    'StudentDocument', 'Guardian', 'Attendance', 'Staff', 'StaffHostel', 'Booking',
    'CheckIn', 'CheckOut', 'Visitor', 'VisitorRequest', 'Invoice', 'InvoiceItem',
    'Payment', 'PaymentTransaction', 'Complaint', 'MaintenanceRequest', 'MessSchedule',
    'MealAttendance', 'Notification', 'AuditLog'
  )
ORDER BY table_name, privilege_type;
