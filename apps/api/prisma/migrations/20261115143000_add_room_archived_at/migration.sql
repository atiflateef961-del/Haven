-- AlterTable
ALTER TABLE "Room" ADD COLUMN "archivedAt" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "Room_floorId_archivedAt_number_idx" ON "Room"("floorId", "archivedAt", "number");
