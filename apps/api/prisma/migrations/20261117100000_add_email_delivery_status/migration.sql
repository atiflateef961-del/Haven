CREATE TYPE "EmailDeliveryStatus" AS ENUM ('SENT', 'FAILED');

ALTER TABLE "Notification"
ADD COLUMN "emailStatus" "EmailDeliveryStatus",
ADD COLUMN "emailSentAt" TIMESTAMPTZ(6),
ADD COLUMN "emailError" VARCHAR(500);
