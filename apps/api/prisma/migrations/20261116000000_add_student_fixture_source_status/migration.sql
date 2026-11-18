-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StudentStatus" ADD VALUE 'PROBATION';
ALTER TYPE "StudentStatus" ADD VALUE 'LEAVE_OF_ABSENCE';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "enrollmentDate" DATE,
ADD COLUMN     "fatherName" VARCHAR(160),
ADD COLUMN     "gender" VARCHAR(20),
ADD COLUMN     "homeAddress" VARCHAR(500),
ADD COLUMN     "nationalId" VARCHAR(15),
ADD COLUMN     "profilePhotoUrl" VARCHAR(500),
ADD COLUMN     "source_status" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Student_fixture_identity_key" ON "Student"("studentNumber", "email", "phone", "nationalId");
