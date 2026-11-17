CREATE TABLE "DriveOAuthAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriveOAuthAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DriveOAuthAttempt_stateHash_key" ON "DriveOAuthAttempt"("stateHash");
CREATE INDEX "DriveOAuthAttempt_expiresAt_idx" ON "DriveOAuthAttempt"("expiresAt");

ALTER TABLE "DriveOAuthAttempt" ADD CONSTRAINT "DriveOAuthAttempt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
