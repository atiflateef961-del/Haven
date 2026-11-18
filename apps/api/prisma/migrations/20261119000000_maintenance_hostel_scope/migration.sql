ALTER TABLE "MaintenanceRequest" ADD COLUMN "hostelId" UUID;

ALTER TABLE "MaintenanceRequest"
ADD CONSTRAINT "MaintenanceRequest_hostelId_fkey"
FOREIGN KEY ("hostelId") REFERENCES "Hostel"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "MaintenanceRequest_hostelId_status_createdAt_idx"
ON "MaintenanceRequest"("hostelId", "status", "createdAt");
