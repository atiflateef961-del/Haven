ALTER TABLE "Complaint" ADD COLUMN "assignedStaffId" UUID;

ALTER TABLE "Complaint"
ADD CONSTRAINT "Complaint_assignedStaffId_fkey"
FOREIGN KEY ("assignedStaffId") REFERENCES "Staff"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Complaint_assignedStaffId_status_idx"
ON "Complaint"("assignedStaffId", "status");
