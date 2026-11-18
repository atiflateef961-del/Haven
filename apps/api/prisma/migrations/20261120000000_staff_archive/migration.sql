ALTER TABLE "Staff" ADD COLUMN "archivedAt" TIMESTAMPTZ(6);

CREATE INDEX "Staff_organizationId_archivedAt_employeeNumber_idx"
ON "Staff"("organizationId", "archivedAt", "employeeNumber");
