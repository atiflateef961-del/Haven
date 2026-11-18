CREATE EXTENSION IF NOT EXISTS btree_gist;

DROP INDEX "BedAllocation_bedId_key";
DROP INDEX "BedAllocation_studentId_key";

ALTER TABLE "BedAllocation"
  ADD CONSTRAINT "BedAllocation_active_bed_interval_excl"
  EXCLUDE USING gist (
    "bedId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("status" = 'ACTIVE' AND "endedAt" IS NULL);

ALTER TABLE "BedAllocation"
  ADD CONSTRAINT "BedAllocation_active_student_interval_excl"
  EXCLUDE USING gist (
    "studentId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("status" = 'ACTIVE' AND "endedAt" IS NULL);
