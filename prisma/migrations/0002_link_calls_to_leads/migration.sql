-- Link provider call records to the lead created for the call.
ALTER TABLE "CallRecord" ADD COLUMN "leadId" TEXT;

CREATE UNIQUE INDEX "CallRecord_leadId_key" ON "CallRecord"("leadId");

ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
