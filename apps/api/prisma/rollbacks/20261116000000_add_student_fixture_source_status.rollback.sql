-- Use only to undo this migration after the seed transaction has rolled back,
-- or after intentionally removing the QA fixture dataset.
BEGIN;

DELETE FROM "Student"
WHERE "organizationId" IN (
  SELECT "id" FROM "Organization"
  WHERE "slug" = 'qa-test-university-do-not-use-production'
    AND "name" = 'QA Test University (Do Not Use In Production)'
);

DELETE FROM "Organization"
WHERE "slug" = 'qa-test-university-do-not-use-production'
  AND "name" = 'QA Test University (Do Not Use In Production)';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Student"
    WHERE "status"::text IN ('PROBATION', 'LEAVE_OF_ABSENCE')
  ) THEN
    RAISE EXCEPTION 'Cannot roll back StudentStatus values while non-QA rows use them';
  END IF;
END
$$;

ALTER TABLE "Student" ALTER COLUMN "status" DROP DEFAULT;
CREATE TYPE "StudentStatus_rollback" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'GRADUATED');
ALTER TABLE "Student"
  ALTER COLUMN "status" TYPE "StudentStatus_rollback"
  USING ("status"::text::"StudentStatus_rollback");
DROP TYPE "StudentStatus";
ALTER TYPE "StudentStatus_rollback" RENAME TO "StudentStatus";
ALTER TABLE "Student" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

DROP INDEX IF EXISTS "Student_fixture_identity_key";
ALTER TABLE "Student" DROP COLUMN IF EXISTS "fatherName";
ALTER TABLE "Student" DROP COLUMN IF EXISTS "gender";
ALTER TABLE "Student" DROP COLUMN IF EXISTS "nationalId";
ALTER TABLE "Student" DROP COLUMN IF EXISTS "homeAddress";
ALTER TABLE "Student" DROP COLUMN IF EXISTS "profilePhotoUrl";
ALTER TABLE "Student" DROP COLUMN IF EXISTS "bio";
ALTER TABLE "Student" DROP COLUMN IF EXISTS "enrollmentDate";
ALTER TABLE "Student" DROP COLUMN IF EXISTS "source_status";

COMMIT;
