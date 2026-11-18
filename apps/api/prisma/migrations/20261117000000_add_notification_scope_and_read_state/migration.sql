ALTER TABLE "Notification"
ADD COLUMN "organizationId" UUID,
ADD COLUMN "readAt" TIMESTAMPTZ(6);

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Notification_organizationId_userId_readAt_createdAt_idx"
ON "Notification"("organizationId", "userId", "readAt", "createdAt");
