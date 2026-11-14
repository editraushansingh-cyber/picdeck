-- Invoice redesign: per-invoice function schedule, studio website/UPI/bank, GST off by default.
ALTER TABLE "Invoice" ADD COLUMN "functions" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Invoice" ALTER COLUMN "taxRate" SET DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "website" TEXT;
ALTER TABLE "User" ADD COLUMN "upiId" TEXT;
ALTER TABLE "User" ADD COLUMN "bankAccount" TEXT;
ALTER TABLE "User" ADD COLUMN "ifsc" TEXT;
