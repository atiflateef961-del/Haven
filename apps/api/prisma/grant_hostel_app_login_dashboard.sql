-- Execute as the owner of these objects or another role with grant authority.
-- Verified runtime role: hostel_app. Verified application schema: public.
-- These are the minimum table privileges used by bootstrap, authentication,
-- membership/role setup, password reset, and session management.
-- The Prisma schema uses client-generated UUIDs; public has no sequences.
-- No privileges are granted on _prisma_migrations or other application tables.
BEGIN;

GRANT USAGE ON SCHEMA public TO hostel_app;

GRANT SELECT, INSERT ON TABLE public."Organization" TO hostel_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."User" TO hostel_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."Membership" TO hostel_app;
GRANT SELECT, INSERT ON TABLE public."Role" TO hostel_app;
GRANT SELECT ON TABLE public."Permission" TO hostel_app;
GRANT SELECT, INSERT ON TABLE public."UserRole" TO hostel_app;
GRANT SELECT, INSERT ON TABLE public."RolePermission" TO hostel_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."Session" TO hostel_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public."PasswordResetToken" TO hostel_app;

GRANT SELECT ON TABLE public."Hostel" TO hostel_app;

-- Fail and roll back if any required privilege is still missing.
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
    ('Organization', 'SELECT'), ('Organization', 'INSERT'),
    ('User', 'SELECT'), ('User', 'INSERT'), ('User', 'UPDATE'),
    ('Membership', 'SELECT'), ('Membership', 'INSERT'), ('Membership', 'UPDATE'),
    ('Role', 'SELECT'), ('Role', 'INSERT'),
    ('Permission', 'SELECT'),
    ('UserRole', 'SELECT'), ('UserRole', 'INSERT'),
    ('RolePermission', 'SELECT'), ('RolePermission', 'INSERT'),
    ('Session', 'SELECT'), ('Session', 'INSERT'), ('Session', 'UPDATE'),
    ('PasswordResetToken', 'SELECT'), ('PasswordResetToken', 'INSERT'), ('PasswordResetToken', 'UPDATE'),
    ('Hostel', 'SELECT')
  ) AS required(table_name, privilege_type)
  WHERE NOT has_table_privilege(
    'hostel_app',
    format('%I.%I', 'public', required.table_name),
    required.privilege_type
  );

  IF missing_privileges IS NOT NULL THEN
    RAISE EXCEPTION 'Required hostel_app privileges are missing: %', missing_privileges;
  END IF;
  END;
$verify$;

COMMIT;

-- Report the actual direct grants after execution.
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'hostel_app'
  AND table_schema = 'public'
  AND table_name IN (
    'Organization', 'User', 'Membership', 'Role', 'Permission',
    'UserRole', 'RolePermission', 'Session', 'PasswordResetToken', 'Hostel'
  )
ORDER BY table_name, privilege_type;

-- Return zero rows only when every required table privilege is present.
WITH required(table_name, privilege_type) AS (
  VALUES
    ('Organization', 'SELECT'), ('Organization', 'INSERT'),
    ('User', 'SELECT'), ('User', 'INSERT'), ('User', 'UPDATE'),
    ('Membership', 'SELECT'), ('Membership', 'INSERT'), ('Membership', 'UPDATE'),
    ('Role', 'SELECT'), ('Role', 'INSERT'),
    ('Permission', 'SELECT'),
    ('UserRole', 'SELECT'), ('UserRole', 'INSERT'),
    ('RolePermission', 'SELECT'), ('RolePermission', 'INSERT'),
    ('Session', 'SELECT'), ('Session', 'INSERT'), ('Session', 'UPDATE'),
    ('PasswordResetToken', 'SELECT'), ('PasswordResetToken', 'INSERT'), ('PasswordResetToken', 'UPDATE'),
    ('Hostel', 'SELECT')
)
SELECT table_name, privilege_type
FROM required
WHERE NOT has_table_privilege(
  'hostel_app',
  format('%I.%I', 'public', table_name),
  privilege_type
)
ORDER BY table_name, privilege_type;

-- Catalog check: no sequence grants are needed when this returns zero rows.
SELECT sequence_schema, sequence_name
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;
