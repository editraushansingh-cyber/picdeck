-- Drive-only mode: derivatives generated from the original also live in Drive.
ALTER TABLE "Photo" ADD COLUMN "thumbDriveFileId" TEXT;
ALTER TABLE "Photo" ADD COLUMN "previewDriveFileId" TEXT;
