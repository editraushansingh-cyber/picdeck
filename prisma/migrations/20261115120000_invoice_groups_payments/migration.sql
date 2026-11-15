-- Invoice upgrade: item groups, advance/payment log, budget mode, terms, studio numbering.
ALTER TABLE "InvoiceItem" ADD COLUMN "group" TEXT NOT NULL DEFAULT 'Deliverables';

ALTER TABLE "Invoice" ADD COLUMN "terms" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Invoice" ADD COLUMN "budgetMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Invoice" ADD COLUMN "budgetAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "extra" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "advance" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "shareable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Invoice" ADD COLUMN "publicToken" TEXT;

CREATE UNIQUE INDEX "Invoice_publicToken_key" ON "Invoice"("publicToken");

ALTER TABLE "User" ADD COLUMN "invoicePrefix" TEXT;
ALTER TABLE "User" ADD COLUMN "invoiceTerms" TEXT NOT NULL DEFAULT '[]';

CREATE TABLE "InvoicePayment" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "mode" TEXT NOT NULL DEFAULT 'UPI',
  "note" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvoicePayment_invoiceId_position_idx" ON "InvoicePayment"("invoiceId", "position");
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
