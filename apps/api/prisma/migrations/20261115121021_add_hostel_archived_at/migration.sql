-- AlterTable
ALTER TABLE "Hostel" ADD COLUMN     "archivedAt" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "Hostel_organizationId_archivedAt_name_idx" ON "Hostel"("organizationId", "archivedAt", "name");
