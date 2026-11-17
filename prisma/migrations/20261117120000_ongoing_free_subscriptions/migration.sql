-- An account on the Free plan is ongoing, not a time-limited trial.
ALTER TABLE "Subscription" ALTER COLUMN "endsAt" DROP NOT NULL;
